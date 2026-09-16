-- Corrige saldo acumulado e preserva a parcela legada de payouts mistos.
alter table public.commission_payouts
  add column if not exists legacy_allocated_amount numeric not null default 0
    constraint commission_payouts_legacy_allocated_amount_check check (legacy_allocated_amount >= 0);

create or replace function public.register_commission_payout(
  p_professional_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_notes text default null,
  p_paid_at timestamp with time zone default timezone('utc'::text, now()),
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
  v_open_obligation_amount numeric := 0;
  v_legacy_total_commission numeric := 0;
  v_legacy_paid_commission numeric := 0;
  v_legacy_open_amount numeric := 0;
  v_remaining numeric;
  v_allocation numeric;
  v_allocated_amount numeric := 0;
  v_legacy_allocated_amount numeric := 0;
  v_payout_id uuid;
  v_obligation record;
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

  -- Mantem a compatibilidade: itens sem obrigacao usam o calculo legado, sem
  -- competir com obrigacoes confirmadas ja estao no livro novo.
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
    and cp.professional_id = p_professional_id;

  v_legacy_open_amount := greatest(0, v_legacy_total_commission - v_legacy_paid_commission);
  if v_payout_amount > v_open_obligation_amount + v_legacy_open_amount then
    raise exception 'O valor informado excede o saldo pendente de comissao.' using errcode = 'P0001';
  end if;

  insert into public.commission_payouts (
    tenant_id, professional_id, amount, payment_method, notes, paid_at, created_by
  ) values (
    v_target_tenant, p_professional_id, v_payout_amount, v_payment_method,
    p_notes, coalesce(p_paid_at, timezone('utc'::text, now())), v_user_id
  ) returning id into v_payout_id;

  v_remaining := v_payout_amount;
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

  v_legacy_allocated_amount := greatest(0, v_payout_amount - v_allocated_amount);
  update public.commission_payouts
  set legacy_allocated_amount = v_legacy_allocated_amount
  where id = v_payout_id;

  return jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'amount', v_payout_amount,
    'professional_id', p_professional_id,
    'allocated_amount', v_allocated_amount,
    'legacy_amount', greatest(0, v_payout_amount - v_allocated_amount)
  );
end;
$$;

revoke all on function public.register_commission_payout(uuid, numeric, text, text, timestamptz, uuid) from public, anon;
grant execute on function public.register_commission_payout(uuid, numeric, text, text, timestamptz, uuid) to authenticated;

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
as $$
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
  v_start timestamptz := coalesce(p_start_date, '-infinity'::timestamptz);
  v_end timestamptz := coalesce(p_end_date, 'infinity'::timestamptz);
begin
  select role, tenant_id into v_user_role, v_user_tenant
  from public.users where id = v_user_id and is_active = true;
  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado para consultar comissoes.' using errcode = '42501';
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
        when ci.snapshot_status in ('unavailable', 'reverted') then 0
        else round(ci.total_price * case
        when ci.item_type in ('servico', 'service') or ci.service_id is not null then coalesce(ps.custom_commission_percentage, s.commission_percentage, prof.commission_percentage, 0)
        when ci.item_type in ('produto', 'product') or ci.product_id is not null then coalesce(prod.commission_percentage, 0)
        else 0
      end / 100, 2)
      end as commission_amount
    from public.comanda_itens ci
    join public.comandas c on c.id = ci.comanda_id
    left join public.professionals prof on prof.id = ci.professional_id
    left join public.services s on s.id = ci.service_id
    left join public.professional_services ps on ps.service_id = ci.service_id and ps.professional_id = ci.professional_id and ps.tenant_id = ci.tenant_id
    left join public.products prod on prod.id = ci.product_id
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
    and cp.professional_id = p_professional_id;

  select coalesce(sum(cp.amount), 0) into v_paid_period
  from public.commission_payouts cp
  where cp.tenant_id = v_target_tenant
    and cp.professional_id = p_professional_id
    and cp.paid_at >= v_start and cp.paid_at <= v_end;

  return jsonb_build_object(
    'current_open_balance', v_open_ledger + greatest(0, v_legacy_generated - v_legacy_paid),
    'generated_commission', v_generated_ledger + v_legacy_generated_period,
    'paid_commission', v_paid_period
  );
end;
$$;

