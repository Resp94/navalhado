-- Consultas financeiras ficam restritas aos papéis que operam o caixa.
drop policy if exists cash_movements_select_policy on public.cash_movements;
create policy cash_movements_select_policy on public.cash_movements
  for select to authenticated
  using (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) in ('gerente', 'proprietario')
    )
  );

drop policy if exists commission_payouts_select_policy on public.commission_payouts;
create policy commission_payouts_select_policy on public.commission_payouts
  for select to authenticated
  using (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) in ('gerente', 'proprietario')
    )
  );
