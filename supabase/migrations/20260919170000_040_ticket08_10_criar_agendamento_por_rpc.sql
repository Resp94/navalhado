-- Spec 040, tickets 08 e 10: criar Agendamento por RPC (gerente e proprietario), com a
-- entrada da Lista de Espera consumida na mesma transacao.
--
-- create_appointment_by_manager valida no banco o que antes so a tela conferia: horario
-- passado (so encaixe), Bloqueio de Horario, conflito com outro agendamento ativo e,
-- pelo gatilho existente, expediente, escala e intervalo. "Tanto faz" (profissional
-- nulo) e resolvido aqui: cada profissional ativo, em ordem de nome, e tentado; conflito
-- ou escala recusados pelo proprio banco apenas passam para o proximo. A duracao segue a
-- Associacao Profissional-Servico do profissional resolvido. O Cliente novo e criado na
-- mesma transacao, e a entrada da Lista de Espera so sai da fila se o agendamento for
-- salvo: qualquer recusa desfaz tudo, inclusive o cliente criado.
--
-- Antes, a checagem de acesso morava so em lock_appointment_for_transition; agora
-- private.assert_tenant_access a concentra e as duas RPCs a reusam.

create or replace function private.assert_tenant_access(
  p_tenant_id uuid,
  p_allow_barber boolean
)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_user_role text;
  v_user_tenant uuid;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.' using errcode = '42501';
  end if;

  select u.role, u.tenant_id
    into v_user_role, v_user_tenant
  from public.users u
  where u.id = v_user_id
    and u.is_active = true;

  if v_user_role is null
     or (
       v_user_role not in ('gerente', 'proprietario')
       and not (p_allow_barber and v_user_role = 'barbeiro')
     ) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  if p_tenant_id is null then
    raise exception 'Unidade não informada.' using errcode = '22023';
  end if;

  if v_user_role <> 'proprietario' and v_user_tenant is distinct from p_tenant_id then
    raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
  end if;

  return v_user_role;
end;
$function$;

revoke all on function private.assert_tenant_access(uuid, boolean) from public, anon, authenticated;

create or replace function private.lock_appointment_for_transition(
  p_appointment_id uuid,
  p_tenant_id uuid,
  p_allow_barber boolean
)
returns public.appointments
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_role text;
  v_appointment public.appointments%rowtype;
begin
  v_user_role := private.assert_tenant_access(p_tenant_id, p_allow_barber);

  select *
    into v_appointment
  from public.appointments
  where id = p_appointment_id
    and tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception 'Agendamento não encontrado.' using errcode = 'P0001';
  end if;

  if v_user_role = 'barbeiro'
     and not (select private.is_own_professional(v_appointment.professional_id)) then
    raise exception 'Acesso negado a este agendamento.' using errcode = '42501';
  end if;

  return v_appointment;
end;
$function$;

revoke all on function private.lock_appointment_for_transition(uuid, uuid, boolean) from public, anon, authenticated;

