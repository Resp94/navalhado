-- Spec 054, ticket 02, revisao do code-review: o cartao "Faturamento do mes" e o grafico "Evolucao da receita" saem da mesma serie.
--
-- Antes, a soma do mes e a CTE do grafico repetiam o filtro `approved` e a janela de Brasilia, e a regra "cartao e grafico nunca
-- discordam" dependia de as duas copias continuarem iguais. Agora o cartao e o ultimo mes da serie de 12 meses: nao ha como divergirem.
-- O fuso da plataforma vira uma constante (v_fuso) em vez de um literal repetido. Resultado identico ao da versao anterior.
create or replace function public.get_admin_dashboard_metrics()
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_fuso constant text := 'America/Sao_Paulo';
  v_mrr numeric;
  v_released_tenants integer;
  v_blocked_tenants integer;
  v_revenue_this_month numeric;
  v_revenue_trend json;
  v_month_start timestamp := date_trunc('month', now() at time zone v_fuso);
begin
  perform private.assert_saas_admin();

  select coalesce(sum(p.price), 0)
  into v_mrr
  from public.tenant_subscriptions sub
  join public.plans p on p.id = coalesce(sub.scheduled_plan_id, sub.plan_id)
  where sub.status in ('active', 'past_due');

  select
    count(*) filter (where a.access in ('allowed', 'warning')),
    count(*) filter (where a.access = 'blocked')
  into v_released_tenants, v_blocked_tenants
  from public.tenant_subscriptions sub
  cross join lateral private.subscription_access_state(sub, now()) a;

  with months as (
    select m::date as month_date
    from generate_series(v_month_start - interval '11 months', v_month_start, interval '1 month') m
  ), monthly_revenue as (
    select date_trunc('month', c.charged_at at time zone v_fuso)::date as month_date, sum(c.amount) as total_amount
    from public.billing_charges c
    where c.status = 'approved'
      and c.charged_at >= (v_month_start - interval '11 months') at time zone v_fuso
      and c.charged_at < (v_month_start + interval '1 month') at time zone v_fuso
    group by 1
  ), serie as (
    select m.month_date, coalesce(r.total_amount, 0) as revenue
    from months m left join monthly_revenue r on r.month_date = m.month_date
  )
  select
    json_agg(
      json_build_object('month', to_char(s.month_date, 'YYYY-MM'), 'month_label', to_char(s.month_date, 'TMMonth YY'), 'revenue', s.revenue)
      order by s.month_date
    ),
    (array_agg(s.revenue order by s.month_date desc))[1]
  into v_revenue_trend, v_revenue_this_month
  from serie s;

  return json_build_object(
    'mrr', v_mrr,
    'released_tenants', v_released_tenants,
    'blocked_tenants', v_blocked_tenants,
    'revenue_this_month', v_revenue_this_month,
    'revenue_trend', coalesce(v_revenue_trend, '[]'::json)
  );
end;
$function$;
