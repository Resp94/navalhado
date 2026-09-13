-- Ticket 01 da spec 036 (expand): apuracao unica do valor esperado da gaveta.
--
-- Spec: specs/036-contas-a-pagar/spec.md, secao "Entrega 1 - Apuracao unica do
-- valor esperado da gaveta". ADR prevista: docs/adr/020, escrita no ticket 06 da
-- mesma spec, que registra entre outros pontos a apuracao unica do valor esperado
-- da gaveta com sentido materializado no movimento de caixa.
--
-- Motivo: close_cash_session, register_commission_payout e
-- register_professional_advance copiavam a mesma formula e filtravam
-- cash_movements pelo nome do tipo. A spec 034 pagou esse preco ao incluir o
-- vale (tres funcoes editadas sob risco de saldo errado silencioso). Aqui:
--
--   1. cash_movements ganha a coluna gerada, armazenada e obrigatoria
--      "direction" ('entrada' | 'saida'), derivada do tipo por CASE SEM ramo
--      padrao: um tipo novo aceito pela restricao de tipo sem sentido declarado
--      falha na primeira insercao (not null), em vez de sair da gaveta sem ser
--      subtraido.
--   2. private.compute_cash_session_expected_amount e o unico ponto que apura o
--      valor esperado: fundo + dinheiro recebido de Comanda + entradas - saidas,
--      so movimentos nao estornados. Total e detalhamento por tipo saem da mesma
--      agregacao. Nao autoriza nada: pressupoe papel, tenant e lock validados
--      por quem chama.
--   3. As tres funcoes passam a consumir a funcao privada, sem mudar assinatura,
--      mensagens de erro, chaves de retorno nem a versao de calculo gravada
--      ('cash_expected_v3'): o numero nao muda.
--   4. public.get_cash_session_expected_amount e o contrato de leitura da previa
--      (consumido pela tela no ticket 02), revalidando papel e tenant.
--
-- Saida identica e regra de estorno: antes, suprimento e sangria entravam na soma
-- sem olhar reversed_at. Nenhuma funcao estorna suprimento ou sangria e o papel
-- authenticated nao tem UPDATE em cash_movements, entao filtrar todos os tipos
-- por reversed_at is null preserva todos os resultados atuais.
--
-- Backfill: a coluna gerada e armazenada e calculada para todas as linhas
-- existentes na propria reescrita da tabela feita por este ALTER TABLE, e o
-- NOT NULL e verificado nesse momento. Todos os tipos hoje aceitos pela
-- cash_movements_type_check tem sentido declarado, entao nenhuma linha falha.

-- -----------------------------------------------------------------------------
-- 1. Sentido materializado do movimento de caixa
-- -----------------------------------------------------------------------------
-- Sem "if not exists": se a coluna ja existir com outra definicao, a migration
-- falha em vez de deixar o banco sem a garantia de sentido obrigatorio.
alter table public.cash_movements
  add column direction text
    generated always as (
      case type
        when 'suprimento' then 'entrada'
        when 'sangria' then 'saida'
        when 'repasse_comissao' then 'saida'
        when 'vale_profissional' then 'saida'
      end
    ) stored not null;

alter table public.cash_movements
  drop constraint if exists cash_movements_direction_check;
alter table public.cash_movements
  add constraint cash_movements_direction_check
  check (direction in ('entrada', 'saida'));

comment on column public.cash_movements.direction is
  'Sentido do movimento na gaveta (entrada ou saida), derivado do tipo sem ramo padrao. Tipo novo exige declarar o sentido aqui.';

