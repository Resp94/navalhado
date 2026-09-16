-- Ticket 07 da spec 034: pagamento de gorjeta (credito) na Quitacao de Comissao.
--
-- Libera o parametro p_credit_amount que o ticket 06 ja acrescentou a
-- register_commission_payout mas mantinha recusado. Nenhuma alteracao de
-- assinatura: create or replace nas duas funcoes, mesma tabela de rateio
-- (professional_advance_allocations) usada para vale e gorjeta.
--
-- Modelo: p_amount e todo o dinheiro efetivamente desembolsado nesta
-- quitacao (comissao + gorjeta). p_credit_amount informa quanto desse
-- dinheiro corresponde a credito de gorjeta sendo pago; o restante
-- (p_amount - p_credit_amount) e o dinheiro que de fato cobre comissao,
-- ao qual se soma o abate de vale (que nao e dinheiro) para formar o total
-- que quita obrigacoes de comissao -- exatamente o raciocinio do ticket 06,
-- so que agora descontando primeiro a parcela em dinheiro que foi para
-- gorjeta.

alter table public.commission_payouts
  add column if not exists credit_amount numeric(10,2) not null default 0
  constraint commission_payouts_credit_amount_check check (credit_amount >= 0);

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
  v_cash_received numeric;
  v_supplies numeric;
  v_withdrawals numeric;
  v_cash_payouts_existing numeric;
  v_advances_existing numeric;
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

    select coalesce(sum(cp.amount) filter (where cp.payment_method = 'cash'), 0)
      into v_cash_received
    from public.comanda_pagamentos cp
    where cp.cash_session_id = p_cash_session_id and cp.tenant_id = v_target_tenant;

    select
      coalesce(sum(cm.amount) filter (where cm.type = 'suprimento'), 0),
      coalesce(sum(cm.amount) filter (where cm.type = 'sangria'), 0),
      coalesce(sum(cm.amount) filter (where cm.type = 'repasse_comissao' and cm.reversed_at is null), 0),
      coalesce(sum(cm.amount) filter (where cm.type = 'vale_profissional' and cm.reversed_at is null), 0)
      into v_supplies, v_withdrawals, v_cash_payouts_existing, v_advances_existing
    from public.cash_movements cm
    where cm.cash_session_id = p_cash_session_id and cm.tenant_id = v_target_tenant;

    v_cash_available := round(
      v_cash_session.initial_amount + v_cash_received + v_supplies - v_withdrawals
        - v_cash_payouts_existing - v_advances_existing,
      2
    );

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

