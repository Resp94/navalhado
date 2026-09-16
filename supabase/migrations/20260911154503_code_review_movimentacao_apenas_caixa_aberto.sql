-- Movimentacoes manuais somente podem entrar na sessao aberta do proprio
-- tenant; isso impede alterar o ledger depois do snapshot de fechamento.
drop policy if exists cash_movements_insert_policy on public.cash_movements;
create policy cash_movements_insert_policy on public.cash_movements
  for insert to authenticated
  with check (
    tenant_id = (select private.get_auth_tenant_id())
    and (select private.get_auth_role()) in ('gerente', 'proprietario')
    and exists (
      select 1
      from public.cash_sessions cs
      where cs.id = cash_movements.cash_session_id
        and cs.tenant_id = cash_movements.tenant_id
        and cs.status = 'open'
    )
  );