create or replace function public.create_appointment_by_manager(
  p_tenant_id uuid,
  p_service_id uuid,
  p_start_time timestamptz,
  p_professional_id uuid default null,
  p_customer_id uuid default null,
  p_new_customer_name text default null,
  p_new_customer_phone text default null,
  p_is_fitting boolean default false,
  p_notes text default null,
  p_waiting_list_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_is_fitting boolean := coalesce(p_is_fitting, false);
  v_explicit boolean := p_professional_id is not null;
  v_base_duration integer;
  v_customer_id uuid := p_customer_id;
  v_new_name text := nullif(btrim(coalesce(p_new_customer_name, '')), '');
  v_new_phone text := nullif(btrim(coalesce(p_new_customer_phone, '')), '');
  v_candidates uuid[];
  v_candidate uuid;
  v_custom_duration integer;
  v_service_enabled boolean;
  v_duration integer;
  v_end timestamptz;
  v_appointment_id uuid;
  v_professional_id uuid;
  v_created boolean := false;
begin
  perform private.assert_tenant_access(p_tenant_id, false);

  if p_start_time is null then
    raise exception 'Informe o horário do agendamento.' using errcode = 'P0001';
  end if;

  select s.duration_minutes
    into v_base_duration
  from public.services s
  where s.id = p_service_id
    and s.tenant_id = p_tenant_id
    and s.is_active = true
    and s.deleted_at is null;

  if not found then
    raise exception 'Serviço não encontrado ou inativo.' using errcode = 'P0001';
  end if;

  if not v_is_fitting and p_start_time < now() then
    raise exception 'Não é possível agendar em um horário que já passou. Horários passados só como encaixe.'
      using errcode = 'P0001';
  end if;

  if v_customer_id is not null then
    perform 1
    from public.customers c
    where c.id = v_customer_id
      and c.tenant_id = p_tenant_id;

    if not found then
      raise exception 'Cliente não encontrado.' using errcode = 'P0001';
    end if;
  elsif v_new_name is not null then
    if length(regexp_replace(coalesce(v_new_phone, ''), '\D', '', 'g')) < 10 then
      raise exception 'Telefone inválido (mínimo DDD + 8 dígitos).' using errcode = 'P0001';
    end if;

    insert into public.customers (tenant_id, name, phone, registration_origin, cadastro_completo)
    values (p_tenant_id, v_new_name, v_new_phone, 'agenda', true)
    returning id into v_customer_id;
  end if;

  if v_explicit then
    v_candidates := array[p_professional_id];
  else
    select coalesce(array_agg(p.id order by p.name, p.id), '{}'::uuid[])
      into v_candidates
    from public.professionals p
    where p.tenant_id = p_tenant_id
      and p.is_active = true
      and p.deleted_at is null;
  end if;

  foreach v_candidate in array v_candidates loop
    perform 1
    from public.professionals p
    where p.id = v_candidate
      and p.tenant_id = p_tenant_id
      and p.is_active = true
      and p.deleted_at is null;

    if not found then
      if v_explicit then
        raise exception 'Profissional não encontrado ou inativo.' using errcode = 'P0001';
      end if;
      continue;
    end if;

    v_custom_duration := null;
    v_service_enabled := null;
    select ps.custom_duration_minutes, ps.is_enabled
      into v_custom_duration, v_service_enabled
    from public.professional_services ps
    where ps.professional_id = v_candidate
      and ps.service_id = p_service_id
      and ps.tenant_id = p_tenant_id;

    if v_service_enabled is false then
      if v_explicit then
        raise exception 'O profissional selecionado não executa este serviço.' using errcode = 'P0001';
      end if;
      continue;
    end if;

    v_duration := coalesce(nullif(v_custom_duration, 0), v_base_duration, 40);
    v_end := p_start_time + make_interval(mins => v_duration);

    if not v_is_fitting and exists (
      select 1
      from public.blocked_slots b
      where b.tenant_id = p_tenant_id
        and (b.professional_id = v_candidate or b.professional_id is null)
        and b.start_time < v_end
        and b.end_time > p_start_time
    ) then
      if v_explicit then
        raise exception 'O horário escolhido está bloqueado na agenda.' using errcode = 'P0001';
      end if;
      continue;
    end if;

    begin
      insert into public.appointments (
        tenant_id, customer_id, professional_id, service_id, start_time, end_time,
        status, payment_status, is_fitting, notes, origin
      ) values (
        p_tenant_id, v_customer_id, v_candidate, p_service_id, p_start_time, v_end,
        'confirmed', 'pending', v_is_fitting, nullif(btrim(coalesce(p_notes, '')), ''), 'manual'
      )
      returning id, professional_id into v_appointment_id, v_professional_id;

      v_created := true;
    exception
      when exclusion_violation then
        if v_explicit then
          raise exception 'O horário selecionado já está ocupado.' using errcode = 'P0001';
        end if;
      when sqlstate '22023' then
        -- expediente, escala ou intervalo recusados pelo gatilho existente
        if v_explicit then
          raise;
        end if;
    end;

    exit when v_created;
  end loop;

  if not v_created then
    raise exception 'Não há profissionais disponíveis para este horário.' using errcode = 'P0001';
  end if;

  if p_waiting_list_id is not null then
    update public.waiting_list
    set status = 'scheduled'
    where id = p_waiting_list_id
      and tenant_id = p_tenant_id
      and status = 'waiting';

    if not found then
      raise exception 'Esta entrada da Lista de Espera não está mais aguardando.' using errcode = 'P0001';
    end if;
  end if;

  return jsonb_build_object(
    'appointment_id', v_appointment_id,
    'tenant_id', p_tenant_id,
    'customer_id', v_customer_id,
    'professional_id', v_professional_id,
    'start_time', p_start_time,
    'end_time', v_end,
    'status', 'confirmed',
    'is_fitting', v_is_fitting
  );
end;
$function$;

revoke all on function public.create_appointment_by_manager(uuid, uuid, timestamptz, uuid, uuid, text, text, boolean, text, uuid) from public, anon;
grant execute on function public.create_appointment_by_manager(uuid, uuid, timestamptz, uuid, uuid, text, text, boolean, text, uuid) to authenticated;
