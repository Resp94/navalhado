-- Spec 054, ticket 03, decisao pos-entrega: a cancelada que assinou de novo entra no MRR.
--
-- O MRR e o valor que a proxima cobranca vai cobrar. A cancelada que assinou de novo e teve a assinatura nova autorizada no Mercado
-- Pago continua com `status = 'canceled'` ate o fim do periodo pago, mas a cobranca dela recomeca ali (private.subscription_access_state
-- a devolve como `allowed` com o motivo `active`). Ficava de fora do MRR; agora entra, pelo plano atual (a assinatura nova nasce pelo
-- valor dele e o agendamento antigo e limpo). Usa o proprio Estado de Acesso (motivo `active` na `canceled`), e nao uma copia do
-- criterio. A cancelada sem assinatura nova, a cortesia, o teste e a bloqueada seguem fora.
-- O MRR e os dois contadores saem da mesma leitura de tenant_subscriptions; o resto da funcao nao muda.
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

  select
    coalesce(
      sum(p.price) filter (
        where sub.status in ('active', 'past_due')
           or (sub.status = 'canceled' and a.reason = 'active')
      ),
      0
    ),
    count(*) filter (where a.access in ('allowed', 'warning')),
    count(*) filter (where a.access = 'blocked')
  into v_mrr, v_released_tenants, v_blocked_tenants
  from public.tenant_subscriptions sub
  cross join lateral private.subscription_access_state(sub, now()) a
  left join public.plans p on p.id = coalesce(sub.scheduled_plan_id, sub.plan_id);

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
      json_build_object('month', to_char(s.month_date, 'YYYY-MM'), 'revenue', s.revenue)
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