revoke all on function public.get_professional_commission_balance(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.get_professional_commission_balance(uuid, timestamptz, timestamptz, uuid) to authenticated;

create or replace function public.get_tenant_current_commission_balance(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_user_role text;
  v_user_tenant uuid;
  v_open_obligations numeric := 0;
  v_legacy_generated numeric := 0;
  v_legacy_paid numeric := 0;
begin
  select role, tenant_id into v_user_role, v_user_tenant
  from public.users where id = v_user_id and is_active = true;
  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado para consultar comissoes.' using errcode = '42501';
  end if;
  if p_tenant_id is null
     or (v_user_role <> 'proprietario' and v_user_tenant <> p_tenant_id) then
    raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
  end if;

  select coalesce(sum(greatest(0, o.amount - o.settled_amount)), 0)
    into v_open_obligations
  from public.commission_obligations o
  where o.tenant_id = p_tenant_id
    and o.status in ('open', 'partially_paid');

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
    left join public.professional_services ps on ps.service_id = ci.service_id and ps.professional_id = ci.professional_id and ps.tenant_id = ci.tenant_id
    left join public.products prod on prod.id = ci.product_id
    where c.tenant_id = p_tenant_id
      and c.status in ('fechada', 'closed')
      and ci.professional_id is not null
      and not exists (select 1 from public.commission_obligations o where o.comanda_item_id = ci.id)
  )
  select coalesce(sum(commission_amount), 0) into v_legacy_generated from legacy_items;

  select coalesce(sum(
    case
      when exists (select 1 from public.commission_payout_allocations a where a.payout_id = cp.id)
        then coalesce(cp.legacy_allocated_amount, 0)
      else cp.amount
    end
  ), 0) into v_legacy_paid
  from public.commission_payouts cp
  where cp.tenant_id = p_tenant_id;

  return jsonb_build_object('current_open_balance', v_open_obligations + greatest(0, v_legacy_generated - v_legacy_paid));
end;
$$;

revoke all on function public.get_tenant_current_commission_balance(uuid) from public, anon;
grant execute on function public.get_tenant_current_commission_balance(uuid) to authenticated;

create or replace function public.get_tenant_financial_metrics(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_tenant_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_user_tenant_id uuid;
  v_user_role text;
  v_target_tenant_id uuid;
  v_total_revenue numeric := 0.00;
  v_services_revenue numeric := 0.00;
  v_products_revenue numeric := 0.00;
  v_products_count integer := 0;
  v_products_cost numeric := 0.00;
  v_total_commission numeric := 0.00;
  v_paid_commission numeric := 0.00;
  v_pending_commission numeric := 0.00;
  v_net_revenue numeric := 0.00;
  v_discounts_total numeric := 0.00;
  v_tips_total numeric := 0.00;
  v_operational_revenue numeric := 0.00;
  v_snapshot_comandas_count integer := 0;
  v_estimated_comandas_count integer := 0;
  v_legacy_comandas_count integer := 0;
  v_historical_data_quality text := 'unavailable';
  v_revenue_by_method json;
  v_commissions_by_professional json;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  select tenant_id, role into v_user_tenant_id, v_user_role
  from public.users where id = v_user_id and is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado. Apenas gerentes e proprietarios podem acessar metricas financeiras.' using errcode = '42501';
  end if;

  if p_tenant_id is not null then
    if v_user_role <> 'proprietario' and v_user_tenant_id <> p_tenant_id then
      raise exception 'Acesso negado para a unidade solicitada.' using errcode = '42501';
    end if;
    v_target_tenant_id := p_tenant_id;
  else
    v_target_tenant_id := v_user_tenant_id;
  end if;

  if v_target_tenant_id is null then
    raise exception 'Unidade (tenant_id) nao informada.' using errcode = '22023';
  end if;

  -- O total continua sendo o total fechado da comanda, incluindo gorjeta,
  -- enquanto os indicadores de itens passam a usar o liquido snapshotado.
  select
    coalesce(sum(c.total_amount), 0.00),
    coalesce(sum(c.discount_amount), 0.00),
    coalesce(sum(c.tip_amount), 0.00)
  into v_total_revenue, v_discounts_total, v_tips_total
  from public.comandas c
  where c.tenant_id = v_target_tenant_id
    and c.status in ('fechada', 'closed')
    and c.closed_at >= p_start_date
    and c.closed_at <= p_end_date;

  with target_comandas as (
    select c.id
    from public.comandas c
    where c.tenant_id = v_target_tenant_id
      and c.status in ('fechada', 'closed')
      and c.closed_at >= p_start_date
      and c.closed_at <= p_end_date
  ), item_breakdown as (
    select
      ci.id as item_id,
      ci.comanda_id,
      ci.professional_id,
      ci.quantity,
      ci.total_price,
      ci.item_type,
      ci.service_id,
      ci.product_id,
      case
        when ci.snapshot_status in ('confirmed', 'estimated') and ci.snapshot_net_amount is not null
          then ci.snapshot_net_amount
        else 0.00
      end as recognized_revenue,
      case
        when ci.snapshot_status in ('confirmed', 'estimated') and ci.snapshot_gross_amount is not null
          then ci.snapshot_gross_amount
        else 0.00
      end as recognized_gross,
      case
        when ci.snapshot_status in ('confirmed', 'estimated') then coalesce(ci.snapshot_quantity, ci.quantity)
        else 0
      end as recognized_quantity,
      case
        when ci.snapshot_status in ('confirmed', 'estimated') then coalesce(ci.snapshot_unit_cost, 0.00)
        else 0.00
      end as recognized_unit_cost,
      case
        when ci.snapshot_status in ('confirmed', 'estimated') and ci.snapshot_commission_amount is not null
          then ci.snapshot_commission_amount
        else 0.00
      end as recognized_commission,
      ci.snapshot_status,
      case
        when ci.snapshot_status = 'confirmed'
         and ci.snapshot_quantity is not null
         and ci.snapshot_unit_price is not null
         and ci.snapshot_gross_amount is not null
         and ci.snapshot_discount_amount is not null
         and ci.snapshot_net_amount is not null
         and ci.snapshot_commission_percentage is not null
         and ci.snapshot_commission_amount is not null
         and ci.snapshot_commission_rule is not null
         and (ci.item_type <> 'produto' or ci.snapshot_unit_cost is not null)
          then true
        else false
      end as snapshot_complete
    from public.comanda_itens ci
    join target_comandas tc on tc.id = ci.comanda_id
  )
  select
    coalesce(sum(ib.recognized_revenue) filter (where ib.item_type in ('servico', 'service') or ib.service_id is not null), 0.00),
    coalesce(sum(ib.recognized_revenue) filter (where ib.item_type in ('produto', 'product') or ib.product_id is not null), 0.00),
    coalesce(sum(ib.recognized_quantity) filter (where ib.item_type in ('produto', 'product') or ib.product_id is not null), 0),
    coalesce(sum(ib.recognized_unit_cost * ib.recognized_quantity) filter (where ib.item_type in ('produto', 'product') or ib.product_id is not null), 0.00),
    coalesce(sum(ib.recognized_commission), 0.00)
  into v_services_revenue, v_products_revenue, v_products_count, v_products_cost, v_total_commission
  from item_breakdown ib;

  v_operational_revenue := v_services_revenue + v_products_revenue;

  with target_comandas as (
    select c.id
    from public.comandas c
    where c.tenant_id = v_target_tenant_id
      and c.status in ('fechada', 'closed')
      and c.closed_at >= p_start_date
      and c.closed_at <= p_end_date
  ), item_quality as (
    select
      tc.id,
      case
        when count(ci.id) > 0 and bool_and(
          ci.snapshot_status = 'confirmed'
          and ci.snapshot_quantity is not null
          and ci.snapshot_unit_price is not null
          and ci.snapshot_gross_amount is not null
          and ci.snapshot_discount_amount is not null
          and ci.snapshot_net_amount is not null
          and ci.snapshot_commission_percentage is not null
          and ci.snapshot_commission_amount is not null
          and ci.snapshot_commission_rule is not null
          and (ci.item_type <> 'produto' or ci.snapshot_unit_cost is not null)
        ) then 'confirmed'
        when count(ci.id) > 0 and bool_and(
          ci.snapshot_status in ('confirmed', 'estimated')
          and ci.snapshot_quantity is not null
          and ci.snapshot_unit_price is not null
          and ci.snapshot_gross_amount is not null
          and ci.snapshot_discount_amount is not null
          and ci.snapshot_net_amount is not null
          and ci.snapshot_commission_percentage is not null
          and ci.snapshot_commission_amount is not null
          and ci.snapshot_commission_rule is not null
          and (ci.item_type <> 'produto' or ci.snapshot_unit_cost is not null)
        ) then 'estimated'
        else 'legacy'
      end as data_quality
    from target_comandas tc
    left join public.comanda_itens ci on ci.comanda_id = tc.id
    group by tc.id
  )
  select
    count(*) filter (where data_quality = 'confirmed'),
    count(*) filter (where data_quality = 'estimated'),
    count(*) filter (where data_quality = 'legacy')
  into v_snapshot_comandas_count, v_estimated_comandas_count, v_legacy_comandas_count
  from item_quality;

  v_historical_data_quality := case
    when v_snapshot_comandas_count > 0 and v_estimated_comandas_count = 0 and v_legacy_comandas_count = 0 then 'confirmed'
    when v_snapshot_comandas_count = 0 and v_estimated_comandas_count > 0 and v_legacy_comandas_count = 0 then 'estimated'
    when v_snapshot_comandas_count = 0 and v_estimated_comandas_count = 0 and v_legacy_comandas_count > 0 then 'legacy'
    when v_snapshot_comandas_count > 0 or v_estimated_comandas_count > 0 then 'mixed'
    when v_legacy_comandas_count > 0 then 'legacy'
    else 'unavailable'
  end;

  select coalesce(sum(amount), 0.00)
  into v_paid_commission
  from public.commission_payouts
  where tenant_id = v_target_tenant_id
    and paid_at >= p_start_date
    and paid_at <= p_end_date;

  select coalesce((public.get_tenant_current_commission_balance(v_target_tenant_id)->>'current_open_balance')::numeric, 0.00) into v_pending_commission;
  v_net_revenue := v_total_revenue - v_total_commission - v_products_cost;

  with target_comandas as (
    select c.id
    from public.comandas c
    where c.tenant_id = v_target_tenant_id
      and c.status in ('fechada', 'closed')
      and c.closed_at >= p_start_date
      and c.closed_at <= p_end_date
  )
  select coalesce(json_object_agg(method, amount_sum), '{}'::json)
  into v_revenue_by_method
  from (
    select cp.payment_method as method, coalesce(sum(cp.amount), 0.00) as amount_sum
    from public.comanda_pagamentos cp
    join target_comandas tc on tc.id = cp.comanda_id
    group by cp.payment_method
  ) payment_totals;

  with target_comandas as (
    select c.id
    from public.comandas c
    where c.tenant_id = v_target_tenant_id
      and c.status in ('fechada', 'closed')
      and c.closed_at >= p_start_date
      and c.closed_at <= p_end_date
  ), item_breakdown as (
    select
      ci.comanda_id,
      ci.professional_id,
      case
        when ci.snapshot_status in ('confirmed', 'estimated') and ci.snapshot_gross_amount is not null
          then ci.snapshot_gross_amount
        else 0.00
      end as recognized_gross,
      case
        when ci.snapshot_status in ('confirmed', 'estimated') and ci.snapshot_commission_amount is not null
          then ci.snapshot_commission_amount
        else 0.00
      end as recognized_commission
    from public.comanda_itens ci
    join target_comandas tc on tc.id = ci.comanda_id
  ), prof_payouts as (
    select professional_id, coalesce(sum(amount), 0.00) as paid_amount
    from public.commission_payouts
    where tenant_id = v_target_tenant_id
      and paid_at >= p_start_date
      and paid_at <= p_end_date
    group by professional_id
  ), prof_stats as (
    select
      prof.id as professional_id,
      prof.name as professional_name,
      coalesce(sum(ib.recognized_gross), 0.00) as gross_sum,
      coalesce(sum(ib.recognized_commission), 0.00) as commission_sum,
      coalesce(pp.paid_amount, 0.00) as paid_sum,
      coalesce((public.get_professional_commission_balance(prof.id, null, null, v_target_tenant_id)->>'current_open_balance')::numeric, 0.00) as pending_sum,
      count(distinct ib.comanda_id) as appointments_count
    from public.professionals prof
    left join item_breakdown ib on ib.professional_id = prof.id
    left join prof_payouts pp on pp.professional_id = prof.id
    where prof.tenant_id = v_target_tenant_id
      and prof.is_active = true
    group by prof.id, prof.name, pp.paid_amount
    order by commission_sum desc, prof.name asc
  )
  select coalesce(json_agg(json_build_object(
    'professional_id', professional_id,
    'professional_name', professional_name,
    'gross_sum', gross_sum,
    'commission_sum', commission_sum,
    'paid_sum', paid_sum,
    'pending_sum', pending_sum,
    'appointments_count', appointments_count
  )), '[]'::json)
  into v_commissions_by_professional
  from prof_stats;

  return json_build_object(
    'total_revenue', v_total_revenue,
    'services_revenue', v_services_revenue,
    'products_revenue', v_products_revenue,
    'products_count', v_products_count,
    'products_cost', v_products_cost,
    'total_commission', v_total_commission,
    'paid_commission', v_paid_commission,
    'pending_commission', v_pending_commission,
    'net_revenue', v_net_revenue,
    'revenue_by_method', v_revenue_by_method,
    'commissions_by_professional', v_commissions_by_professional,
    'discounts_total', v_discounts_total,
    'tips_total', v_tips_total,
    'operational_revenue', v_operational_revenue,
    'historical_data_quality', v_historical_data_quality,
    'snapshot_comandas_count', v_snapshot_comandas_count,
    'estimated_comandas_count', v_estimated_comandas_count,
    'legacy_comandas_count', v_legacy_comandas_count
  );
end;
$$;

revoke all on function public.get_tenant_financial_metrics(timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.get_tenant_financial_metrics(timestamptz, timestamptz, uuid) to authenticated;
