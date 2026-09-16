-- Cancelamento administrativo de agendamento e comanda em uma unica
-- transacao, preservando o comportamento atual dos status.
create or replace function public.cancel_comanda_appointment(
  p_comanda_id uuid default null,
  p_appointment_id uuid default null,
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_comanda public.comandas%rowtype;
  v_appointment public.appointments%rowtype;
begin
  if v_user_id is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  select u.role, u.tenant_id
    into v_user_role, v_user_tenant
  from public.users u
  where u.id = v_user_id
    and u.is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado para cancelar atendimento.' using errcode = '42501';
  end if;

  v_target_tenant := coalesce(p_tenant_id, v_user_tenant);
  if v_target_tenant is null then
    raise exception 'Unidade nao informada.' using errcode = '22023';
  end if;
  if v_user_role <> 'proprietario' and v_user_tenant <> v_target_tenant then
    raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
  end if;
  if p_comanda_id is null and p_appointment_id is null then
    raise exception 'Comanda ou agendamento deve ser informado.' using errcode = '22023';
  end if;

  if p_comanda_id is not null then
    select * into v_comanda
    from public.comandas
    where id = p_comanda_id
      and tenant_id = v_target_tenant
    for update;

    if not found or v_comanda.status not in ('aberta', 'open') then
      raise exception 'A comanda nao existe ou nao esta aberta.' using errcode = 'P0001';
    end if;
    if p_appointment_id is not null
       and v_comanda.appointment_id is not null
       and v_comanda.appointment_id <> p_appointment_id then
      raise exception 'Comanda e agendamento nao pertencem ao mesmo atendimento.' using errcode = '22023';
    end if;
  end if;

  if p_appointment_id is not null then
    select * into v_appointment
    from public.appointments
    where id = p_appointment_id
      and tenant_id = v_target_tenant
    for update;

    if not found then
      raise exception 'Agendamento nao encontrado.' using errcode = 'P0001';
    end if;
  end if;

  if p_comanda_id is not null then
    update public.comandas
    set status = 'cancelada',
        closed_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    where id = p_comanda_id
      and tenant_id = v_target_tenant;
  end if;

  if p_appointment_id is not null then
    update public.appointments
    set status = 'canceled',
        updated_at = timezone('utc'::text, now())
    where id = p_appointment_id
      and tenant_id = v_target_tenant;
  end if;

  return jsonb_build_object(
    'tenant_id', v_target_tenant,
    'comanda_id', p_comanda_id,
    'appointment_id', p_appointment_id,
    'status', 'canceled'
  );
end;
$$;

revoke all on function public.cancel_comanda_appointment(uuid, uuid, uuid) from public, anon;
grant execute on function public.cancel_comanda_appointment(uuid, uuid, uuid) to authenticated;
