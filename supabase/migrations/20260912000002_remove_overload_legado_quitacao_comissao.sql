-- A migration anterior acrescentou p_cash_session_id como parametro extra
-- via CREATE OR REPLACE, mas por ter um argumento a mais o Postgres criou uma
-- nova sobrecarga em vez de substituir a funcao existente: o overload antigo
-- de 6 parametros continuou no catalogo, e o novo overload de 7 parametros
-- nasceu sem as revogacoes de PUBLIC/anon que os demais RPCs financeiros tem.
-- Remove o overload legado e alinha os grants do overload atual ao padrao.

drop function if exists public.register_commission_payout(uuid, numeric, text, text, timestamptz, uuid);

revoke all on function public.register_commission_payout(uuid, numeric, text, text, timestamptz, uuid, uuid) from public;
revoke all on function public.register_commission_payout(uuid, numeric, text, text, timestamptz, uuid, uuid) from anon;
grant execute on function public.register_commission_payout(uuid, numeric, text, text, timestamptz, uuid, uuid) to authenticated;
grant execute on function public.register_commission_payout(uuid, numeric, text, text, timestamptz, uuid, uuid) to service_role;
