-- Correcao de revisao do ticket 09: em private.report_customer_visits, a CTE
-- resolved escolhia service_names/return_period_days_min pela existencia de
-- QUALQUER Comanda fechada no dia (cd.business_day), mesmo quando essa
-- Comanda nao tinha item de servico (so produto) -- mascarando um
-- Agendamento concluido com servico real no mesmo dia, fazendo o prazo cair
-- no padrao de 20 dias em vez do prazo real do servico prestado. Corrige o
-- predicado para csa.business_day (Comanda com item de SERVICO), unica fonte
-- que de fato tem servico_names/return_period_days_min para oferecer.
create or replace function private.report_customer_visits(
  p_tenant_id uuid,
  p_tz text
)
returns table (
  customer_id uuid,
  business_day date,
  service_names text[],
  return_period_days_min integer,
  professional_id uuid,
  professional_name text
)
language sql
stable
set search_path = ''
as $function$
  with appt_source as (
    select
      a.customer_id,
      (a.start_time at time zone p_tz)::date as business_day,
      a.start_time,
      a.professional_id,
      s.name as service_name,
      s.return_period_days
    from public.appointments a
    join public.services s on s.id = a.service_id
    where a.tenant_id = p_tenant_id
      and a.status = 'completed'
      and a.customer_id is not null
  ),
  appt_agg as (
    select
      customer_id,
      business_day,
      array_agg(distinct service_name) as service_names,
      min(return_period_days) as return_period_days_min,
      (array_agg(professional_id order by start_time desc))[1] as professional_id
    from appt_source
    group by customer_id, business_day
  ),
  comanda_days as (
    select distinct
      c.customer_id,
      (c.closed_at at time zone p_tz)::date as business_day
    from public.comandas c
    where c.tenant_id = p_tenant_id
      and c.status = 'fechada'
      and c.customer_id is not null
  ),
  comanda_service_source as (
    select
      c.customer_id,
      (c.closed_at at time zone p_tz)::date as business_day,
      ci.professional_id,
      ci.total_price,
      s.name as service_name,
      s.return_period_days
    from public.comandas c
    join public.comanda_itens ci on ci.comanda_id = c.id
    join public.services s on s.id = ci.service_id
    where c.tenant_id = p_tenant_id
      and c.status = 'fechada'
      and c.customer_id is not null
      and ci.item_type = 'servico'
  ),
  comanda_service_agg as (
    select
      customer_id,
      business_day,
      array_agg(distinct service_name) as service_names,
      min(return_period_days) as return_period_days_min,
      (array_agg(professional_id order by total_price desc nulls last))[1] as professional_id
    from comanda_service_source
    group by customer_id, business_day
  ),
  all_days as (
    select customer_id, business_day from appt_agg
    union
    select customer_id, business_day from comanda_days
  ),
  resolved as (
    select
      d.customer_id,
      d.business_day,
      case when csa.business_day is not null then csa.service_names else aa.service_names end as service_names,
      case when aa.business_day is not null then aa.professional_id else csa.professional_id end as professional_id,
      case when csa.business_day is not null then csa.return_period_days_min else aa.return_period_days_min end as return_period_days_min
    from all_days d
    left join appt_agg aa on aa.customer_id = d.customer_id and aa.business_day = d.business_day
    left join comanda_service_agg csa on csa.customer_id = d.customer_id and csa.business_day = d.business_day
  )
  select
    r.customer_id,
    r.business_day,
    coalesce(r.service_names, array[]::text[]) as service_names,
    r.return_period_days_min,
    r.professional_id,
    prof.name as professional_name
  from resolved r
  left join public.professionals prof
    on prof.id = r.professional_id
   and prof.tenant_id = p_tenant_id
$function$;

comment on function private.report_customer_visits(uuid, text) is
  'Visita (spec 038): por cliente identificado e dia de negocio (fuso p_tz), uma linha com os servicos realizados e o profissional, unindo Agendamento completed e Comanda fechada com customer_id (mesmo dia = uma Visita so). Servicos preferem a Comanda quando ha Comanda fechada com item de SERVICO no dia (Comanda so com produto nao conta como fonte de servico, cai no Agendamento); profissional prefere o Agendamento quando ha Agendamento concluido no dia. Sem checagem de acesso, sem grant para authenticated/anon.';

revoke all on function private.report_customer_visits(uuid, text) from public, anon, authenticated, service_role;