-- get_professional_commission_balance: o liquido sugerido passa a somar
-- creditos de gorjeta em aberto (dinheiro extra devido ao profissional),
-- alem de continuar subtraindo vales em aberto.
create or replace function public.get_professional_commission_balance(
  p_professional_id uuid,
  p_start_date timestamptz default null,
  p_end_date timestamptz default null,
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_open_ledger numeric := 0;
  v_generated_ledger numeric := 0;
  v_legacy_generated numeric := 0;
  v_legacy_generated_period numeric := 0;
  v_legacy_paid numeric := 0;
  v_paid_period numeric := 0;
  v_advances_open_amount numeric := 0;
  v_credits_open_amount numeric := 0;
  v_suggested_net_amount numeric := 0;
  v_start timestamptz := coalesce(p_start_date, '-infinity'::timestamptz);
  v_end timestamptz := coalesce(p_end_date, 'infinity'::timestamptz);
begin
  select role, tenant_id into v_user_role, v_user_tenant
  from public.users where id = v_user_id and is_active = true;
  if v_user_role is null then
    raise exception 'Acesso negado para consultar comissoes.' using errcode = '42501';
  end if;

  if v_user_role = 'barbeiro' then
    select p.tenant_id into v_target_tenant
    from public.professionals p
    where p.id = p_professional_id
      and p.user_id = v_user_id
      and p.is_active = true
      and p.deleted_at is null;
    if not found or (p_tenant_id is not null and v_target_tenant <> p_tenant_id) then
      raise exception 'Acesso negado para este extrato.' using errcode = '42501';
    end if;
  elsif v_user_role in ('gerente', 'proprietario') then
    if p_tenant_id is not null then
      if v_user_role <> 'proprietario' and v_user_tenant <> p_tenant_id then
        raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
      end if;
      v_target_tenant := p_tenant_id;
    else
      v_target_tenant := v_user_tenant;
    end if;
  else
    raise exception 'Acesso negado para consultar comissoes.' using errcode = '42501';
  end if;
  if v_target_tenant is null then
    raise exception 'Unidade nao informada.' using errcode = '22023';
  end if;

  select coalesce(sum(greatest(0, o.amount - o.settled_amount)), 0)
    into v_open_ledger
  from public.commission_obligations o
  where o.tenant_id = v_target_tenant
    and o.professional_id = p_professional_id
    and o.status in ('open', 'partially_paid');

  select coalesce(sum(o.amount), 0)
    into v_generated_ledger
  from public.commission_obligations o
  where o.tenant_id = v_target_tenant
    and o.professional_id = p_professional_id
    and o.status <> 'reversed'
    and o.created_at >= v_start and o.created_at <= v_end;

  with legacy_items as (
    select ci.total_price, c.closed_at,
      case
        when ci.snapshot_status in ('confirmed', 'estimated')
         and ci.snapshot_commission_amount is not null
          then ci.snapshot_commission_amount
        else 0
      end as commission_amount
    from public.comanda_itens ci
    join public.comandas c on c.id = ci.comanda_id
    where c.tenant_id = v_target_tenant
      and c.status in ('fechada', 'closed')
      and ci.professional_id = p_professional_id
      and not exists (select 1 from public.commission_obligations o where o.comanda_item_id = ci.id)
  )
  select coalesce(sum(commission_amount), 0),
         coalesce(sum(commission_amount) filter (where closed_at >= v_start and closed_at <= v_end), 0)
    into v_legacy_generated, v_legacy_generated_period
  from legacy_items;

  select coalesce(sum(
    case
      when exists (select 1 from public.commission_payout_allocations a where a.payout_id = cp.id)
        then coalesce(cp.legacy_allocated_amount, 0)
      else cp.amount
    end
  ), 0) into v_legacy_paid
  from public.commission_payouts cp
  where cp.tenant_id = v_target_tenant
    and cp.professional_id = p_professional_id
    and cp.reversed_at is null;

  select coalesce(sum(cp.amount), 0) into v_paid_period
  from public.commission_payouts cp
  where cp.tenant_id = v_target_tenant
    and cp.professional_id = p_professional_id
    and cp.reversed_at is null
    and cp.paid_at >= v_start and cp.paid_at <= v_end;

  select
    coalesce(sum(e.amount - e.settled_amount) filter (where e.entry_type = 'vale'), 0),
    coalesce(sum(e.amount - e.settled_amount) filter (where e.entry_type = 'gorjeta'), 0)
    into v_advances_open_amount, v_credits_open_amount
  from public.professional_account_entries e
  where e.tenant_id = v_target_tenant
    and e.professional_id = p_professional_id
    and e.status in ('open', 'partially_paid');

  v_suggested_net_amount := round(
    greatest(0, (v_open_ledger + greatest(0, v_legacy_generated - v_legacy_paid)) + v_credits_open_amount - v_advances_open_amount),
    2
  );

  return jsonb_build_object(
    'current_open_balance', v_open_ledger + greatest(0, v_legacy_generated - v_legacy_paid),
    'generated_commission', v_generated_ledger + v_legacy_generated_period,
    'paid_commission', v_paid_period,
    'advances_open_amount', round(v_advances_open_amount, 2),
    'credits_open_amount', round(v_credits_open_amount, 2),
    'suggested_net_amount', v_suggested_net_amount
  );
end;
$function$;
