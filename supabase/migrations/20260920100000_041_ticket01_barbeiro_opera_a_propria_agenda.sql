-- Spec 041, ticket 01: barbeiro opera a propria agenda no banco.
--
-- 1. cancelar, marcar falta, reagendar e criar (agendamento e encaixe) passam a aceitar o
--    barbeiro. A trava de "Agendamento do proprio profissional" ja existe em
--    private.lock_appointment_for_transition; a de barbearia, em private.assert_tenant_access.
--    Reagendar recusa troca de profissional quando quem chama e barbeiro. Criar exige o
--    profissional dele, recusa "Tanto faz" e entrada da Lista de Espera.
-- 2. O barbeiro perde a escrita direta em Agendamentos, Comandas, Itens de Comanda, produtos,
--    Lista de Espera, clientes e Associacao Profissional-Servico: a escrita passa pelas RPCs.
--    Leitura e Bloqueio de Horario proprio (blocked_slots) nao mudam.

create or replace function public.cancel_appointment_by_manager(
  p_appointment_id uuid,
  p_tenant_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_appointment public.appointments%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  v_appointment := private.lock_appointment_for_transition(p_appointment_id, p_tenant_id, true);

  if v_appointment.status not in ('pending', 'confirmed', 'in_progress') then
    raise exception 'Somente atendimentos pendentes, confirmados ou em andamento podem ser cancelados.' using errcode = 'P0001';
  end if;

  if v_reason is null then
    raise exception 'Informe o motivo do cancelamento.' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = 'canceled',
      cancellation_reason = v_reason,
      updated_at = timezone('utc'::text, now())
  where id = v_appointment.id
    and tenant_id = p_tenant_id;

  return jsonb_build_object(
    'appointment_id', v_appointment.id,
    'tenant_id', p_tenant_id,
    'status', 'canceled'
  );
end;
$function$;

create or replace function public.mark_appointment_no_show(
  p_appointment_id uuid,
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_appointment public.appointments%rowtype;
begin
  v_appointment := private.lock_appointment_for_transition(p_appointment_id, p_tenant_id, true);

  if v_appointment.status not in ('pending', 'confirmed') then
    raise exception 'Somente atendimentos pendentes ou confirmados podem ser marcados como não compareceu.' using errcode = 'P0001';
  end if;

  if v_appointment.start_time > now() then
    raise exception 'O atendimento ainda não começou.' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = 'no_show',
      updated_at = timezone('utc'::text, now())
  where id = v_appointment.id
    and tenant_id = p_tenant_id;

  return jsonb_build_object(
    'appointment_id', v_appointment.id,
    'tenant_id', p_tenant_id,
    'status', 'no_show'
  );
end;
$function$;

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
  v_role text;
begin
  v_role := private.assert_tenant_access(p_tenant_id, true);

  -- Barbeiro cria so na propria agenda: profissional obrigatorio e dele (sem "Tanto faz")
  -- e sem consumir a Lista de Espera, que e do balcao.
  if v_role = 'barbeiro' then
    if p_professional_id is null or not private.is_own_professional(p_professional_id) then
      raise exception 'Barbeiro só cria agendamento na própria agenda.' using errcode = '42501';
    end if;

    if p_waiting_list_id is not null then
      raise exception 'Barbeiro não consome a Lista de Espera.' using errcode = '42501';
    end if;
  end if;

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
      when unique_violation then
        -- limite de 1 encaixe ativo por profissional e horario (uq_appointments_one_fitting_per_slot)
        if v_explicit then
          raise exception 'Limite atingido: já existe 1 encaixe agendado para este profissional neste horário.'
            using errcode = 'P0001', hint = 'fitting_limit_reached';
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

create or replace function public.reschedule_appointment_by_manager(
  p_appointment_id uuid,
  p_tenant_id uuid,
  p_new_start_time timestamptz,
  p_new_professional_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_appointment public.appointments%rowtype;
  v_professional_id uuid;
  v_base_duration integer;
  v_custom_duration integer;
  v_service_enabled boolean;
  v_duration integer;
  v_new_end timestamptz;
begin
  v_appointment := private.lock_appointment_for_transition(p_appointment_id, p_tenant_id, true);

  -- Barbeiro reagenda so data e hora: o Agendamento continua na agenda dele.
  if private.get_auth_role() = 'barbeiro'
     and p_new_professional_id is not null
     and p_new_professional_id is distinct from v_appointment.professional_id then
    raise exception 'Barbeiro não troca o profissional do agendamento.' using errcode = '42501';
  end if;

  if v_appointment.status not in ('pending', 'confirmed') then
    raise exception 'Somente atendimentos pendentes ou confirmados podem ser reagendados.' using errcode = 'P0001';
  end if;

  if p_new_start_time is null then
    raise exception 'Informe o novo horário.' using errcode = 'P0001';
  end if;

  v_professional_id := coalesce(p_new_professional_id, v_appointment.professional_id);

  perform 1
  from public.professionals p
  where p.id = v_professional_id
    and p.tenant_id = p_tenant_id
    and p.is_active = true
    and p.deleted_at is null;

  if not found then
    raise exception 'Profissional não encontrado ou inativo.' using errcode = 'P0001';
  end if;

  select s.duration_minutes, ps.custom_duration_minutes, ps.is_enabled
    into v_base_duration, v_custom_duration, v_service_enabled
  from public.services s
  left join public.professional_services ps
    on ps.service_id = s.id
   and ps.professional_id = v_professional_id
   and ps.tenant_id = p_tenant_id
  where s.id = v_appointment.service_id
    and s.tenant_id = p_tenant_id;

  if not found then
    raise exception 'Serviço do agendamento não encontrado.' using errcode = 'P0001';
  end if;

  if v_service_enabled is false then
    raise exception 'O profissional selecionado não executa este serviço.' using errcode = 'P0001';
  end if;

  v_duration := coalesce(nullif(v_custom_duration, 0), v_base_duration, 40);
  v_new_end := p_new_start_time + make_interval(mins => v_duration);

  if not coalesce(v_appointment.is_fitting, false) then
    if p_new_start_time < now() then
      raise exception 'Não é possível reagendar para um horário que já passou.' using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from public.blocked_slots b
      where b.tenant_id = p_tenant_id
        and (b.professional_id = v_professional_id or b.professional_id is null)
        and b.start_time < v_new_end
        and b.end_time > p_new_start_time
    ) then
      raise exception 'O horário escolhido está bloqueado na agenda.' using errcode = 'P0001';
    end if;
  end if;

  begin
    update public.appointments
    set start_time = p_new_start_time,
        end_time = v_new_end,
        professional_id = v_professional_id,
        reminder_sent = false,
        updated_at = timezone('utc'::text, now())
    where id = v_appointment.id
      and tenant_id = p_tenant_id;
  exception
    when exclusion_violation then
      raise exception 'O horário selecionado já está ocupado.' using errcode = 'P0001';
    when unique_violation then
      raise exception 'Limite atingido: já existe 1 encaixe agendado para este profissional neste horário.'
        using errcode = 'P0001', hint = 'fitting_limit_reached';
  end;

  return jsonb_build_object(
    'appointment_id', v_appointment.id,
    'tenant_id', p_tenant_id,
    'status', v_appointment.status,
    'start_time', p_new_start_time,
    'end_time', v_new_end,
    'professional_id', v_professional_id
  );
end;
$function$;

revoke all on function public.cancel_appointment_by_manager(uuid, uuid, text) from public, anon;
grant execute on function public.cancel_appointment_by_manager(uuid, uuid, text) to authenticated;

revoke all on function public.mark_appointment_no_show(uuid, uuid) from public, anon;
grant execute on function public.mark_appointment_no_show(uuid, uuid) to authenticated;

revoke all on function public.create_appointment_by_manager(uuid, uuid, timestamptz, uuid, uuid, text, text, boolean, text, uuid) from public, anon;
grant execute on function public.create_appointment_by_manager(uuid, uuid, timestamptz, uuid, uuid, text, text, boolean, text, uuid) to authenticated;

revoke all on function public.reschedule_appointment_by_manager(uuid, uuid, timestamptz, uuid) from public, anon;
grant execute on function public.reschedule_appointment_by_manager(uuid, uuid, timestamptz, uuid) to authenticated;

-- Escrita direta: so gerente e admin SaaS. O gatilho que cria/cancela a Comanda do Agendamento
-- e security definer e continua valendo quando a escrita vem das RPCs.

alter policy appointments_insert_policy on public.appointments
  with check (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) = 'gerente'
    )
  );

