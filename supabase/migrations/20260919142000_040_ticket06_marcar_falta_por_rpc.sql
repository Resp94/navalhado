-- Spec 040, ticket 06: marcar falta (no-show) por RPC.
--
-- So pending e confirmed, e so depois do horario de inicio pelo relogio do banco.
-- A Comanda aberta do Agendamento com falta e cancelada pelo gatilho
-- trg_auto_cancel_comanda_on_appointment_cancel (que ja cobre 'canceled' e
-- 'no_show') na mesma transacao, como o modal de confirmacao promete. Barbeiro
-- nao marca falta.

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
  v_appointment := private.lock_appointment_for_transition(p_appointment_id, p_tenant_id, false);

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

revoke all on function public.mark_appointment_no_show(uuid, uuid) from public, anon;
grant execute on function public.mark_appointment_no_show(uuid, uuid) to authenticated;
