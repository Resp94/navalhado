begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

create temporary table ticket13_context (user_id uuid, tenant_id uuid, session_id uuid, original_closing numeric, original_expected numeric) on commit drop;

-- Contexto sintetico: nao depende de linhas preexistentes do DEV.
with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket13_ctx__', '__ticket13_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket13_ctx__auth@teste.com')
  returning id
)
insert into ticket13_context
select au.id, t.id, gen_random_uuid(), 90, 100
from t, au;

update public.users
set tenant_id = (select tenant_id from ticket13_context), role = 'gerente', is_active = true
where id = (select user_id from ticket13_context);

grant select on ticket13_context to authenticated;

select ok((select count(*) from ticket13_context) = 1, 'encontra sessao fechada com fotografia completa');
select has_table('public', 'cash_session_adjustments', 'tabela de ajustes existe');
select has_function('public', 'register_cash_session_adjustment', array['uuid','uuid','numeric','text'], 'RPC de ajuste existe');

reset role;
insert into public.cash_sessions (
  id, tenant_id, opened_by, closed_by, opened_at, closed_at,
  initial_amount, closing_amount, expected_amount, difference_amount, status
)
select session_id, tenant_id, user_id,
  user_id, timezone('utc'::text, now()) - interval '1 hour', timezone('utc'::text, now()),
  100, original_closing, original_expected, original_closing - original_expected, 'closed'
from ticket13_context;

select set_config('request.jwt.claim.sub', (select user_id::text from ticket13_context), false);
set local role authenticated;
select lives_ok(
  $$select public.register_cash_session_adjustment((select session_id from ticket13_context), (select tenant_id from ticket13_context), 5, 'Diferenca conferida')$$,
  'registra ajuste posterior em sessao fechada'
);
select is((select count(*) from public.cash_session_adjustments where cash_session_id = (select session_id from ticket13_context)), 1::bigint, 'mantem evento separado por sessao');
select is((select original_expected_amount from public.cash_session_adjustments where cash_session_id = (select session_id from ticket13_context)), (select original_expected from ticket13_context), 'preserva esperado original');
select is((select original_closing_amount from public.cash_session_adjustments where cash_session_id = (select session_id from ticket13_context)), (select original_closing from ticket13_context), 'preserva contado original');
select is((select adjusted_closing_amount from public.cash_session_adjustments where cash_session_id = (select session_id from ticket13_context)), (select original_closing + 5 from ticket13_context), 'calcula contado ajustado sem sobrescrever a sessao');
select is((select closing_amount from public.cash_sessions where id = (select session_id from ticket13_context)), (select original_closing from ticket13_context), 'mantem fechamento original imutavel');
select throws_ok(
  $$select public.register_cash_session_adjustment((select session_id from ticket13_context), (select tenant_id from ticket13_context), 1, 'x')$$,
  '22023',
  'Informe uma justificativa com pelo menos cinco caracteres.',
  'exige justificativa para novo ajuste'
);
select is((select count(*) from information_schema.role_table_grants where table_schema='public' and table_name='cash_session_adjustments' and grantee='authenticated' and privilege_type='SELECT'), 1::bigint, 'authenticated possui somente leitura direta');
select is((select count(*) from information_schema.role_table_grants where table_schema='public' and table_name='cash_session_adjustments' and grantee='authenticated' and privilege_type in ('INSERT','UPDATE','DELETE')), 0::bigint, 'nao permite escrita direta de eventos auditaveis');
select * from finish(true);
rollback;