-- -----------------------------------------------------------------------------
-- 2. Apuracao unica do valor esperado da gaveta
-- -----------------------------------------------------------------------------
create or replace function private.compute_cash_session_expected_amount(
  p_session_id uuid,
  p_tenant_id uuid
)
returns table (
  initial_amount numeric,
  cash_received numeric,
  inflow_amount numeric,
  outflow_amount numeric,
  expected_amount numeric,
  movements_by_type jsonb
)
language sql
stable
set search_path = ''
as $function$
  with movements as (
    select cm.type, cm.direction, sum(cm.amount) as amount
    from public.cash_movements cm
    where cm.cash_session_id = p_session_id
      and cm.tenant_id = p_tenant_id
      and cm.reversed_at is null
    group by cm.type, cm.direction
  ),
  movement_totals as (
    select
      coalesce(sum(m.amount) filter (where m.direction = 'entrada'), 0) as inflow_amount,
      coalesce(sum(m.amount) filter (where m.direction = 'saida'), 0) as outflow_amount,
      coalesce(
        jsonb_agg(
          jsonb_build_object('type', m.type, 'direction', m.direction, 'amount', m.amount)
          order by m.type
        ),
        '[]'::jsonb
      ) as movements_by_type
    from movements m
  ),
  received as (
    select coalesce(sum(cp.amount), 0) as cash_received
    from public.comanda_pagamentos cp
    where cp.cash_session_id = p_session_id
      and cp.tenant_id = p_tenant_id
      and cp.payment_method = 'cash'
  )
  select
    s.initial_amount,
    r.cash_received,
    t.inflow_amount,
    t.outflow_amount,
    round(s.initial_amount + r.cash_received + t.inflow_amount - t.outflow_amount, 2),
    t.movements_by_type
  from public.cash_sessions s
  cross join received r
  cross join movement_totals t
  where s.id = p_session_id
    and s.tenant_id = p_tenant_id;
$function$;

comment on function private.compute_cash_session_expected_amount(uuid, uuid) is
  'Unico ponto de apuracao do valor esperado da gaveta. Nao autoriza: quem chama valida papel, tenant e trava a sessao antes de escrever.';

