-- Ticket 16: contracao final somente onde a cobertura e comprovada.
-- FallBacks legados permanecem porque o DEV ainda possui historico estimado.
alter table public.commission_obligations
  drop constraint if exists commission_obligations_status_balance_check;
alter table public.commission_obligations
  add constraint commission_obligations_status_balance_check check (
    status = 'reversed'
    or (status = 'open' and settled_amount = 0)
    or (status = 'partially_paid' and settled_amount > 0 and settled_amount < amount)
    or (status = 'paid' and settled_amount = amount)
  );

revoke insert, update, delete on table public.commission_obligations from authenticated;
revoke insert, update, delete on table public.commission_payout_allocations from authenticated;
revoke insert, update, delete on table public.cash_session_adjustments from authenticated;
