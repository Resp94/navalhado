-- Spec 040, ticket 11: reagendar Agendamento por RPC (gerente e proprietario).
--
-- So pending e confirmed podem ser reagendados. O fim e recalculado pela duracao do
-- novo profissional (Associacao Profissional-Servico) ou, na falta dela, pela duracao
-- do servico. Nao se reagenda para horario que ja passou, exceto encaixe.
--
-- Conflito com outro agendamento ativo do profissional (constraint de exclusao
-- appointments_no_professional_overlap) e expediente, escala e intervalo (gatilho
-- private.validate_appointment_schedule_boundaries) ja sao impostos pelo banco no
-- UPDATE: a RPC reaproveita esses dois em vez de copiar a regra, so traduzindo a
-- violacao de exclusao para uma mensagem de dominio. O Bloqueio de Horario nao tinha
-- guarda no banco para o gestor e e conferido aqui. O Evento de Agendamento continua
-- saindo pelo gatilho trg_appointment_whatsapp (start_time e professional_id).

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

revoke all on function public.reschedule_appointment_by_manager(uuid, uuid, timestamptz, uuid) from public, anon;
grant execute on function public.reschedule_appointment_by_manager(uuid, uuid, timestamptz, uuid) to authenticated;
