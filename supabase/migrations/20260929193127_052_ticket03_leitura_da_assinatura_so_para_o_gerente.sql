-- Spec 052, ticket 03 (revisao): a leitura direta de tenant_subscriptions passa a ser so do
-- Gerente da barbearia e do Proprietario.
--
-- A linha da assinatura guarda bandeira e final do cartao e o id da assinatura no Mercado
-- Pago. O Barbeiro nao precisa disso: o porteiro dele usa a RPC get_my_access_state, que
-- devolve so o Estado de Acesso. Nenhuma tela do Barbeiro le a tabela. As funcoes
-- SECURITY DEFINER (limite de profissionais, estado de acesso, rotina diaria) nao passam
-- pela RLS e continuam funcionando. Escrever continua sendo so do Proprietario.

drop policy if exists subscriptions_select_policy on public.tenant_subscriptions;

create policy subscriptions_select_policy
  on public.tenant_subscriptions
  for select
  to authenticated
  using (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) = 'gerente'
    )
  );