alter policy appointments_update_policy on public.appointments
  using (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) = 'gerente'
    )
  )
  with check (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) = 'gerente'
    )
  );

alter policy comandas_insert_active_operator on public.comandas
  with check (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) = any (array['gerente'::text, 'proprietario'::text])
    )
  );

alter policy comandas_update_open_operator on public.comandas
  using (
    status = any (array['aberta'::text, 'open'::text])
    and (
      (select private.is_saas_admin())
      or (
        tenant_id = (select private.get_auth_tenant_id())
        and (select private.get_auth_role()) = any (array['gerente'::text, 'proprietario'::text])
      )
    )
  )
  with check (
    status = any (array['aberta'::text, 'open'::text, 'cancelada'::text])
    and (
      (select private.is_saas_admin())
      or (
        tenant_id = (select private.get_auth_tenant_id())
        and (select private.get_auth_role()) = any (array['gerente'::text, 'proprietario'::text])
      )
    )
  );

alter policy comanda_itens_insert_open_operator on public.comanda_itens
  with check (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) = any (array['gerente'::text, 'proprietario'::text])
      and exists (
        select 1 from public.comandas c
        where c.id = comanda_itens.comanda_id
          and c.tenant_id = comanda_itens.tenant_id
          and c.status = any (array['aberta'::text, 'open'::text])
      )
    )
  );

