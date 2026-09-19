-- Spec 040, ticket 04: iniciar atendimento por RPC.
--
-- O ciclo de vida do Agendamento do gestor e do barbeiro passa a ser decidido no
-- banco. private.lock_appointment_for_transition concentra o que toda transicao
-- de estado confere (autenticacao, papel, unidade, dono do agendamento) e trava a
-- linha; cada RPC so decide o estado de origem e o destino. Os tickets 05 (cancelar)
-- e 06 (marcar falta) reusam o mesmo helper.

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
  v_user_id uuid := (select auth.uid());
  v_user_role text;
  v_user_tenant uuid;
  v_appointment public.appointments%rowtype;
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

create or replace function public.start_appointment_service(
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
    raise exception 'Somente atendimentos pendentes ou confirmados podem ser iniciados.' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = 'in_progress',
      updated_at = timezone('utc'::text, now())
  where id = v_appointment.id
    and tenant_id = p_tenant_id;

  return jsonb_build_object(
    'appointment_id', v_appointment.id,
    'tenant_id', p_tenant_id,
    'status', 'in_progress'
  );
end;
$function$;

revoke all on function public.start_appointment_service(uuid, uuid) from public, anon;
grant execute on function public.start_appointment_service(uuid, uuid) to authenticated;
