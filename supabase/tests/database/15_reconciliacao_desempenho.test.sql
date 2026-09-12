begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select has_table('public', 'commission_obligations', 'livro de obrigacoes presente');
select has_table('public', 'commission_payout_allocations', 'alocacoes de quitacao presentes');
select has_table('public', 'cash_session_adjustments', 'ajustes de caixa presentes');
select has_function('public', 'settle_comanda', array['uuid','uuid','uuid','uuid','numeric','numeric','uuid','jsonb','jsonb'], 'finalizacao atomica presente');
select has_function('public', 'reopen_comanda', array['uuid','uuid'], 'reabertura atomica presente');
select has_function('public', 'close_cash_session', array['uuid','uuid','numeric','text'], 'fechamento atomico presente');
select has_function('public', 'register_commission_payout', array['uuid','numeric','text','text','timestamp with time zone','uuid','uuid'], 'quitacao protegida presente');
select has_function('public', 'register_cash_session_adjustment', array['uuid','uuid','numeric','text'], 'ajuste de caixa protegido presente');
select ok((select relrowsecurity from pg_class where oid='public.commission_obligations'::regclass), 'RLS nas obrigacoes');
select ok((select relrowsecurity from pg_class where oid='public.commission_payout_allocations'::regclass), 'RLS nas alocacoes');
select ok((select relrowsecurity from pg_class where oid='public.cash_session_adjustments'::regclass), 'RLS nos ajustes');
select is((select count(*) from public.commission_payout_allocations a left join public.commission_payouts p on p.id=a.payout_id where p.id is null), 0::bigint, 'nao ha alocacoes orfas');
select is((select count(*) from public.commission_payout_allocations a left join public.commission_obligations o on o.id=a.obligation_id where o.id is null), 0::bigint, 'nao ha referencias orfas de obrigacoes');
select is((select count(*) from public.cash_session_adjustments a left join public.cash_sessions s on s.id=a.cash_session_id where s.id is null), 0::bigint, 'nao ha ajustes de caixa orfaos');

select * from finish(true);
rollback;

