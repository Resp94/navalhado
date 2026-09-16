-- Ticket 09: metricas usam snapshots confirmados e fallback explicito para legado.
-- O formato ja consumido pelo frontend e preservado; os campos adicionais sao opcionais.
create or replace function public.get_tenant_financial_metrics(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_tenant_id uuid default null
)
returns json
language plpgsql
security definer
set search_path to 'public', 'extensions'
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
  from public.users where id = v_user_id;

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
        when ci.snapshot_status = 'confirmed' and ci.snapshot_net_amount is not null
          then ci.snapshot_net_amount
        else ci.total_price
      end as recognized_revenue,
      case
        when ci.snapshot_status = 'confirmed' and ci.snapshot_gross_amount is not null
          then ci.snapshot_gross_amount
        else ci.total_price
      end as recognized_gross,
      case
        when ci.snapshot_status = 'confirmed' then coalesce(ci.snapshot_quantity, ci.quantity)
        else ci.quantity
      end as recognized_quantity,
      case
        when ci.snapshot_status = 'confirmed' then coalesce(ci.snapshot_unit_cost, 0.00)
        else coalesce(prod.cost_price, 0.00)
      end as recognized_unit_cost,
      case
        when ci.snapshot_status = 'confirmed' and ci.snapshot_commission_amount is not null
          then ci.snapshot_commission_amount
        else round((ci.total_price * coalesce(
          case
            when ci.item_type in ('servico', 'service') or ci.service_id is not null then
              coalesce(ps.custom_commission_percentage, s.commission_percentage, prof.commission_percentage, 0.0)
            when ci.item_type in ('produto', 'product') or ci.product_id is not null then
              coalesce(prod.commission_percentage, 0.0)
            else 0.0
          end,
          0.0
        ) / 100.0), 2)
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
    left join public.professionals prof on prof.id = ci.professional_id
    left join public.services s on s.id = ci.service_id
    left join public.professional_services ps
      on ps.service_id = ci.service_id
     and ps.professional_id = ci.professional_id
     and ps.tenant_id = ci.tenant_id
    left join public.products prod on prod.id = ci.product_id
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
        else 'legacy'
      end as data_quality
    from target_comandas tc
    left join public.comanda_itens ci on ci.comanda_id = tc.id
    group by tc.id
  )
  select
    count(*) filter (where data_quality = 'confirmed'),
    count(*) filter (where data_quality = 'legacy')
  into v_snapshot_comandas_count, v_legacy_comandas_count
  from item_quality;

  v_historical_data_quality := case
    when v_snapshot_comandas_count > 0 and v_legacy_comandas_count = 0 then 'confirmed'
    when v_snapshot_comandas_count > 0 then 'mixed'
    when v_legacy_comandas_count > 0 then 'legacy'
    else 'unavailable'
  end;

  select coalesce(sum(amount), 0.00)
  into v_paid_commission
  from public.commission_payouts
  where tenant_id = v_target_tenant_id
    and paid_at >= p_start_date
    and paid_at <= p_end_date;

  v_pending_commission := greatest(0.00, v_total_commission - v_paid_commission);
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
        when ci.snapshot_status = 'confirmed' and ci.snapshot_gross_amount is not null
          then ci.snapshot_gross_amount
        else ci.total_price
      end as recognized_gross,
      case
        when ci.snapshot_status = 'confirmed' and ci.snapshot_commission_amount is not null
          then ci.snapshot_commission_amount
        else round((ci.total_price * coalesce(
          case
            when ci.item_type in ('servico', 'service') or ci.service_id is not null then
              coalesce(ps.custom_commission_percentage, s.commission_percentage, prof.commission_percentage, 0.0)
            when ci.item_type in ('produto', 'product') or ci.product_id is not null then
              coalesce(prod.commission_percentage, 0.0)
            else 0.0
          end,
          0.0
        ) / 100.0), 2)
      end as recognized_commission
    from public.comanda_itens ci
    join target_comandas tc on tc.id = ci.comanda_id
    left join public.professionals prof on prof.id = ci.professional_id
    left join public.services s on s.id = ci.service_id
    left join public.professional_services ps
      on ps.service_id = ci.service_id
     and ps.professional_id = ci.professional_id
     and ps.tenant_id = ci.tenant_id
    left join public.products prod on prod.id = ci.product_id
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
      greatest(0.00, coalesce(sum(ib.recognized_commission), 0.00) - coalesce(pp.paid_amount, 0.00)) as pending_sum,
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
    'legacy_comandas_count', v_legacy_comandas_count
  );
end;
$$;

revoke all on function public.get_tenant_financial_metrics(timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.get_tenant_financial_metrics(timestamptz, timestamptz, uuid) to authenticated;
