begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Spec 052, ticket 09: trocar cartao. A Edge Function de cobranca troca o cartao no Mercado Pago
-- (so com o token) e chama record_card_change para gravar a bandeira e o final do cartao novo,
-- que a tela Assinatura mostra. So o service_role executa.

insert into public.tenants(id, name, email, phone, slug, onboarding_completed)
values
  ('70000000-0000-0000-0000-000000000001', 'T70 A', 't70-a@test.local', '92999997001', 't70-a', true),
  ('70000000-0000-0000-0000-000000000002', 'T70 B', 't70-b@test.local', '92999997002', 't70-b', true);

delete from public.tenant_subscriptions where tenant_id in (
  '70000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002');

insert into public.tenant_subscriptions(tenant_id, plan_id, status, current_period_start, current_period_end, card_brand, card_last4, mp_subscription_id)
values ('70000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', 'visa', '5682', 'mp-70-1');
insert into public.tenant_subscriptions(tenant_id, plan_id, status, first_failed_at, card_brand, card_last4, mp_subscription_id)
values ('70000000-0000-0000-0000-000000000002', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'past_due', '2040-05-01 12:00:00+00', 'visa', '5682', 'mp-70-2');

select is(
  public.record_card_change('70000000-0000-0000-0000-000000000001', 'master', '5555'),
  true,
  'grava o cartao novo da assinatura'
);

select is(
  (select card_brand || '|' || card_last4 from public.tenant_subscriptions where tenant_id = '70000000-0000-0000-0000-000000000001'),
  'master|5555',
  'a bandeira e o final passam a ser os do cartao novo'
);

select is(
  (select status || '|' || current_period_end::text || '|' || mp_subscription_id from public.tenant_subscriptions where tenant_id = '70000000-0000-0000-0000-000000000001'),
  'active|2040-06-01 12:00:00+00|mp-70-1',
  'trocar o cartao nao mexe na situacao, no periodo pago nem na assinatura do Mercado Pago'
);

select is(
  public.record_card_change('70000000-0000-0000-0000-000000000002', 'elo', null),
  true,
  'o provedor pode nao devolver o final do cartao'
);

select is(
  (select card_brand || '|' || coalesce(card_last4, 'sem final') from public.tenant_subscriptions where tenant_id = '70000000-0000-0000-0000-000000000002'),
  'elo|sem final',
  'o final do cartao antigo nao fica ao lado da bandeira nova'
);

select is(
  (select status || '|' || first_failed_at::text from public.tenant_subscriptions where tenant_id = '70000000-0000-0000-0000-000000000002'),
  'past_due|2040-05-01 12:00:00+00',
  'com pagamento recusado, a troca do cartao nao limpa a recusa: quem tira e o pagamento aprovado'
);

-- O provedor pode nao devolver a bandeira: ela fica como estava, porque e ela que marca, em teste, o
-- cartao ja autorizado (sem ela uma cobranca recusada nao abre o prazo de 5 dias). O final antigo
-- sai, para nao ficar ao lado de um cartao que pode ser outro.
select is(
  public.record_card_change('70000000-0000-0000-0000-000000000001', null, null),
  true,
  'o provedor pode nao devolver nem a bandeira nem o final do cartao'
);

select is(
  (select coalesce(card_brand, 'sem bandeira') || '|' || coalesce(card_last4, 'sem final') from public.tenant_subscriptions where tenant_id = '70000000-0000-0000-0000-000000000001'),
  'master|sem final',
  'sem bandeira nova a bandeira que estava continua (ela marca o cartao autorizado) e o final antigo sai'
);

select is(
  public.record_card_change('70000000-0000-0000-0000-000000000099', 'visa', '1111'),
  false,
  'barbearia sem assinatura: nada a gravar'
);

select throws_ok(
  $$select public.record_card_change('70000000-0000-0000-0000-000000000001', 'visa', 'abcd')$$,
  '22023', null,
  'o final do cartao so aceita 4 digitos'
);

select throws_ok(
  $$select public.record_card_change('70000000-0000-0000-0000-000000000001', 'visa; drop table x', '1111')$$,
  '22023', null,
  'a bandeira so aceita letras, numeros e sublinhado'
);

select ok(
  has_function_privilege('service_role', 'public.record_card_change(uuid,text,text)', 'execute')
    and not has_function_privilege('anon', 'public.record_card_change(uuid,text,text)', 'execute')
    and not has_function_privilege('authenticated', 'public.record_card_change(uuid,text,text)', 'execute'),
  'so o service_role troca o cartao gravado'
);

set local role authenticated;
select throws_ok(
  $$select public.record_card_change('70000000-0000-0000-0000-000000000001', 'visa', '1111')$$,
  '42501', null,
  'o Gerente logado nao chama a funcao direto pelo front'
);
reset role;

-- Gerente sem barbearia (public.users.tenant_id nulo): a guarda e o grant, nao uma comparacao de
-- tenant que o NULL contornaria (ver o teste 32), entao ele tambem nao chama a funcao.
insert into auth.users(id, email)
values ('70000000-0000-0000-0000-0000000000a1', 't70-gerente-sem-tenant@test.local');
update public.users
set tenant_id = null, role = 'gerente', is_active = true
where id = '70000000-0000-0000-0000-0000000000a1';

select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select throws_ok(
  $$select public.record_card_change('70000000-0000-0000-0000-000000000001', 'visa', '1111')$$,
  '42501', null,
  'o Gerente sem barbearia (tenant_id nulo) tambem nao chama a funcao direto'
);
reset role;

select * from finish();
rollback;