alter policy comanda_itens_update_open_operator on public.comanda_itens
  using (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) = any (array['gerente'::text, 'proprietario'::text])
      and exists (
        select 1 from public.comandas c
        where c.id = comanda_itens.comanda_id
          and c.tenant_id = comanda_itens.tenant_id
          and c.status = any (array['aberta'::text, 'open'::text])
      )
    )
  )
  with check (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) = any (array['gerente'::text, 'proprietario'::text])
      and exists (
        select 1 from public.comandas c
        where c.id = comanda_itens.comanda_id
          and c.tenant_id = comanda_itens.tenant_id
          and c.status = any (array['aberta'::text, 'open'::text])
      )
    )
  );

alter policy products_update_policy on public.products
  using (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) = 'gerente'
    )
  )
  with check (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) = 'gerente'
    )
  );

alter policy waiting_list_insert_policy on public.waiting_list
  with check (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) = 'gerente'
    )
  );

alter policy waiting_list_update_policy on public.waiting_list
  using (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) = 'gerente'
    )
  )
  with check (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) = 'gerente'
    )
  );

-- customers e professional_services eram escritos por qualquer usuario da barbearia, sem
-- olhar o papel.
alter policy customers_insert_policy on public.customers
  with check (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) = 'gerente'
    )
  );

alter policy customers_update_policy on public.customers
  using (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) = 'gerente'
    )
  );

alter policy prof_services_insert_policy on public.professional_services
  with check (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) = 'gerente'
    )
  );

alter policy prof_services_update_policy on public.professional_services
  using (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) = 'gerente'
    )
  )
  with check (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) = 'gerente'
    )
  );

alter policy prof_services_delete_policy on public.professional_services
  using (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) = 'gerente'
    )
  );
