-- Ticket 05 da spec 037 (Fluxo de Caixa Projetado): Compromissos sem Data.
-- Spec: specs/037-fluxo-de-caixa-projetado/spec.md, secao "Compromissos sem
-- Data".
--
-- Cadeia sequencial (mesma funcao que os tickets 01, 02, 03, 07 e 08
-- redefinem): create or replace de public.get_projected_cash_flow e
-- private.get_projected_cash_flow_core, mesma assinatura de ambas.
--
-- Compromissos sem Data nao entram em nenhum agrupamento, no fluxo pendente
-- nem na curva -- distribui-los exigiria inventar uma data de quitacao. E
-- por isso uma chave de topo (undated_commitments), calculada uma unica vez
-- por consulta, independente do periodo pedido.

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
  v_first_payment_date date;
  v_history_days integer;
  v_weeks_used integer;
  v_status text;
  v_business_hours jsonb;
  v_avg_mon numeric := 0;
  v_avg_tue numeric := 0;
  v_avg_wed numeric := 0;
  v_avg_thu numeric := 0;
  v_avg_fri numeric := 0;
  v_avg_sat numeric := 0;
  v_avg_sun numeric := 0;
  v_commission_open numeric := 0;
  v_tips_open numeric := 0;
  v_advances_open numeric := 0;
  v_net_due numeric := 0;
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

  -- Entradas estimadas: media do recebido nas N ocorrencias mais recentes do
  -- mesmo dia da semana, N limitado a 8. N e contado a partir do primeiro
  -- dia de negocio com pagamento de Comanda vivo no tenant, nao da criacao
  -- do tenant, para que o intervalo entre cadastro e primeiro atendimento
  -- nao vire semanas de zero. Independe da janela pedida (p_start/p_end).
  select min((cp.paid_at at time zone p_timezone)::date)
    into v_first_payment_date
  from public.comanda_pagamentos cp
  where cp.tenant_id = p_tenant_id;

  if v_first_payment_date is null then
    v_history_days := 0;
  else
    v_history_days := greatest(0, p_today - v_first_payment_date);
  end if;

  v_weeks_used := least(8, floor(v_history_days::numeric / 7)::integer);
  v_status := case when v_weeks_used < 4 then 'insufficient_history' else 'ok' end;

  -- Janela: os N x 7 dias de negocio imediatamente anteriores a hoje (hoje
  -- fora da janela). Dias sem recebimento entram como zero na media (o
  -- filter abaixo nao restringe a existencia de pagamento, so a janela; a
  -- ausencia de linha em algum dia da janela ja e coberta pelo sum, que soma
  -- so o que existe e divide pelo total de semanas).
  if v_weeks_used > 0 then
    select
      round(coalesce(sum(cp.amount) filter (where extract(dow from (cp.paid_at at time zone p_timezone)::date) = 1), 0) / v_weeks_used, 2),
      round(coalesce(sum(cp.amount) filter (where extract(dow from (cp.paid_at at time zone p_timezone)::date) = 2), 0) / v_weeks_used, 2),
      round(coalesce(sum(cp.amount) filter (where extract(dow from (cp.paid_at at time zone p_timezone)::date) = 3), 0) / v_weeks_used, 2),
      round(coalesce(sum(cp.amount) filter (where extract(dow from (cp.paid_at at time zone p_timezone)::date) = 4), 0) / v_weeks_used, 2),
      round(coalesce(sum(cp.amount) filter (where extract(dow from (cp.paid_at at time zone p_timezone)::date) = 5), 0) / v_weeks_used, 2),
      round(coalesce(sum(cp.amount) filter (where extract(dow from (cp.paid_at at time zone p_timezone)::date) = 6), 0) / v_weeks_used, 2),
      round(coalesce(sum(cp.amount) filter (where extract(dow from (cp.paid_at at time zone p_timezone)::date) = 0), 0) / v_weeks_used, 2)
      into v_avg_mon, v_avg_tue, v_avg_wed, v_avg_thu, v_avg_fri, v_avg_sat, v_avg_sun
    from public.comanda_pagamentos cp
    where cp.tenant_id = p_tenant_id
      and (cp.paid_at at time zone p_timezone)::date >= (p_today - (v_weeks_used * 7))
      and (cp.paid_at at time zone p_timezone)::date <= (p_today - 1);
  end if;

  -- Horario de funcionamento: dia ausente ou sem "active" e lido como
  -- fechado (mesma leitura que a agenda ja faz). Dia fechado tem estimativa
  -- zero, mesmo com historico de recebimento.
  select coalesce(t.business_hours, '{}'::jsonb)
    into v_business_hours
  from public.tenants t
  where t.id = p_tenant_id;

  -- Compromissos sem Data: soma, por profissional (ativo, inativo ou
  -- arquivado -- dívida com ex-profissional nao some), do liquido sugerido
  -- que a propria Quitacao de Comissao exibe e liquida
  -- (get_professional_commission_balance, decisao da spec 034). Reusar essa
  -- fonte garante que esta linha e as telas de quitacao nunca divirjam. O
  -- piso zero por profissional (ja aplicado dentro da funcao reusada) evita
  -- que o vale de um esconda o credito de outro.
  select
    coalesce(sum((b ->> 'current_open_balance')::numeric), 0),
    coalesce(sum((b ->> 'credits_open_amount')::numeric), 0),
    coalesce(sum((b ->> 'advances_open_amount')::numeric), 0),
    coalesce(sum((b ->> 'suggested_net_amount')::numeric), 0)
    into v_commission_open, v_tips_open, v_advances_open, v_net_due
  from (
    select public.get_professional_commission_balance(prof.id, null, null, p_tenant_id) as b
    from public.professionals prof
    where prof.tenant_id = p_tenant_id
  ) saldos;

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
  -- Entrada estimada: so dias futuros (posteriores a "hoje", que nunca
  -- recebe estimativa). Dia fechado no horario de funcionamento vale zero,
  -- mesmo com historico.
  daily_estimate as (
    select
      gs::date as local_date,
      coalesce(
        (v_business_hours -> (
          case extract(dow from gs::date)::int
            when 0 then 'domingo' when 1 then 'segunda' when 2 then 'terca' when 3 then 'quarta'
            when 4 then 'quinta' when 5 then 'sexta' when 6 then 'sabado'
          end
        ) ->> 'active')::boolean,
        false
      ) as is_active,
      case extract(dow from gs::date)::int
        when 0 then v_avg_sun when 1 then v_avg_mon when 2 then v_avg_tue when 3 then v_avg_wed
        when 4 then v_avg_thu when 5 then v_avg_fri when 6 then v_avg_sat
      end as weekday_avg
    from generate_series(p_start_date, p_end_date, interval '1 day') gs
    where gs::date > p_today
  ),
  -- Cada fonte e agregada por bucket em separado (uma linha por bucket em
  -- cada CTE) antes de juntar: juntar daily_agg, payouts_agg, advances_agg e
  -- daily_estimate direto num so GROUP BY faria produto cartesiano sempre
  -- que mais de uma fonte tiver mais de um dia dentro do mesmo agrupamento,
  -- multiplicando as somas.
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
  bucket_estimate as (
    select
      b.bucket_start,
      b.bucket_end,
      coalesce(sum(de.weekday_avg) filter (where de.is_active), 0.00) as inflow_estimated_raw,
      count(*) filter (where de.is_active) as estimated_days,
      count(*) filter (where not de.is_active) as closed_days
    from buckets b
    left join daily_estimate de on de.local_date between b.bucket_start and b.bucket_end
    group by b.bucket_start, b.bucket_end
  ),
  bucket_agg as (
    select
      bi.bucket_start,
      bi.bucket_end,
      bi.kind,
      bi.inflow_realized,
      -- inflow_estimated e nulo (nao zero) quando o historico e insuficiente
      -- e ha dia futuro ativo no agrupamento: "vazio", nao "zerado". Quando
      -- nao ha dia futuro ativo (agrupamento so passado, ou so dias
      -- fechados), zero e o valor correto (nada a estimar).
      case
        when v_status <> 'ok' and be.estimated_days > 0 then null
        else round(be.inflow_estimated_raw, 2)
      end as inflow_estimated,
      bp.payouts_total + ba.advances_total as outflow_realized,
      -- pending_flow soma o realizado com data posterior a hoje (entradas
      -- futuras somam, saidas futuras subtraem) e a entrada estimada, so
      -- quando o historico e suficiente. Os tickets seguintes somam aqui
      -- saida prevista e vencida. Compromissos sem Data NUNCA entram aqui.
      bi.inflow_pending - bp.payouts_pending - ba.advances_pending
        + (case when v_status = 'ok' then be.inflow_estimated_raw else 0 end) as pending_flow,
      bi.dinheiro,
      bi.pix,
      bi.cartao,
      bi.outros,
      be.estimated_days,
      be.closed_days
    from bucket_inflow bi
    join bucket_payouts bp on bp.bucket_start = bi.bucket_start and bp.bucket_end = bi.bucket_end
    join bucket_advances ba on ba.bucket_start = bi.bucket_start and ba.bucket_end = bi.bucket_end
    join bucket_estimate be on be.bucket_start = bi.bucket_start and be.bucket_end = bi.bucket_end
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
    'estimate', jsonb_build_object(
      'status', v_status,
      'weeks_used', v_weeks_used,
      'weekday_averages', jsonb_build_object(
        'mon', round(v_avg_mon, 2),
        'tue', round(v_avg_tue, 2),
        'wed', round(v_avg_wed, 2),
        'thu', round(v_avg_thu, 2),
        'fri', round(v_avg_fri, 2),
        'sat', round(v_avg_sat, 2),
        'sun', round(v_avg_sun, 2)
      )
    ),
    'undated_commitments', jsonb_build_object(
      'commission_open', round(v_commission_open, 2),
      'tips_open', round(v_tips_open, 2),
      'advances_open', round(v_advances_open, 2),
      'net_due', round(v_net_due, 2)
    ),
    'buckets', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'start_date', ba.bucket_start,
          'end_date', ba.bucket_end,
          'kind', ba.kind,
          'inflow_realized', round(ba.inflow_realized, 2),
          'inflow_estimated', ba.inflow_estimated,
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
            'advances_by_professional', abp.advances_by_professional,
            'estimated_days', ba.estimated_days,
            'closed_days', ba.closed_days
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
  'Nucleo do fluxo de caixa projetado (spec 037): recebe "hoje" injetado, valida periodo e granularidade e agrega, por agrupamento, entradas realizadas de pagamento de Comanda, saidas realizadas de Quitacao de Comissao e vale, e entrada estimada por dia da semana. Devolve tambem os Compromissos sem Data (comissoes e gorjetas em aberto, menos vales), independentes do periodo pedido. Sem checagem de acesso.';

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
  'Fluxo de Caixa Projetado (spec 037): entradas realizadas de Comandas fechadas, saidas realizadas de Quitacao de Comissao e vale, entrada estimada por dia da semana e Compromissos sem Data, por agrupamento de dia, semana ou mes. Superficie do gerente do proprio tenant; proprietario acessa qualquer tenant.';

revoke all on function public.get_projected_cash_flow(uuid, date, date, text) from public, anon;
grant execute on function public.get_projected_cash_flow(uuid, date, date, text) to authenticated, service_role;

revoke all on function private.get_projected_cash_flow_core(uuid, date, date, text, date, text) from public, anon, authenticated;
grant execute on function private.get_projected_cash_flow_core(uuid, date, date, text, date, text) to service_role;
