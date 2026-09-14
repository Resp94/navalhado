-- Ticket 02 da spec 037 (Fluxo de Caixa Projetado): Quitacoes de Comissao e
-- vales como saida realizada.
-- Spec: specs/037-fluxo-de-caixa-projetado/spec.md, secao "Fontes do
-- realizado, lidas nos livros de origem".
--
-- Regra central: o fluxo le cada fato no livro onde ele nasce
-- (commission_payouts, professional_account_entries) e nunca em
-- cash_movements -- somar os dois contaria a mesma saida duas vezes.
--
-- Cadeia sequencial (mesma funcao que os tickets 01, 03, 05, 07 e 08
-- redefinem): create or replace de public.get_projected_cash_flow e
-- private.get_projected_cash_flow_core, mesma assinatura de ambas.

-- Indice novo: commission_payouts nao tinha indice por unidade e momento do
-- pagamento, parcial nas quitacoes nao estornadas (a consulta ja filtra por
-- reversed_at is null). professional_account_entries (tenant_id, created_at)
-- ja existe (spec 034) e cobre os vales sem indice novo.
create index if not exists commission_payouts_tenant_paid_at_idx
  on public.commission_payouts (tenant_id, paid_at)
  where reversed_at is null;

create or replace function private.get_projected_cash_flow_core(
  p_tenant_id uuid,
  p_start_date date,
  p_end_date date,
  p_granularity text,
  p_today date,
  p_timezone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_extent integer;
  v_result jsonb;
begin
  if p_tenant_id is null then
    raise exception 'Unidade (tenant_id) não informada.' using errcode = '22023';
  end if;
  if p_today is null then
    raise exception 'A data de hoje é obrigatória para calcular o fluxo.' using errcode = '22023';
  end if;
  if p_timezone is null or btrim(p_timezone) = '' then
    raise exception 'O fuso horário da unidade é obrigatório.' using errcode = '22023';
  end if;
  -- Forca a validacao do fuso antes de qualquer agregacao.
  perform now() at time zone p_timezone;

  if p_start_date is null or p_end_date is null then
    raise exception 'As datas de início e fim do período são obrigatórias.' using errcode = '22023';
  end if;
  if p_end_date < p_start_date then
    raise exception 'A data final não pode ser anterior à data inicial.' using errcode = '22023';
  end if;
  if p_start_date > p_today then
    raise exception 'A data inicial não pode ser posterior a hoje.' using errcode = '22023';
  end if;
  if p_start_date < (p_today - 365) then
    raise exception 'A data inicial não pode ser mais de 365 dias antes de hoje.' using errcode = '22023';
  end if;
  if p_end_date > (p_today + 365) then
    raise exception 'A data final não pode ser mais de 365 dias depois de hoje.' using errcode = '22023';
  end if;

  v_extent := (p_end_date - p_start_date) + 1;
  if v_extent > 366 then
    raise exception 'O período não pode ter mais de 366 dias.' using errcode = '22023';
  end if;

  if p_granularity is null or p_granularity not in ('day', 'week', 'month') then
    raise exception 'Granularidade desconhecida. Use dia, semana ou mês.' using errcode = '22023';
  end if;
  if p_granularity = 'day' and v_extent > 92 then
    raise exception 'A granularidade diária só é permitida em períodos de até 92 dias.' using errcode = '22023';
  end if;

  with bucket_grid as (
    -- Dia: um agrupamento por dia.
    select gs::date as raw_start, gs::date as raw_end
    from generate_series(p_start_date, p_end_date, interval '1 day') gs
    where p_granularity = 'day'

    union all

    -- Semana: comeca na segunda-feira. A grade parte da segunda da semana
    -- que contem o inicio do periodo; primeiro e ultimo agrupamento sao
    -- recortados aos limites do periodo.
    select
      greatest(gs::date, p_start_date) as raw_start,
      least((gs::date + 6), p_end_date) as raw_end
    from generate_series(
      p_start_date - (extract(isodow from p_start_date)::int - 1),
      p_end_date,
      interval '7 days'
    ) gs
    where p_granularity = 'week'

    union all

    -- Mes civil: a grade parte do primeiro dia do mes que contem o inicio
    -- do periodo; primeiro e ultimo agrupamento sao recortados aos limites
    -- do periodo.
    select
      greatest(gs::date, p_start_date) as raw_start,
      least((date_trunc('month', gs) + interval '1 month - 1 day')::date, p_end_date) as raw_end
    from generate_series(
      date_trunc('month', p_start_date)::date,
      p_end_date,
      interval '1 month'
    ) gs
    where p_granularity = 'month'
  ),
  buckets as (
    select
      raw_start as bucket_start,
      raw_end as bucket_end,
      case
        when raw_end < p_today then 'past'
        when raw_start > p_today then 'future'
        else 'current'
      end as kind
    from bucket_grid
  ),
  -- Mesmo predicado de "recebido" de get_daily_financial_summary: soma
  -- comanda_pagamentos por tenant e dia de negocio do pagamento, sem juntar
  -- com comandas. A reabertura de Comanda ja apaga a linha desta tabela, e
  -- o arquivo de estornos (comanda_payment_reversals) nunca e subtraido.
  daily_payments as (
    select
      (cp.paid_at at time zone p_timezone)::date as local_date,
      cp.amount,
      cp.payment_method
    from public.comanda_pagamentos cp
    where cp.tenant_id = p_tenant_id
      and cp.paid_at >= (p_start_date::timestamp at time zone p_timezone)
      and cp.paid_at < ((p_end_date + 1)::timestamp at time zone p_timezone)
  ),
  daily_agg as (
    select
      local_date,
      sum(amount) as total,
      sum(amount) filter (where payment_method = 'cash') as dinheiro,
      sum(amount) filter (where payment_method = 'pix') as pix,
      sum(amount) filter (where payment_method in ('credit_card', 'debit_card')) as cartao,
      sum(amount) filter (where payment_method = 'other') as outros
    from daily_payments
    group by local_date
  ),
  -- Quitacao de Comissao: conta por "amount" (todo o dinheiro desembolsado,
  -- comissao e gorjeta -- o abate de vale ja fica fora desse campo), no dia
  -- de negocio de paid_at, excluindo estornadas.
  daily_payouts as (
    select
      (cp.paid_at at time zone p_timezone)::date as local_date,
      cp.amount,
      cp.professional_id
    from public.commission_payouts cp
    where cp.tenant_id = p_tenant_id
      and cp.reversed_at is null
      and cp.paid_at >= (p_start_date::timestamp at time zone p_timezone)
      and cp.paid_at < ((p_end_date + 1)::timestamp at time zone p_timezone)
  ),
  payouts_agg as (
    select local_date, sum(amount) as total
    from daily_payouts
    group by local_date
  ),
  -- Vale: conta pelo valor no dia de negocio da criacao, qualquer que seja a
  -- forma de pagamento, excluindo estornados. O abate posterior numa
  -- Quitacao nao conta de novo, porque so reduz o "amount" da quitacao.
  daily_advances as (
    select
      (e.created_at at time zone p_timezone)::date as local_date,
      e.amount,
      e.professional_id
    from public.professional_account_entries e
    where e.tenant_id = p_tenant_id
      and e.entry_type = 'vale'
      and e.reversed_at is null
      and e.created_at >= (p_start_date::timestamp at time zone p_timezone)
      and e.created_at < ((p_end_date + 1)::timestamp at time zone p_timezone)
  ),
  advances_agg as (
    select local_date, sum(amount) as total
    from daily_advances
    group by local_date
  ),
  -- Distinto de payouts_agg/advances_agg (totais por dia): aqui o total e
  -- por dia E por profissional, para poder agrupar por bucket sem misturar
  -- profissionais diferentes na mesma soma.
  daily_payouts_by_professional as (
    select
      dp.local_date,
      dp.professional_id,
      coalesce(prof.name, 'Profissional removido') as professional_name,
      sum(dp.amount) as total
    from daily_payouts dp
    left join public.professionals prof on prof.id = dp.professional_id
    group by dp.local_date, dp.professional_id, coalesce(prof.name, 'Profissional removido')
  ),
  daily_advances_by_professional as (
    select
      da.local_date,
      da.professional_id,
      coalesce(prof.name, 'Profissional removido') as professional_name,
      sum(da.amount) as total
    from daily_advances da
    left join public.professionals prof on prof.id = da.professional_id
    group by da.local_date, da.professional_id, coalesce(prof.name, 'Profissional removido')
  ),
  -- Cada fonte e agregada por bucket em separado (uma linha por bucket em
  -- cada CTE) antes de juntar: juntar daily_agg, payouts_agg e advances_agg
  -- direto num so GROUP BY faria produto cartesiano sempre que mais de uma
  -- fonte tiver mais de um dia dentro do mesmo agrupamento, multiplicando
  -- as somas.
  bucket_inflow as (
    select
      b.bucket_start,
      b.bucket_end,
      b.kind,
      coalesce(sum(d.total), 0.00) as inflow_realized,
      coalesce(sum(d.total) filter (where d.local_date > p_today), 0.00) as inflow_pending,
      coalesce(sum(d.dinheiro), 0.00) as dinheiro,
      coalesce(sum(d.pix), 0.00) as pix,
      coalesce(sum(d.cartao), 0.00) as cartao,
      coalesce(sum(d.outros), 0.00) as outros
    from buckets b
    left join daily_agg d on d.local_date between b.bucket_start and b.bucket_end
    group by b.bucket_start, b.bucket_end, b.kind
  ),
  bucket_payouts as (
    select
      b.bucket_start,
      b.bucket_end,
      coalesce(sum(po.total), 0.00) as payouts_total,
      coalesce(sum(po.total) filter (where po.local_date > p_today), 0.00) as payouts_pending
    from buckets b
    left join payouts_agg po on po.local_date between b.bucket_start and b.bucket_end
    group by b.bucket_start, b.bucket_end
  ),
  bucket_advances as (
    select
      b.bucket_start,
      b.bucket_end,
      coalesce(sum(ad.total), 0.00) as advances_total,
      coalesce(sum(ad.total) filter (where ad.local_date > p_today), 0.00) as advances_pending
    from buckets b
    left join advances_agg ad on ad.local_date between b.bucket_start and b.bucket_end
    group by b.bucket_start, b.bucket_end
  ),
  bucket_agg as (
    select
      bi.bucket_start,
      bi.bucket_end,
      bi.kind,
      bi.inflow_realized,
      bp.payouts_total + ba.advances_total as outflow_realized,
      -- pending_flow, nesta fatia, soma o realizado com data posterior a
      -- hoje: entradas futuras somam, saidas futuras (quitacao com paid_at
      -- adiante) subtraem. Os tickets seguintes somam aqui estimativa,
      -- previsto e vencido.
      bi.inflow_pending - bp.payouts_pending - ba.advances_pending as pending_flow,
      bi.dinheiro,
      bi.pix,
      bi.cartao,
      bi.outros
    from bucket_inflow bi
    join bucket_payouts bp on bp.bucket_start = bi.bucket_start and bp.bucket_end = bi.bucket_end
    join bucket_advances ba on ba.bucket_start = bi.bucket_start and ba.bucket_end = bi.bucket_end
  ),
  -- Por agrupamento, soma os lancamentos diarios de cada profissional que
  -- caem dentro do bucket -- sem juntar com um total do periodo inteiro,
  -- para nao repetir o mesmo total em todo bucket em que o profissional
  -- aparece.
  bucket_payouts_by_professional_distinct as (
    select
      b.bucket_start,
      b.bucket_end,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'professional_id', x.professional_id,
            'professional_name', x.professional_name,
            'amount', round(x.total, 2)
          )
          order by x.professional_name
        ) filter (where x.professional_id is not null),
        '[]'::jsonb
      ) as payouts_by_professional
    from buckets b
    left join lateral (
      select dp.professional_id, dp.professional_name, sum(dp.total) as total
      from daily_payouts_by_professional dp
      where dp.local_date between b.bucket_start and b.bucket_end
      group by dp.professional_id, dp.professional_name
    ) x on true
    group by b.bucket_start, b.bucket_end
  ),
  bucket_advances_by_professional_distinct as (
    select
      b.bucket_start,
      b.bucket_end,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'professional_id', x.professional_id,
            'professional_name', x.professional_name,
            'amount', round(x.total, 2)
          )
          order by x.professional_name
        ) filter (where x.professional_id is not null),
        '[]'::jsonb
      ) as advances_by_professional
    from buckets b
    left join lateral (
      select da.professional_id, da.professional_name, sum(da.total) as total
      from daily_advances_by_professional da
      where da.local_date between b.bucket_start and b.bucket_end
      group by da.professional_id, da.professional_name
    ) x on true
    group by b.bucket_start, b.bucket_end
  )
  select jsonb_build_object(
    'timezone', p_timezone,
    'business_today', p_today,
    'buckets', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'start_date', ba.bucket_start,
          'end_date', ba.bucket_end,
          'kind', ba.kind,
          'inflow_realized', round(ba.inflow_realized, 2),
          'outflow_realized', round(ba.outflow_realized, 2),
          'pending_flow', round(ba.pending_flow, 2),
          'detail', jsonb_build_object(
            'inflow_by_method', jsonb_build_object(
              'dinheiro', round(ba.dinheiro, 2),
              'pix', round(ba.pix, 2),
              'cartao', round(ba.cartao, 2),
              'outros', round(ba.outros, 2)
            ),
            'payouts_by_professional', pbp.payouts_by_professional,
            'advances_by_professional', abp.advances_by_professional
          )
        )
        order by ba.bucket_start
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from bucket_agg ba
  join bucket_payouts_by_professional_distinct pbp
    on pbp.bucket_start = ba.bucket_start and pbp.bucket_end = ba.bucket_end
  join bucket_advances_by_professional_distinct abp
    on abp.bucket_start = ba.bucket_start and abp.bucket_end = ba.bucket_end;

  return v_result;
