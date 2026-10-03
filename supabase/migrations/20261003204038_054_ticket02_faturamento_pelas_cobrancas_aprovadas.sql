-- Spec 054, ticket 02: o faturamento do painel do Proprietario vem das cobrancas aprovadas.
--
-- "Faturamento do mes" e "Evolucao da receita" liam public.invoices, que nenhum codigo grava. A cobranca recorrente da
-- spec 052 registra cada pagamento em public.billing_charges (mensalidade `recurring` e diferenca de plano `upgrade`).
-- Passam a somar billing_charges.amount das linhas `approved`, no mes do calendario de Brasilia (America/Sao_Paulo, o fuso da
-- plataforma, e nao o de cada barbearia). Estornada, contestada, recusada, em analise e pendente deixam de ser `approved` e
-- ficam fora sozinhas. A guarda passa a ser a mesma das Ferramentas do Proprietario (ADMIN_ONLY, 42501).
-- O contrato (mrr, active_tenants, suspended_tenants, revenue_this_month, revenue_trend) nao muda neste ticket: os contadores
-- e o MRR mudam no ticket 03.
create or replace function public.get_admin_dashboard_metrics()
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_mrr numeric;
  v_active_tenants integer;
  v_suspended_tenants integer;
  v_revenue_this_month numeric;
  v_revenue_trend json;
  v_month_start timestamp := date_trunc('month', now() at time zone 'America/Sao_Paulo');
begin
  perform private.assert_saas_admin();

  select coalesce(sum(p.price), 0)
  into v_mrr from public.tenant_subscriptions sub join public.plans p on p.id = sub.plan_id where sub.status = 'active';
  select count(distinct tenant_id) into v_active_tenants from public.tenant_subscriptions where status = 'active';
  select count(distinct tenant_id) into v_suspended_tenants from public.tenant_subscriptions where status = 'blocked';

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
    'active_tenants', v_active_tenants,
    'suspended_tenants', v_suspended_tenants,
    'revenue_this_month', v_revenue_this_month,
    'revenue_trend', coalesce(v_revenue_trend, '[]'::json)
  );
end;
$function$;
