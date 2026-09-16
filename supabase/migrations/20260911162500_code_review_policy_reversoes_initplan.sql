-- Evita reavaliar auth.uid() por linha na leitura da trilha de reversoes.
drop policy if exists comanda_payment_reversals_select_financial on public.comanda_payment_reversals;
create policy comanda_payment_reversals_select_financial
on public.comanda_payment_reversals for select to authenticated
using (
  (select private.is_saas_admin())
  or (
    tenant_id = (select private.get_auth_tenant_id())
    and (select private.get_auth_role()) in ('gerente', 'proprietario')
  )
);
