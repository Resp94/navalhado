begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select ok(exists(select 1 from pg_constraint where conrelid='public.commission_obligations'::regclass and conname='commission_obligations_status_balance_check'), 'aplica consistencia final entre status e saldo');
select is((select count(*) from information_schema.role_table_grants where table_schema='public' and table_name='commission_obligations' and grantee='authenticated' and privilege_type in ('INSERT','UPDATE','DELETE')),0::bigint,'mantem escrita das obrigacoes apenas por RPC');
select is((select count(*) from information_schema.role_table_grants where table_schema='public' and table_name='commission_payout_allocations' and grantee='authenticated' and privilege_type in ('INSERT','UPDATE','DELETE')),0::bigint,'mantem escrita das alocacoes apenas por RPC');
select is((select count(*) from information_schema.role_table_grants where table_schema='public' and table_name='cash_session_adjustments' and grantee='authenticated' and privilege_type in ('INSERT','UPDATE','DELETE')),0::bigint,'mantem escrita dos ajustes apenas por RPC');
select ok((select count(*) from public.comanda_itens where snapshot_status='estimated') >= 1, 'preserva historico legado explicitamente estimado');
select ok(pg_get_functiondef('public.get_tenant_financial_metrics(timestamptz,timestamptz,uuid)'::regprocedure) like '%snapshot_status = ''confirmed''%', 'metricas ainda distinguem snapshot confirmado');
select has_function('public','backfill_financial_history',array['uuid','integer'],'backfill continua disponivel para lotes futuros');
select has_function('public','get_professional_commission_balance',array['uuid','timestamp with time zone','timestamp with time zone','uuid'],'contrato de saldo continua disponivel');
select ok(exists(select 1 from pg_trigger where tgname='trg_create_commission_obligations'), 'geracao atomica de obrigacoes continua ativa');
select ok(exists(select 1 from pg_proc where proname='register_cash_session_adjustment'), 'ajuste de caixa continua protegido por RPC');

select * from finish(true);
rollback;

