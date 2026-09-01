begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select has_function(
  'public', 'get_daily_financial_summary', ARRAY['date', 'date', 'text', 'uuid', 'uuid'],
  'a RPC de resumo financeiro diário existe com a assinatura versionada'
);

select ok(
  has_function_privilege('authenticated', 'public.get_daily_financial_summary(date,date,text,uuid,uuid)', 'EXECUTE'),
  'usuários autenticados autorizados podem consultar o resumo'
);

select ok(
  not has_function_privilege('anon', 'public.get_daily_financial_summary(date,date,text,uuid,uuid)', 'EXECUTE'),
  'usuários anônimos não podem consultar o resumo'
);

select ok(
  position('join public.comandas c' in lower(pg_get_functiondef('public.get_daily_financial_summary(date,date,text,uuid,uuid)'::regprocedure))) > 0,
  'pagamentos são relacionados à comanda antes da agregação'
);

select ok(
  position('c.status in (''fechada'', ''closed'')' in lower(pg_get_functiondef('public.get_daily_financial_summary(date,date,text,uuid,uuid)'::regprocedure))) > 0,
  'somente comandas fechadas entram nas entradas diárias'
);

select ok(
  position('v_tenant_time_zone' in pg_get_functiondef('public.get_daily_financial_summary(date,date,text,uuid,uuid)'::regprocedure)) > 0,
  'o fuso usado no agrupamento vem do tenant'
);

select ok(
  position('set search_path to ''public'', ''extensions''' in lower(pg_get_functiondef('public.get_daily_financial_summary(date,date,text,uuid,uuid)'::regprocedure))) > 0,
  'a RPC mantém search_path fixo'
);

select * from finish();
rollback;
