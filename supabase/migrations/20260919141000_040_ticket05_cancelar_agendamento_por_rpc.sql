-- Spec 040, ticket 05: cancelar Agendamento por RPC.
--
-- O gestor cancela informando o motivo (obrigatorio, gravado em cancellation_reason).
-- So pending, confirmed e in_progress podem ser cancelados. A Comanda aberta e
-- cancelada pelo gatilho trg_auto_cancel_comanda_on_appointment_cancel na mesma
-- transacao. Barbeiro nao cancela.

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
  v_appointment := private.lock_appointment_for_transition(p_appointment_id, p_tenant_id, false);

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

revoke all on function public.cancel_appointment_by_manager(uuid, uuid, text) from public, anon;
grant execute on function public.cancel_appointment_by_manager(uuid, uuid, text) to authenticated;
