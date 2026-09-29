-- Spec 052, ticket 04: o descarte por bloqueio vai para o livro de idempotencia por uma
-- funcao so, em vez de um INSERT que a Edge Function tenta e ignora quando a chave existe.
--
-- 1. Descartado e definitivo. Se a chave ja existe como failed (falha retentavel), a linha
--    passa a discarded: sem isso, o desbloqueio deixaria o livro reclamar a linha failed e
--    enviar a mensagem velha. Falha permanente do provedor, enviado e descartado ficam como
--    estao.
-- 2. Sem erro de chave duplicada. Uma barbearia bloqueada e reexaminada a cada rodada de
--    lembretes; a chave ja existe a partir da segunda, e o ON CONFLICT DO NOTHING (sem alvo,
--    cobre todos os indices unicos do livro) evita um 23505 por agendamento por rodada.

create or replace function public.register_whatsapp_message_discard(
  p_tenant_id uuid,
  p_instance_id uuid,
  p_direction text,
  p_event_type text,
  p_idempotency_key text,
  p_appointment_id uuid,
  p_reminder_window text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  update public.whatsapp_message_idempotency
  set status = 'discarded',
      last_error = left(coalesce(p_reason, 'discarded'), 500),
      completed_at = now(),
      updated_at = now()
  where tenant_id = p_tenant_id
    and direction = p_direction
    and idempotency_key = p_idempotency_key
    and status = 'failed'
    and coalesce(last_error, '') not like 'permanent provider error%';

  if found then
    return;
  end if;

  insert into public.whatsapp_message_idempotency(
    tenant_id, whatsapp_instance_id, direction, event_type, idempotency_key,
    appointment_id, reminder_window, status, attempt_count, last_error, completed_at
  ) values (
    p_tenant_id, p_instance_id, p_direction, p_event_type, p_idempotency_key,
    p_appointment_id, p_reminder_window, 'discarded', 0, left(coalesce(p_reason, 'discarded'), 500), now()
  )
  on conflict do nothing;
end;
$function$;

revoke all on function public.register_whatsapp_message_discard(uuid, uuid, text, text, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.register_whatsapp_message_discard(uuid, uuid, text, text, text, uuid, text, text) to service_role;