end;
$function$;

comment on function private.get_projected_cash_flow_core(uuid, date, date, text, date, text) is
  'Nucleo do fluxo de caixa projetado (spec 037): recebe "hoje" injetado, valida periodo e granularidade e agrega, por agrupamento, entradas realizadas de pagamento de Comanda e saidas realizadas de Quitacao de Comissao e vale. Sem checagem de acesso.';

-- A funcao publica nao muda de corpo (so o comentario e atualizado para
-- registrar a extensao), mas o CREATE OR REPLACE garante que ela permanece
-- apontando para o nucleo redefinido acima.
create or replace function public.get_projected_cash_flow(
  p_tenant_id uuid,
  p_start_date date,
  p_end_date date,
  p_granularity text
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
  v_timezone text;
  v_today date;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.' using errcode = '42501';
  end if;

  select role, tenant_id into v_user_role, v_user_tenant
  from public.users
  where id = v_user_id and is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado. Apenas gerentes podem acessar o fluxo de caixa projetado.' using errcode = '42501';
  end if;

  if p_tenant_id is not null then
    if v_user_role <> 'proprietario' and v_user_tenant is distinct from p_tenant_id then
      raise exception 'Acesso negado para a unidade solicitada.' using errcode = '42501';
    end if;
    v_target_tenant := p_tenant_id;
  else
    v_target_tenant := v_user_tenant;
  end if;

  if v_target_tenant is null then
    raise exception 'Unidade (tenant_id) não informada.' using errcode = '22023';
  end if;

  select coalesce(timezone, 'America/Sao_Paulo') into v_timezone
  from public.tenants
  where id = v_target_tenant;

  if v_timezone is null then
    raise exception 'Unidade (tenant_id) não encontrada.' using errcode = '22023';
  end if;

  v_today := (now() at time zone v_timezone)::date;

  return private.get_projected_cash_flow_core(
    v_target_tenant, p_start_date, p_end_date, p_granularity, v_today, v_timezone
  );
end;
$function$;

comment on function public.get_projected_cash_flow(uuid, date, date, text) is
  'Fluxo de Caixa Projetado (spec 037): entradas realizadas de Comandas fechadas e saidas realizadas de Quitacao de Comissao e vale, por agrupamento de dia, semana ou mes. Superficie do gerente do proprio tenant; proprietario acessa qualquer tenant.';

revoke all on function public.get_projected_cash_flow(uuid, date, date, text) from public, anon;
grant execute on function public.get_projected_cash_flow(uuid, date, date, text) to authenticated, service_role;

revoke all on function private.get_projected_cash_flow_core(uuid, date, date, text, date, text) from public, anon, authenticated;
grant execute on function private.get_projected_cash_flow_core(uuid, date, date, text, date, text) to service_role;