revoke all on function private.compute_cash_session_expected_amount(uuid, uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. close_cash_session: consome a apuracao unica
-- -----------------------------------------------------------------------------
create or replace function public.close_cash_session(
  p_session_id uuid,
  p_tenant_id uuid,
  p_closing_amount numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_session public.cash_sessions%rowtype;
  v_cash_received numeric := 0;
  v_pix_received numeric := 0;
  v_card_received numeric := 0;
  v_other_received numeric := 0;
  v_payment_count integer := 0;
  v_supplies numeric := 0;
  v_withdrawals numeric := 0;
  v_commission_payouts numeric := 0;
  v_professional_advances numeric := 0;
  v_movements_by_type jsonb;
  v_expected numeric := 0;
  v_difference numeric := 0;
  v_result jsonb;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Usuário não autenticado.' using errcode = '42501';
  end if;

  select role, tenant_id
    into v_user_role, v_user_tenant
  from public.users
  where id = v_user_id
    and is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado. Apenas gerentes e proprietários podem fechar o caixa.' using errcode = '42501';
  end if;
  if p_session_id is null or p_tenant_id is null then
    raise exception 'Sessão e unidade são obrigatórias.' using errcode = '22023';
  end if;
  if p_closing_amount is null or p_closing_amount < 0 then
    raise exception 'O valor de fechamento não pode ser negativo.' using errcode = '22023';
  end if;
  if v_user_role <> 'proprietario' and v_user_tenant <> p_tenant_id then
    raise exception 'Acesso negado para a unidade solicitada.' using errcode = '42501';
  end if;

  select * into v_session
  from public.cash_sessions
  where id = p_session_id and tenant_id = p_tenant_id
  for update;
  if not found or v_session.status <> 'open' then
    raise exception 'A sessão de caixa não está aberta ou não existe.' using errcode = 'P0001';
  end if;

  -- Valor esperado da gaveta pela apuracao unica (a sessao ja esta travada acima)
  -- e, na MESMA instrucao, os meios nao fisicos e a contagem de pagamentos da
  -- fotografia do turno: um unico snapshot de leitura, para que a contagem nunca
  -- discorde do dinheiro recebido que entrou no valor esperado.
  select d.cash_received, d.expected_amount, d.movements_by_type,
         p.pix_received, p.card_received, p.other_received, p.payment_count
    into v_cash_received, v_expected, v_movements_by_type,
         v_pix_received, v_card_received, v_other_received, v_payment_count
  from private.compute_cash_session_expected_amount(p_session_id, p_tenant_id) d
  cross join (
    select
      coalesce(sum(cp.amount) filter (where cp.payment_method = 'pix'), 0) as pix_received,
      coalesce(sum(cp.amount) filter (where cp.payment_method in ('credit_card', 'debit_card')), 0) as card_received,
      coalesce(sum(cp.amount) filter (where cp.payment_method = 'other'), 0) as other_received,
      count(*) as payment_count
    from public.comanda_pagamentos cp
    where cp.cash_session_id = p_session_id and cp.tenant_id = p_tenant_id
  ) p;

  -- Parcelas por tipo para a fotografia e as chaves de retorno, lidas do mesmo
  -- detalhamento que produziu o valor esperado.
  select
    coalesce(sum((m->>'amount')::numeric) filter (where m->>'type' = 'suprimento'), 0),
    coalesce(sum((m->>'amount')::numeric) filter (where m->>'type' = 'sangria'), 0),
    coalesce(sum((m->>'amount')::numeric) filter (where m->>'type' = 'repasse_comissao'), 0),
    coalesce(sum((m->>'amount')::numeric) filter (where m->>'type' = 'vale_profissional'), 0)
  into v_supplies, v_withdrawals, v_commission_payouts, v_professional_advances
  from jsonb_array_elements(v_movements_by_type) m;

  v_difference := round(p_closing_amount - v_expected, 2);

  update public.cash_sessions
  set closed_by = v_user_id,
      closing_amount = round(p_closing_amount, 2),
      expected_amount = v_expected,
      difference_amount = v_difference,
      cash_received_amount = round(v_cash_received, 2),
      pix_received_amount = round(v_pix_received, 2),
      card_received_amount = round(v_card_received, 2),
      other_received_amount = round(v_other_received, 2),
      payment_count = v_payment_count,
      supplies_amount = round(v_supplies, 2),
      withdrawals_amount = round(v_withdrawals, 2),
      calculation_version = 'cash_expected_v3',
      status = 'closed',
      closed_at = timezone('utc'::text, now()),
      notes = p_notes
  where id = p_session_id and tenant_id = p_tenant_id
  returning * into v_session;

  select to_jsonb(v_session) || jsonb_build_object(
    'cash_received', v_cash_received,
    'pix_received', v_pix_received,
    'card_received', v_card_received,
    'other_received', v_other_received,
    'payment_count', v_payment_count,
    'supplies', v_supplies,
    'withdrawals', v_withdrawals,
    'commission_payouts', v_commission_payouts,
    'professional_advances', v_professional_advances
  ) into v_result;
  return v_result;
end;
$function$;

revoke all on function public.close_cash_session(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.close_cash_session(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.close_cash_session(uuid, uuid, numeric, text) to service_role;

-- -----------------------------------------------------------------------------
-- 4. register_commission_payout: saldo disponivel da gaveta pela apuracao unica
-- -----------------------------------------------------------------------------
create or replace function public.register_commission_payout(
  p_professional_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_notes text default null,
  p_paid_at timestamptz default timezone('utc'::text, now()),
  p_tenant_id uuid default null,
  p_cash_session_id uuid default null,
  p_advance_amount numeric default 0,
  p_credit_amount numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_professional_tenant uuid;
  v_professional_active boolean;
  v_professional_deleted_at timestamptz;
  v_payment_method text;
  v_payout_amount numeric;
  v_advance_amount numeric := 0;
  v_credit_amount numeric := 0;
  v_cash_for_commission numeric := 0;
  v_open_obligation_amount numeric := 0;
  v_advances_open_amount numeric := 0;
  v_credits_open_amount numeric := 0;
  v_legacy_total_commission numeric := 0;
  v_legacy_paid_commission numeric := 0;
  v_legacy_open_amount numeric := 0;
  v_remaining numeric;
  v_allocation numeric;
  v_allocated_amount numeric := 0;
  v_legacy_allocated_amount numeric := 0;
  v_advance_remaining numeric;
  v_advance_allocation numeric;
  v_advance_allocated_amount numeric := 0;
  v_credit_remaining numeric;
  v_credit_allocation numeric;
  v_credit_allocated_amount numeric := 0;
  v_payout_id uuid;
  v_obligation record;
  v_advance record;
  v_credit record;
  v_cash_session public.cash_sessions%rowtype;
  v_cash_available numeric;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  select role, tenant_id
    into v_user_role, v_user_tenant
  from public.users
  where id = v_user_id
    and is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado para quitar comissoes.' using errcode = '42501';
  end if;

  if p_tenant_id is not null then
    if v_user_role <> 'proprietario' and v_user_tenant <> p_tenant_id then
      raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
    end if;
    v_target_tenant := p_tenant_id;
  else
    v_target_tenant := v_user_tenant;
  end if;

  if v_target_tenant is null then
    raise exception 'Unidade nao informada.' using errcode = '22023';
  end if;

  v_payment_method := lower(btrim(coalesce(p_payment_method, '')));
  if v_payment_method not in ('pix', 'cash', 'credit_card', 'debit_card', 'transfer', 'other') then
    raise exception 'Metodo de pagamento invalido.' using errcode = 'P0001';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount = 'NaN'::numeric then
    raise exception 'O valor do pagamento deve ser maior que zero.' using errcode = '22023';
  end if;
  v_payout_amount := round(p_amount, 2);
  if v_payout_amount <= 0 then
    raise exception 'O valor do pagamento deve ter pelo menos um centavo.' using errcode = '22023';
  end if;

  if p_credit_amount is not null and p_credit_amount < 0 then
    raise exception 'O valor do credito nao pode ser negativo.' using errcode = '22023';
  end if;
  v_credit_amount := round(coalesce(p_credit_amount, 0), 2);
  if v_credit_amount > v_payout_amount then
    raise exception 'O valor do credito de gorjeta nao pode exceder o valor total do repasse.' using errcode = 'P0001';
  end if;

  if p_advance_amount is not null and p_advance_amount < 0 then
    raise exception 'O valor do abate nao pode ser negativo.' using errcode = '22023';
  end if;
  v_advance_amount := round(coalesce(p_advance_amount, 0), 2);

  if v_payment_method = 'cash' then
    if p_cash_session_id is null then
      raise exception 'Informe a sessao de caixa para quitacao em dinheiro.' using errcode = '22023';
    end if;

    select * into v_cash_session
    from public.cash_sessions
    where id = p_cash_session_id
      and tenant_id = v_target_tenant
    for update;

    if not found or v_cash_session.status <> 'open' then
      raise exception 'A sessao de caixa informada nao esta aberta ou nao pertence a unidade.' using errcode = 'P0001';
    end if;

    -- Saldo disponivel = valor esperado da gaveta, pela apuracao unica, com a
    -- sessao ja travada acima.
    select d.expected_amount
      into v_cash_available
    from private.compute_cash_session_expected_amount(p_cash_session_id, v_target_tenant) d;

    if v_payout_amount > v_cash_available then
      raise exception 'O valor do repasse em dinheiro excede o saldo disponivel na gaveta do turno.' using errcode = 'P0001';
    end if;
  else
    if p_cash_session_id is not null then
      raise exception 'Sessao de caixa so pode ser informada para quitacao em dinheiro.' using errcode = '22023';
    end if;
  end if;

  select tenant_id, is_active, deleted_at
    into v_professional_tenant, v_professional_active, v_professional_deleted_at
  from public.professionals
  where id = p_professional_id
  for update;

  if not found or v_professional_tenant <> v_target_tenant or not coalesce(v_professional_active, false) or v_professional_deleted_at is not null then
    raise exception 'Profissional nao encontrado ou inativo.' using errcode = 'P0001';
  end if;

  for v_obligation in
    select o.id, o.amount, o.settled_amount
    from public.commission_obligations o
    where o.tenant_id = v_target_tenant
      and o.professional_id = p_professional_id
      and o.status in ('open', 'partially_paid')
      and o.settled_amount < o.amount
    order by o.created_at, o.id
    for update
  loop
    v_open_obligation_amount := v_open_obligation_amount + (v_obligation.amount - v_obligation.settled_amount);
  end loop;

  select
    coalesce(sum(e.amount - e.settled_amount) filter (where e.entry_type = 'vale'), 0),
    coalesce(sum(e.amount - e.settled_amount) filter (where e.entry_type = 'gorjeta'), 0)
    into v_advances_open_amount, v_credits_open_amount
  from public.professional_account_entries e
  where e.tenant_id = v_target_tenant
    and e.professional_id = p_professional_id
    and e.status in ('open', 'partially_paid');

  with legacy_items as (
    select
      case
        when ci.snapshot_status in ('confirmed', 'estimated')
         and ci.snapshot_commission_amount is not null
          then ci.snapshot_commission_amount
        when ci.snapshot_status in ('unavailable', 'reverted') then 0
        when ci.item_type in ('servico', 'service') or ci.service_id is not null then
          round(ci.total_price * coalesce(ps.custom_commission_percentage, s.commission_percentage, prof.commission_percentage, 0) / 100, 2)
        when ci.item_type in ('produto', 'product') or ci.product_id is not null then
          round(ci.total_price * coalesce(prod.commission_percentage, 0) / 100, 2)
        else 0
      end as commission_amount
    from public.comanda_itens ci
    join public.comandas c on c.id = ci.comanda_id
    left join public.professionals prof on prof.id = ci.professional_id
    left join public.services s on s.id = ci.service_id
    left join public.professional_services ps
      on ps.service_id = ci.service_id
     and ps.professional_id = ci.professional_id
     and ps.tenant_id = ci.tenant_id
    left join public.products prod on prod.id = ci.product_id
    where c.tenant_id = v_target_tenant
      and c.status in ('fechada', 'closed')
      and ci.professional_id = p_professional_id
      and not exists (
        select 1 from public.commission_obligations o where o.comanda_item_id = ci.id
      )
  )
  select coalesce(sum(commission_amount), 0)
    into v_legacy_total_commission
  from legacy_items;

  select coalesce(sum(
    case
      when exists (select 1 from public.commission_payout_allocations a where a.payout_id = cp.id)
        then coalesce(cp.legacy_allocated_amount, 0)
      else cp.amount
    end
  ), 0)
    into v_legacy_paid_commission
  from public.commission_payouts cp
  where cp.tenant_id = v_target_tenant
    and cp.professional_id = p_professional_id
    and cp.reversed_at is null;

  v_legacy_open_amount := greatest(0, v_legacy_total_commission - v_legacy_paid_commission);

  -- Dinheiro efetivamente desembolsado para comissao: o total do repasse menos
  -- a parcela que corresponde a credito de gorjeta pago junto.
  v_cash_for_commission := v_payout_amount - v_credit_amount;

  if v_cash_for_commission + v_advance_amount > v_open_obligation_amount + v_legacy_open_amount then
    raise exception 'O valor informado excede o saldo pendente de comissao.' using errcode = 'P0001';
  end if;
  if v_advance_amount > v_advances_open_amount then
    raise exception 'O valor do abate excede o saldo de vales em aberto do profissional.' using errcode = 'P0001';
  end if;
  if v_credit_amount > v_credits_open_amount then
    raise exception 'O valor do credito excede o saldo de gorjeta em aberto do profissional.' using errcode = 'P0001';
  end if;

  insert into public.commission_payouts (
    tenant_id, professional_id, amount, payment_method, notes, paid_at, created_by, cash_session_id, advance_amount, credit_amount
  ) values (
    v_target_tenant, p_professional_id, v_payout_amount, v_payment_method,
    p_notes, coalesce(p_paid_at, timezone('utc'::text, now())), v_user_id, p_cash_session_id, v_advance_amount, v_credit_amount
  ) returning id into v_payout_id;

  if v_payment_method = 'cash' then
    insert into public.cash_movements (
      tenant_id, cash_session_id, type, amount, reason, performed_by, payout_id
    ) values (
      v_target_tenant, p_cash_session_id, 'repasse_comissao', v_payout_amount,
      coalesce(nullif(btrim(p_notes), ''), 'Repasse de comissao'), v_user_id, v_payout_id
    );
  end if;

  v_remaining := v_cash_for_commission + v_advance_amount;
  for v_obligation in
    select o.id, o.amount, o.settled_amount
    from public.commission_obligations o
    where o.tenant_id = v_target_tenant
      and o.professional_id = p_professional_id
      and o.status in ('open', 'partially_paid')
      and o.settled_amount < o.amount
    order by o.created_at, o.id
    for update
  loop
    exit when v_remaining <= 0;
    v_allocation := least(v_remaining, v_obligation.amount - v_obligation.settled_amount);
    if v_allocation <= 0 then
      continue;
    end if;

    insert into public.commission_payout_allocations (
      tenant_id, payout_id, obligation_id, amount
    ) values (
      v_target_tenant, v_payout_id, v_obligation.id, v_allocation
    );

    update public.commission_obligations
    set settled_amount = settled_amount + v_allocation,
        status = case
          when settled_amount + v_allocation >= amount then 'paid'
          else 'partially_paid'
        end
    where id = v_obligation.id;

    v_remaining := v_remaining - v_allocation;
    v_allocated_amount := v_allocated_amount + v_allocation;
  end loop;

  v_legacy_allocated_amount := greatest(0, v_cash_for_commission - least(v_allocated_amount, v_cash_for_commission));
  update public.commission_payouts
  set legacy_allocated_amount = v_legacy_allocated_amount
  where id = v_payout_id;

  v_advance_remaining := v_advance_amount;
  for v_advance in
    select e.id, e.amount, e.settled_amount
    from public.professional_account_entries e
    where e.tenant_id = v_target_tenant
      and e.professional_id = p_professional_id
      and e.entry_type = 'vale'
      and e.status in ('open', 'partially_paid')
      and e.settled_amount < e.amount
    order by e.created_at, e.id
    for update
  loop
    exit when v_advance_remaining <= 0;
    v_advance_allocation := least(v_advance_remaining, v_advance.amount - v_advance.settled_amount);
    if v_advance_allocation <= 0 then
      continue;
    end if;

    insert into public.professional_advance_allocations (
      tenant_id, payout_id, entry_id, amount
    ) values (
      v_target_tenant, v_payout_id, v_advance.id, v_advance_allocation
    );

    update public.professional_account_entries
    set settled_amount = settled_amount + v_advance_allocation,
        status = case
          when settled_amount + v_advance_allocation >= amount then 'settled'
          else 'partially_paid'
        end
    where id = v_advance.id;

    v_advance_remaining := v_advance_remaining - v_advance_allocation;
    v_advance_allocated_amount := v_advance_allocated_amount + v_advance_allocation;
  end loop;

  -- Credito de gorjeta: mesma mecanica FIFO do abate de vale, mas os locks em
  -- professional_account_entries so acontecem depois das obrigacoes ja
  -- travadas acima, preservando a ordem de lock do ticket 06.
  v_credit_remaining := v_credit_amount;
  for v_credit in
    select e.id, e.amount, e.settled_amount
    from public.professional_account_entries e
    where e.tenant_id = v_target_tenant
      and e.professional_id = p_professional_id
      and e.entry_type = 'gorjeta'
      and e.status in ('open', 'partially_paid')
      and e.settled_amount < e.amount
    order by e.created_at, e.id
    for update
  loop
    exit when v_credit_remaining <= 0;
    v_credit_allocation := least(v_credit_remaining, v_credit.amount - v_credit.settled_amount);
    if v_credit_allocation <= 0 then
      continue;
    end if;

    insert into public.professional_advance_allocations (
      tenant_id, payout_id, entry_id, amount
    ) values (
      v_target_tenant, v_payout_id, v_credit.id, v_credit_allocation
    );

    update public.professional_account_entries
    set settled_amount = settled_amount + v_credit_allocation,
        status = case
          when settled_amount + v_credit_allocation >= amount then 'settled'
          else 'partially_paid'
        end
    where id = v_credit.id;

    v_credit_remaining := v_credit_remaining - v_credit_allocation;
    v_credit_allocated_amount := v_credit_allocated_amount + v_credit_allocation;
  end loop;

  return jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'amount', v_payout_amount,
    'professional_id', p_professional_id,
    'allocated_amount', v_allocated_amount,
    'legacy_amount', v_legacy_allocated_amount,
    'cash_session_id', p_cash_session_id,
    'advance_amount', v_advance_amount,
    'advance_allocated_amount', v_advance_allocated_amount,
    'credit_amount', v_credit_amount,
    'credit_allocated_amount', v_credit_allocated_amount
  );
end;
$function$;

revoke all on function public.register_commission_payout(uuid, numeric, text, text, timestamp with time zone, uuid, uuid, numeric, numeric) from public, anon;
grant execute on function public.register_commission_payout(uuid, numeric, text, text, timestamp with time zone, uuid, uuid, numeric, numeric) to authenticated;
grant execute on function public.register_commission_payout(uuid, numeric, text, text, timestamp with time zone, uuid, uuid, numeric, numeric) to service_role;

-- -----------------------------------------------------------------------------
-- 5. register_professional_advance: saldo disponivel da gaveta pela apuracao unica
-- -----------------------------------------------------------------------------
create or replace function public.register_professional_advance(
  p_professional_id uuid,
  p_amount numeric,
  p_reason text,
  p_payment_method text,
  p_tenant_id uuid default null,
  p_cash_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_professional_tenant uuid;
  v_professional_active boolean;
  v_professional_deleted_at timestamptz;
  v_payment_method text;
  v_amount numeric;
  v_reason text;
  v_cash_session public.cash_sessions%rowtype;
  v_cash_available numeric;
  v_entry_id uuid;
  v_movement_id uuid;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  select role, tenant_id
    into v_user_role, v_user_tenant
  from public.users
  where id = v_user_id
    and is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado para lancar vale.' using errcode = '42501';
  end if;

  if p_tenant_id is not null then
    if v_user_role <> 'proprietario' and v_user_tenant <> p_tenant_id then
      raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
    end if;
    v_target_tenant := p_tenant_id;
  else
    v_target_tenant := v_user_tenant;
  end if;

  if v_target_tenant is null then
    raise exception 'Unidade nao informada.' using errcode = '22023';
  end if;

  v_payment_method := lower(btrim(coalesce(p_payment_method, '')));
  if v_payment_method not in ('pix', 'cash', 'credit_card', 'debit_card', 'transfer', 'other') then
    raise exception 'Metodo de pagamento invalido.' using errcode = 'P0001';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount = 'NaN'::numeric then
    raise exception 'O valor do vale deve ser maior que zero.' using errcode = '22023';
  end if;
  v_amount := round(p_amount, 2);
  if v_amount <= 0 then
    raise exception 'O valor do vale deve ter pelo menos um centavo.' using errcode = '22023';
  end if;

  v_reason := btrim(coalesce(p_reason, ''));
  if length(v_reason) < 5 then
    raise exception 'Informe um motivo com pelo menos cinco caracteres.' using errcode = '22023';
  end if;

  if v_payment_method = 'cash' then
    if p_cash_session_id is null then
      raise exception 'Informe a sessao de caixa para vale em dinheiro.' using errcode = '22023';
    end if;

    select * into v_cash_session
    from public.cash_sessions
    where id = p_cash_session_id
      and tenant_id = v_target_tenant
    for update;

    if not found or v_cash_session.status <> 'open' then
      raise exception 'A sessao de caixa informada nao esta aberta ou nao pertence a unidade.' using errcode = 'P0001';
    end if;

    -- Saldo disponivel = valor esperado da gaveta, pela apuracao unica, com a
    -- sessao ja travada acima.
    select d.expected_amount
      into v_cash_available
    from private.compute_cash_session_expected_amount(p_cash_session_id, v_target_tenant) d;

    if v_amount > v_cash_available then
      raise exception 'O valor do vale em dinheiro excede o saldo disponivel na gaveta do turno.' using errcode = 'P0001';
    end if;
  else
    if p_cash_session_id is not null then
      raise exception 'Sessao de caixa so pode ser informada para vale em dinheiro.' using errcode = '22023';
    end if;
  end if;

  select tenant_id, is_active, deleted_at
    into v_professional_tenant, v_professional_active, v_professional_deleted_at
  from public.professionals
  where id = p_professional_id
  for update;

  if not found or v_professional_tenant <> v_target_tenant or not coalesce(v_professional_active, false) or v_professional_deleted_at is not null then
    raise exception 'Profissional nao encontrado ou inativo.' using errcode = 'P0001';
  end if;

  insert into public.professional_account_entries (
    tenant_id, professional_id, entry_type, direction, amount, settled_amount,
    status, reason, created_by
  ) values (
    v_target_tenant, p_professional_id, 'vale', 'debit', v_amount, 0,
    'open', v_reason, v_user_id
  ) returning id into v_entry_id;

  if v_payment_method = 'cash' then
    insert into public.cash_movements (
      tenant_id, cash_session_id, type, amount, reason, performed_by, professional_id
    ) values (
      v_target_tenant, p_cash_session_id, 'vale_profissional', v_amount, v_reason, v_user_id, p_professional_id
    ) returning id into v_movement_id;

    update public.professional_account_entries
    set cash_movement_id = v_movement_id
    where id = v_entry_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'entry_id', v_entry_id,
    'professional_id', p_professional_id,
    'amount', v_amount,
    'cash_movement_id', v_movement_id,
    'cash_session_id', p_cash_session_id
  );
end;
$function$;

revoke all on function public.register_professional_advance(uuid, numeric, text, text, uuid, uuid) from public, anon;
grant execute on function public.register_professional_advance(uuid, numeric, text, text, uuid, uuid) to authenticated;
grant execute on function public.register_professional_advance(uuid, numeric, text, text, uuid, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 6. Contrato de leitura da previa da gaveta
-- -----------------------------------------------------------------------------
-- Devolve, para uma sessao ABERTA, o valor esperado e o detalhamento por tipo
-- apurados pela funcao privada. Sessoes fechadas mostram a fotografia
-- persistida no fechamento, nao este contrato. Gerente so le a propria unidade;
-- proprietario le qualquer unidade (administrador do SaaS), como nas demais
-- RPCs financeiras.
create or replace function public.get_cash_session_expected_amount(
  p_session_id uuid,
  p_tenant_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_session_status text;
  v_result jsonb;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Usuário não autenticado.' using errcode = '42501';
  end if;

  select role, tenant_id
    into v_user_role, v_user_tenant
  from public.users
  where id = v_user_id
    and is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado. Apenas gerentes e proprietários podem consultar o valor esperado do caixa.' using errcode = '42501';
  end if;
  if p_session_id is null or p_tenant_id is null then
    raise exception 'Sessão e unidade são obrigatórias.' using errcode = '22023';
  end if;
  if v_user_role <> 'proprietario' and v_user_tenant is distinct from p_tenant_id then
    raise exception 'Acesso negado para a unidade solicitada.' using errcode = '42501';
  end if;

  select cs.status
    into v_session_status
  from public.cash_sessions cs
  where cs.id = p_session_id
    and cs.tenant_id = p_tenant_id;

  if not found or v_session_status <> 'open' then
    raise exception 'A sessão de caixa não está aberta ou não existe.' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'session_id', p_session_id,
    'tenant_id', p_tenant_id,
    'initial_amount', d.initial_amount,
    'cash_received', d.cash_received,
    'inflow_amount', d.inflow_amount,
    'outflow_amount', d.outflow_amount,
    'expected_amount', d.expected_amount,
    'movements_by_type', d.movements_by_type
  )
    into v_result
  from private.compute_cash_session_expected_amount(p_session_id, p_tenant_id) d;

  return v_result;
end;
$function$;

revoke all on function public.get_cash_session_expected_amount(uuid, uuid) from public, anon;
grant execute on function public.get_cash_session_expected_amount(uuid, uuid) to authenticated;
grant execute on function public.get_cash_session_expected_amount(uuid, uuid) to service_role;
