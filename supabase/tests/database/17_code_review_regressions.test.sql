begin;
select plan(17);

select has_function(
  'public',
  'settle_comanda_idempotent',
  array['uuid','uuid','uuid','uuid','uuid','numeric','numeric','uuid','jsonb','jsonb'],
  'checkout possui comando idempotente versionado'
);

select is(
  (select count(*) from pg_policies
   where schemaname = 'public'
     and tablename in ('cash_sessions','comandas','comanda_itens','comanda_pagamentos')
     and policyname in (
       'Users can manage cash_sessions in their tenant',
       'Users can manage comandas in their tenant',
       'Users can manage comanda_itens in their tenant',
       'Users can manage comanda_pagamentos in their tenant'
     )),
  0::bigint,
  'policies legadas permissivas foram removidas'
);

select is(
  (select count(*) from pg_policies
   where schemaname = 'public'
     and policyname in ('cash_movements_select_policy', 'commission_payouts_select_policy')
     and position('get_auth_role' in coalesce(qual, '')) > 0),
  2::bigint,
  'lancamentos financeiros exigem papel autorizado'
);

select ok(
  position('SET search_path = ' in pg_get_functiondef(
    'public.settle_comanda_idempotent(uuid,uuid,uuid,uuid,uuid,numeric,numeric,uuid,jsonb,jsonb)'::regprocedure
  )) > 0,
  'funcoes financeiras usam search_path vazio'
);

select ok(
  position('is_active = true' in pg_get_functiondef('public.get_tenant_financial_metrics(timestamptz,timestamptz,uuid)'::regprocedure)) > 0,
  'metricas rejeitam usuario inativo'
);

select has_column('public', 'commission_payouts', 'legacy_allocated_amount', 'payout preserva parcela legada aplicada');
select has_table('public', 'comanda_payment_reversals', 'pagamentos revertidos possuem trilha');
select has_column('public', 'product_movements', 'reversed_at', 'movimentos de venda podem ser marcados como revertidos');

select ok(
  position('sum(adjustment_amount)' in pg_get_functiondef('public.register_cash_session_adjustment(uuid,uuid,numeric,text)'::regprocedure)) > 0,
  'ajustes posteriores acumulam a posicao anterior'
);

select ok(
  position('comanda_payment_reversals' in pg_get_functiondef('public.reopen_comanda(uuid,uuid)'::regprocedure)) > 0,
  'reabertura registra reversao de pagamento'
);

select ok(
  position('cs.status = ''closed''' in pg_get_functiondef('public.reopen_comanda(uuid,uuid)'::regprocedure)) > 0,
  'reabertura nao altera pagamentos de caixa fechado'
);

select ok(
  position('reversed_at is null' in pg_get_functiondef('public.reopen_comanda(uuid,uuid)'::regprocedure)) > 0,
  'reabertura seleciona somente movimentos de venda ativos'
);

select ok(
  position('snapshot_status in (''confirmed'', ''estimated'')' in pg_get_functiondef('public.get_tenant_financial_metrics(timestamptz,timestamptz,uuid)'::regprocedure)) > 0,
  'metricas usam snapshot estimado sem recalcular cadastro atual'
);

select ok(
  position('estimated_comandas_count' in pg_get_functiondef('public.get_tenant_financial_metrics(timestamptz,timestamptz,uuid)'::regprocedure)) > 0,
  'metricas distinguem comanda estimada de legado'
);

select ok(
  position('get_tenant_current_commission_balance' in pg_get_functiondef('public.get_tenant_financial_metrics(timestamptz,timestamptz,uuid)'::regprocedure)) > 0,
  'dashboard usa saldo acumulado independente do filtro'
);

select ok(
  position('legacy_allocated_amount' in pg_get_functiondef('public.register_commission_payout(uuid,numeric,text,text,timestamptz,uuid)'::regprocedure)) > 0,
  'quitacao registra a parcela legada de payout misto'
);

select ok(
  position('p_operation_id' in pg_get_functiondef('public.settle_comanda_idempotent(uuid,uuid,uuid,uuid,uuid,numeric,numeric,uuid,jsonb,jsonb)'::regprocedure)) > 0,
  'checkout separa id da operacao do id da comanda'
);

select * from finish();
rollback;
