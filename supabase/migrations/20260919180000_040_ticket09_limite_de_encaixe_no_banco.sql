-- Spec 040, ticket 09: no maximo um encaixe ativo por profissional e horario, no banco.
--
-- Antes, so a tela conferia o limite (contra os agendamentos que ela tinha carregado), e o
-- encaixe fica fora da constraint de exclusao appointments_no_professional_overlap
-- (WHERE is_fitting = false). O indice unico parcial e a protecao contra corrida: duas
-- recepcoes criando ao mesmo tempo nao passam, o banco serializa. "Horario" e o inicio
-- exato do encaixe; encaixes do mesmo profissional em inicios diferentes continuam livres,
-- e um agendamento normal no mesmo horario de um encaixe continua permitido.
--
-- create_appointment_by_manager traduz a violacao: com profissional explicito, mensagem
-- propria; com "Tanto faz", passa para o proximo profissional (o limite vale sobre o
-- profissional ja resolvido). reschedule_appointment_by_manager traduz do mesmo jeito.
--
-- A migration para com a lista se ja existir duplicata, sem apagar nada.

do $$
declare
  v_duplicates text;
begin
  select string_agg(professional_id::text || ' @ ' || start_time::text || ' (' || total || ')', ', ')
    into v_duplicates
  from (
    select professional_id, start_time, count(*) as total
    from public.appointments
    where is_fitting = true
      and status in ('pending', 'confirmed', 'in_progress')
    group by professional_id, start_time
    having count(*) > 1
  ) d;

  if v_duplicates is not null then
    raise exception 'Existem encaixes ativos duplicados no mesmo profissional e horario: %. Resolva antes de aplicar.', v_duplicates
      using errcode = 'P0001';
  end if;
end;
$$;

create unique index if not exists uq_appointments_one_fitting_per_slot
  on public.appointments (professional_id, start_time)
  where is_fitting = true and status in ('pending', 'confirmed', 'in_progress');

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
  v_appointment := private.lock_appointment_for_transition(p_appointment_id, p_tenant_id, false);

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

revoke all on function public.create_appointment_by_manager(uuid, uuid, timestamptz, uuid, uuid, text, text, boolean, text, uuid) from public, anon;
grant execute on function public.create_appointment_by_manager(uuid, uuid, timestamptz, uuid, uuid, text, text, boolean, text, uuid) to authenticated;

revoke all on function public.reschedule_appointment_by_manager(uuid, uuid, timestamptz, uuid) from public, anon;
grant execute on function public.reschedule_appointment_by_manager(uuid, uuid, timestamptz, uuid) to authenticated;
