-- Spec 054, ticket 03: o MRR e os contadores do painel do Proprietario dizem o que vale agora.
--
-- - mrr: valor que a proxima cobranca vai cobrar de cada assinatura que segue sendo cobrada (`active` e `past_due`), pelo preco do
--   plano agendado quando ha descida agendada (scheduled_plan_id) e pelo do plano atual quando nao ha. Cortesia, teste, cancelada e
--   bloqueada ficam fora (a cortesia nao e cobrada e a cancelada nao renova).
-- - released_tenants (no lugar de active_tenants): barbearias com Estado de Acesso `allowed` ou `warning` agora, qualquer motivo
--   (teste, pagante, cortesia, cancelada com periodo pago, Desbloqueio Manual).
-- - blocked_tenants (no lugar de suspended_tenants): barbearias com Estado de Acesso `blocked` agora, mesmo antes de a rotina diaria
--   gravar o bloqueio. "Suspensa" e termo a evitar no glossario.
-- Barbearia sem linha de assinatura nao entra em contador (o Estado de Acesso dela nao e calculavel).
create or replace function public.get_admin_dashboard_metrics()
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_mrr numeric;
  v_released_tenants integer;
  v_blocked_tenants integer;
  v_revenue_this_month numeric;
  v_revenue_trend json;
  v_month_start timestamp := date_trunc('month', now() at time zone 'America/Sao_Paulo');
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

  select coalesce(sum(c.amount), 0)
  into v_revenue_this_month
  from public.billing_charges c
  where c.status = 'approved'
    and c.charged_at >= v_month_start at time zone 'America/Sao_Paulo'
    and c.charged_at < (v_month_start + interval '1 month') at time zone 'America/Sao_Paulo';

  with months as (
    select m::date as month_date
    from generate_series(v_month_start - interval '11 months', v_month_start, interval '1 month') m
  ), monthly_revenue as (
    select date_trunc('month', c.charged_at at time zone 'America/Sao_Paulo')::date as month_date, sum(c.amount) as total_amount
    from public.billing_charges c
    where c.status = 'approved'
      and c.charged_at >= (v_month_start - interval '11 months') at time zone 'America/Sao_Paulo'
      and c.charged_at < (v_month_start + interval '1 month') at time zone 'America/Sao_Paulo'
    group by 1
  )
  select json_agg(
    json_build_object('month', to_char(m.month_date, 'YYYY-MM'), 'month_label', to_char(m.month_date, 'TMMonth YY'), 'revenue', coalesce(r.total_amount, 0))
    order by m.month_date
  )
  into v_revenue_trend
  from months m left join monthly_revenue r on r.month_date = m.month_date;

  return json_build_object(
    'mrr', v_mrr,
    'released_tenants', v_released_tenants,
    'blocked_tenants', v_blocked_tenants,
    'revenue_this_month', v_revenue_this_month,
    'revenue_trend', coalesce(v_revenue_trend, '[]'::json)
  );
end;
$function$;
