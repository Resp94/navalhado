begin;
select plan(26);

select has_function(
  'public',
  'settle_comanda_idempotent',
  array['uuid','uuid','uuid','uuid','uuid','numeric','numeric','uuid','jsonb','jsonb','uuid','numeric'],
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
  position('SET search_path TO ' in pg_get_functiondef(
    'public.settle_comanda_idempotent(uuid,uuid,uuid,uuid,uuid,numeric,numeric,uuid,jsonb,jsonb,uuid,numeric)'::regprocedure
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
  position('legacy_allocated_amount' in pg_get_functiondef('public.register_commission_payout(uuid,numeric,text,text,timestamptz,uuid,uuid,numeric,numeric)'::regprocedure)) > 0,
  'quitacao registra a parcela legada de payout misto'
);

select ok(
  position('p_operation_id' in pg_get_functiondef('public.settle_comanda_idempotent(uuid,uuid,uuid,uuid,uuid,numeric,numeric,uuid,jsonb,jsonb,uuid,numeric)'::regprocedure)) > 0,
  'checkout separa id da operacao do id da comanda'
);

select has_function(
  'public',
  'validate_closed_comanda_payment_total',
  array[]::text[],
  'fechamento rejeita divergencia de centavos'
);

select ok(
  position('v_user_role = ''barbeiro''' in pg_get_functiondef('public.get_professional_commission_balance(uuid,timestamptz,timestamptz,uuid)'::regprocedure)) > 0,
  'profissional pode consultar o proprio extrato'
);

select ok(
  position('snapshot_status = ''unavailable'' and ci.total_price is not null' in pg_get_functiondef('public.get_tenant_financial_metrics(timestamptz,timestamptz,uuid)'::regprocedure)) > 0,
  'metricas preservam receita legada disponivel sem consultar cadastro atual'
);

select ok(
  position('snapshot_status is distinct from ''reverted''' in pg_get_functiondef('public.reopen_comanda(uuid,uuid)'::regprocedure)) > 0,
  'reabertura revoga snapshots estimados e indisponiveis'
);

select ok(
  position('professional_service' in pg_get_functiondef('public.backfill_financial_history(uuid,integer)'::regprocedure)) > 0,
  'backfill registra a origem efetiva da regra de comissao'
);

-- Ticket 04/036 (contract): a politica de insercao direta foi removida e a
-- permissao de INSERT revogada de authenticated (ver 03_restringir_operacoes_
-- financeiras_estoque); a garantia de "so em sessao aberta" agora vive
-- exclusivamente na RPC register_cash_movement, provada aqui em comportamento.
do $$
declare
  v_tenant_id uuid;
  v_user_id uuid;
  v_session_id uuid;
begin
  insert into public.tenants (name, email, phone)
  values ('__ticket17_ctx__', '__ticket17_ctx__@teste.com', '11999999999')
  returning id into v_tenant_id;

  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket17_ctx__auth@teste.com')
  returning id into v_user_id;

  update public.users
  set tenant_id = v_tenant_id, role = 'gerente', is_active = true
  where id = v_user_id;

  insert into public.cash_sessions (tenant_id, opened_by, closed_by, initial_amount, status, closed_at)
  values (v_tenant_id, v_user_id, v_user_id, 0, 'closed', timezone('utc'::text, now()))
  returning id into v_session_id;

  create temporary table ticket17_movimento_fechado_ctx (tenant_id uuid, user_id uuid, session_id uuid) on commit drop;
  insert into ticket17_movimento_fechado_ctx values (v_tenant_id, v_user_id, v_session_id);
  grant select on ticket17_movimento_fechado_ctx to authenticated;
end;
$$;

select set_config('request.jwt.claim.sub', (select user_id::text from ticket17_movimento_fechado_ctx), true);
set local role authenticated;

select throws_ok(
  $$select public.register_cash_movement(
    (select session_id from ticket17_movimento_fechado_ctx),
    (select tenant_id from ticket17_movimento_fechado_ctx),
    'sangria', 10, 'movimentacao em sessao fechada'
  )$$,
  'P0001',
  'A sessão de caixa não está aberta ou não existe.',
  'movimentacao manual exige sessao de caixa aberta (garantida pela RPC, nao mais pela politica)'
);

reset role;

-- Spec 044, ticket 07 acrescentou p_reason (quarto parametro) para gravar o Motivo de Cancelamento.
select has_function(
  'public',
  'cancel_comanda_appointment',
  array['uuid', 'uuid', 'uuid', 'text'],
  'cancelamento administrativo possui comando transacional'
);

select ok(
  position('status = ''cancelada''' in pg_get_functiondef('public.cancel_comanda_appointment(uuid,uuid,uuid,text)'::regprocedure)) > 0
  and position('status = ''canceled''' in pg_get_functiondef('public.cancel_comanda_appointment(uuid,uuid,uuid,text)'::regprocedure)) > 0,
  'cancelamento atomico atualiza comanda e agendamento no mesmo comando'
);

select ok(
  position('get_auth_role' in (
    select qual from pg_policies
    where schemaname = 'public'
      and tablename = 'comanda_payment_reversals'
      and policyname = 'comanda_payment_reversals_select_financial'
  )) > 0,
  'trilha de reversoes usa helper de autenticacao otimizado'
);

select * from finish(true);
rollback;
