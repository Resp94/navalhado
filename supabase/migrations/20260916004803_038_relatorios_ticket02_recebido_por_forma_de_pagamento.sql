-- Ticket 02 da spec 038 (Modulo de Relatorios): Recebido por forma de
-- pagamento, estendendo o contrato de Faturamento por periodo do ticket 01
-- via CREATE OR REPLACE FUNCTION (mesma assinatura, mesmo nome).
-- Spec: specs/038-modulo-de-relatorios/spec.md, secao "1-3. get_revenue_report"
-- (recebido) e historias 22 a 27.
--
-- Recebido conta pela data do pagamento (paid_at), nao pelo fechamento da
-- Comanda (closed_at). Mesmo predicado de get_daily_financial_summary:
-- Comanda 'fechada', paid_at cru (sem funcao) para usar
-- comanda_pagamentos_tenant_paid_at_idx, sem subtrair
-- comanda_payment_reversals (a tabela viva ja esta liquida -- comanda
-- reaberta apaga a linha viva e copia para o arquivo de estornos).
--
-- Correcao incidental necessaria: o bucket_agg do ticket 01 juntava
-- items_agg e comandas_agg (cada um com uma linha por dia de negocio)
-- direto contra buckets via BETWEEN, em dois LEFT JOIN independentes. Para
-- agrupamento de semana/mes com mais de um dia de negocio dentro do mesmo
-- agrupamento, isso produz produto cartesiano entre as linhas de items_agg
-- e as linhas de comandas_agg do mesmo agrupamento, multiplicando
-- gross/net/closed_comandas/tips -- a mesma armadilha que este ticket foi
-- instruido a evitar para o recebido. Nenhum teste existente cobria semana/
-- mes com movimento real (so grade de datas em tenant vazio), por isso o
-- bug nao foi pego antes. Corrigido agregando cada fonte a granularidade de
-- agrupamento em CTE propria (items_bucket_agg, comandas_bucket_agg,
-- bucket_received_totals) e juntando essas ja agregadas (uma linha por
-- agrupamento) por igualdade de bucket_start/bucket_end -- join 1:1, sem
-- fan-out. Comportamento de dia (agrupamento = 1 dia de negocio) e
-- inalterado; validado pelos testes ja verdes do ticket 01.
create or replace function private.get_revenue_report_core(
  p_tenant_id uuid,
  p_start_date date,
  p_end_date date,
  p_granularity text,
  p_today date,
  p_timezone text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_extent integer;
  v_prev_start date;
  v_prev_end date;
  v_result jsonb;
begin
  if p_tenant_id is null then
    raise exception 'Unidade (tenant_id) não informada.' using errcode = '22023';
  end if;
  if p_today is null then
    raise exception 'A data de hoje é obrigatória para calcular o relatório.' using errcode = '22023';
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
  if p_end_date > p_today then
    raise exception 'A data final não pode ser posterior a hoje.' using errcode = '22023';
  end if;
  if p_start_date < (p_today - 730) then
    raise exception 'A data inicial não pode ser mais de 730 dias antes de hoje.' using errcode = '22023';
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

  -- Periodo anterior: os N dias imediatamente anteriores ao inicio, N igual
  -- a extensao do periodo. Pode ultrapassar o limite de 730 dias.
  v_prev_end := p_start_date - 1;
  v_prev_start := v_prev_end - (v_extent - 1);

  with bucket_grid as (
    -- Dia: um agrupamento por dia.
    select gs::date as raw_start, gs::date as raw_end
    from generate_series(p_start_date, p_end_date, interval '1 day') gs
    where p_granularity = 'day'

    union all

    -- Semana: comeca na segunda-feira, recortada aos limites do periodo.
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

    -- Mes civil, recortado aos limites do periodo.
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
    select raw_start as bucket_start, raw_end as bucket_end
    from bucket_grid
  ),
  -- Receita Reconhecida de Item, na propria CTE (uma fonte, uma agregacao).
  recognized as (
    select * from private.report_recognized_items(p_tenant_id, p_start_date, p_end_date, p_timezone)
  ),
  items_agg as (
    select
      business_day,
      sum(gross) as gross,
      sum(net) as net,
      sum(net) filter (where item_type in ('servico', 'service') or service_id is not null) as services_net,
      sum(net) filter (where item_type in ('produto', 'product') or product_id is not null) as products_net
    from recognized
    group by business_day
  ),
  -- Comandas fechadas e gorjetas, direto de comandas (fonte propria, nunca
  -- misturada com a agregacao de itens no mesmo group by).
  comandas_agg as (
    select
      (c.closed_at at time zone p_timezone)::date as business_day,
      count(*) as closed_comandas,
      coalesce(sum(c.tip_amount), 0.00) as tips
    from public.comandas c
    where c.tenant_id = p_tenant_id
      and c.status = 'fechada'
      and c.closed_at >= (p_start_date::timestamp at time zone p_timezone)
      and c.closed_at < ((p_end_date + 1)::timestamp at time zone p_timezone)
    group by business_day
  ),
  -- Formas de pagamento fixas: as 5 aparecem sempre, mesmo com zero.
  payment_methods (method, label, sort_order) as (
    values
      ('pix', 'PIX', 1),
      ('credit_card', 'Crédito', 2),
      ('debit_card', 'Débito', 3),
      ('cash', 'Dinheiro', 4),
      ('other', 'Outros', 5)
  ),
  -- Recebido: comanda_pagamentos de Comandas fechadas, pelo dia de negocio
  -- do PAGAMENTO (paid_at), nao do fechamento. Mesmo predicado de
  -- get_daily_financial_summary (junta comandas so para exigir status
  -- fechada), sem subtrair comanda_payment_reversals -- a tabela viva ja
  -- esta liquida de estornos (comanda reaberta apaga a linha viva e copia
  -- para o arquivo de estornos, entao ela some sozinha desta leitura).
  -- Filtro sobre tenant_id e paid_at crus (sem funcao sobre a coluna), para
  -- usar comanda_pagamentos_tenant_paid_at_idx. CTE PROPRIA, separada de
  -- recognized/items_agg: juntar as duas fontes (varias linhas por
  -- agrupamento cada) no mesmo group by multiplicaria os totais.
  received as (
    select
      (cp.paid_at at time zone p_timezone)::date as business_day,
      cp.payment_method,
      sum(cp.amount) as amount,
      count(*) as payments_count
    from public.comanda_pagamentos cp
    join public.comandas c
      on c.id = cp.comanda_id
     and c.tenant_id = cp.tenant_id
    where cp.tenant_id = p_tenant_id
      and c.status = 'fechada'
      and cp.paid_at >= (p_start_date::timestamp at time zone p_timezone)
      and cp.paid_at < ((p_end_date + 1)::timestamp at time zone p_timezone)
    group by business_day, cp.payment_method
  ),
  -- Recebido do periodo inteiro por forma (as 5 sempre presentes).
  received_totals_by_method as (
    select
      pm.method,
      pm.label,
      pm.sort_order,
      coalesce(sum(r.amount), 0.00) as amount,
      coalesce(sum(r.payments_count), 0) as payments_count
    from payment_methods pm
    left join received r on r.payment_method = pm.method
    group by pm.method, pm.label, pm.sort_order
  ),
  received_grand_total as (
    select coalesce(sum(amount), 0.00) as received_total
    from received_totals_by_method
  ),
  -- Recebido por agrupamento e forma (as 5 sempre presentes por
  -- agrupamento). Junta contra buckets via BETWEEN (uma linha por dia de
  -- negocio de received x 5 formas), mas e a UNICA fonte nesse join -- sem
  -- outra fonte fanned-out ao lado dela, entao nao ha produto cartesiano.
  bucket_received_method as (
    select
      b.bucket_start,
      b.bucket_end,
      pm.method,
      pm.label,
      pm.sort_order,
      coalesce(sum(r.amount), 0.00) as amount,
      coalesce(sum(r.payments_count), 0) as payments_count
    from buckets b
    cross join payment_methods pm
    left join received r
      on r.business_day between b.bucket_start and b.bucket_end
     and r.payment_method = pm.method
    group by b.bucket_start, b.bucket_end, pm.method, pm.label, pm.sort_order
  ),
  -- Recebido total por agrupamento, ja reduzido a uma linha por agrupamento
  -- (soma das 5 formas), para juntar em bucket_agg por igualdade sem
  -- fan-out.
  bucket_received_totals as (
    select bucket_start, bucket_end, coalesce(sum(amount), 0.00) as received
    from bucket_received_method
    group by bucket_start, bucket_end
  ),
  -- Bruto/liquido por agrupamento, reduzido a uma linha por agrupamento
  -- ANTES de juntar com as demais fontes (ver nota de correcao no topo do
  -- arquivo: evita produto cartesiano com comandas_bucket_agg em
  -- agrupamentos com mais de um dia de negocio).
  items_bucket_agg as (
    select
      b.bucket_start,
      b.bucket_end,
      coalesce(sum(ia.gross), 0.00) as gross,
      coalesce(sum(ia.net), 0.00) as net,
      coalesce(sum(ia.services_net), 0.00) as services_net,
      coalesce(sum(ia.products_net), 0.00) as products_net
    from buckets b
    left join items_agg ia on ia.business_day between b.bucket_start and b.bucket_end
    group by b.bucket_start, b.bucket_end
  ),
  -- Comandas fechadas e gorjetas por agrupamento, reduzido a uma linha por
  -- agrupamento pelo mesmo motivo.
  comandas_bucket_agg as (
    select
      b.bucket_start,
      b.bucket_end,
      coalesce(sum(ca.closed_comandas), 0) as closed_comandas,
      coalesce(sum(ca.tips), 0.00) as tips
    from buckets b
    left join comandas_agg ca on ca.business_day between b.bucket_start and b.bucket_end
    group by b.bucket_start, b.bucket_end
  ),
  -- Agrupamento final: junta as tres fontes ja reduzidas a uma linha por
  -- agrupamento, por igualdade de bucket_start/bucket_end -- join 1:1, sem
  -- fan-out possivel.
  bucket_agg as (
    select
      b.bucket_start,
      b.bucket_end,
      coalesce(iba.gross, 0.00) as gross,
      coalesce(iba.net, 0.00) as net,
      coalesce(iba.services_net, 0.00) as services_net,
      coalesce(iba.products_net, 0.00) as products_net,
      coalesce(cba.closed_comandas, 0) as closed_comandas,
      coalesce(cba.tips, 0.00) as tips,
      coalesce(brt.received, 0.00) as received
    from buckets b
    left join items_bucket_agg iba on iba.bucket_start = b.bucket_start and iba.bucket_end = b.bucket_end
    left join comandas_bucket_agg cba on cba.bucket_start = b.bucket_start and cba.bucket_end = b.bucket_end
    left join bucket_received_totals brt on brt.bucket_start = b.bucket_start and brt.bucket_end = b.bucket_end
  ),
  totals_row as (
    select
      coalesce(sum(gross), 0.00) as gross,
      coalesce(sum(net), 0.00) as net,
      coalesce(sum(services_net), 0.00) as services_net,
      coalesce(sum(products_net), 0.00) as products_net,
      coalesce(sum(closed_comandas), 0) as closed_comandas,
      coalesce(sum(tips), 0.00) as tips
    from bucket_agg
  ),
  -- Qualidade do dado do periodo inteiro, calculada direto (nao via
  -- report_recognized_items, que so emite linha para comanda com item) para
  -- casar exatamente com a classificacao de get_tenant_financial_metrics.
  quality_target_comandas as (
    select c.id
    from public.comandas c
    where c.tenant_id = p_tenant_id
      and c.status = 'fechada'
      and c.closed_at >= (p_start_date::timestamp at time zone p_timezone)
      and c.closed_at < ((p_end_date + 1)::timestamp at time zone p_timezone)
  ),
  quality_per_comanda as (
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
    from quality_target_comandas tc
    left join public.comanda_itens ci on ci.comanda_id = tc.id
    group by tc.id
  ),
  quality_counts as (
    select
      count(*) filter (where data_quality = 'confirmed') as confirmed_comandas,
      count(*) filter (where data_quality = 'estimated') as estimated_comandas,
      count(*) filter (where data_quality = 'legacy') as legacy_comandas
    from quality_per_comanda
  ),
  prev_recognized as (
    select * from private.report_recognized_items(p_tenant_id, v_prev_start, v_prev_end, p_timezone)
  ),
  prev_items_totals as (
    select
      coalesce(sum(gross), 0.00) as gross,
      coalesce(sum(net), 0.00) as net,
      coalesce(sum(net) filter (where item_type in ('servico', 'service') or service_id is not null), 0.00) as services_net,
      coalesce(sum(net) filter (where item_type in ('produto', 'product') or product_id is not null), 0.00) as products_net
    from prev_recognized
  ),
  prev_comandas_totals as (
    select
      count(*) as closed_comandas,
      coalesce(sum(c.tip_amount), 0.00) as tips
    from public.comandas c
    where c.tenant_id = p_tenant_id
      and c.status = 'fechada'
      and c.closed_at >= (v_prev_start::timestamp at time zone p_timezone)
      and c.closed_at < ((v_prev_end + 1)::timestamp at time zone p_timezone)
  ),
  -- Recebido do periodo anterior: so o total (a spec pede "mesmos campos"
  -- de totals em previous_totals, e totals so tem received_total -- a
  -- quebra por forma e o array received_by_method e do periodo pedido, nao
  -- do anterior).
  prev_received_total as (
    select coalesce(sum(cp.amount), 0.00) as received_total
    from public.comanda_pagamentos cp
    join public.comandas c
      on c.id = cp.comanda_id
     and c.tenant_id = cp.tenant_id
    where cp.tenant_id = p_tenant_id
      and c.status = 'fechada'
      and cp.paid_at >= (v_prev_start::timestamp at time zone p_timezone)
      and cp.paid_at < ((v_prev_end + 1)::timestamp at time zone p_timezone)
  )
  select jsonb_build_object(
    'timezone', p_timezone,
    'business_today', p_today,
    'period', jsonb_build_object('start', p_start_date, 'end', p_end_date),
    'previous_period', jsonb_build_object('start', v_prev_start, 'end', v_prev_end),
    'data_quality', jsonb_build_object(
      'status', case
        when qc.confirmed_comandas > 0 and qc.estimated_comandas = 0 and qc.legacy_comandas = 0 then 'confirmed'
        when qc.confirmed_comandas = 0 and qc.estimated_comandas > 0 and qc.legacy_comandas = 0 then 'estimated'
        when qc.confirmed_comandas = 0 and qc.estimated_comandas = 0 and qc.legacy_comandas > 0 then 'legacy'
        when qc.confirmed_comandas > 0 or qc.estimated_comandas > 0 then 'mixed'
        else 'unavailable'
      end,
      'confirmed_comandas', qc.confirmed_comandas,
      'estimated_comandas', qc.estimated_comandas,
      'legacy_comandas', qc.legacy_comandas
    ),
    'totals', jsonb_build_object(
      'gross', round(tr.gross, 2),
      'discounts', round(tr.gross - tr.net, 2),
      'net', round(tr.net, 2),
      'services_net', round(tr.services_net, 2),
      'products_net', round(tr.products_net, 2),
      'tips', round(tr.tips, 2),
      'closed_comandas', tr.closed_comandas,
      'received_total', round(rgt.received_total, 2)
    ),
    'previous_totals', jsonb_build_object(
      'gross', round(pit.gross, 2),
      'discounts', round(pit.gross - pit.net, 2),
      'net', round(pit.net, 2),
      'services_net', round(pit.services_net, 2),
      'products_net', round(pit.products_net, 2),
      'tips', round(pct.tips, 2),
      'closed_comandas', pct.closed_comandas,
      'received_total', round(prt.received_total, 2)
    ),
    'received_by_method', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'method', rtm.method,
          'label', rtm.label,
          'amount', round(rtm.amount, 2),
          'payments_count', rtm.payments_count,
          'share', case when rgt.received_total > 0 then round(rtm.amount / rgt.received_total, 4) else null end
        )
        order by rtm.sort_order
      ) from received_totals_by_method rtm),
      '[]'::jsonb
    ),
    'buckets', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'start_date', ba.bucket_start,
          'end_date', ba.bucket_end,
          'gross', round(ba.gross, 2),
          'discounts', round(ba.gross - ba.net, 2),
          'net', round(ba.net, 2),
          'services_net', round(ba.services_net, 2),
          'products_net', round(ba.products_net, 2),
          'tips', round(ba.tips, 2),
          'closed_comandas', ba.closed_comandas,
          'received', round(ba.received, 2),
          'received_by_method', (
            select jsonb_agg(
              jsonb_build_object(
                'method', brm.method,
                'label', brm.label,
                'amount', round(brm.amount, 2),
                'payments_count', brm.payments_count
              )
              order by brm.sort_order
            )
            from bucket_received_method brm
            where brm.bucket_start = ba.bucket_start and brm.bucket_end = ba.bucket_end
          )
        )
        order by ba.bucket_start
      ) from bucket_agg ba),
      '[]'::jsonb
    )
  )
  into v_result
  from totals_row tr, quality_counts qc, prev_items_totals pit, prev_comandas_totals pct, received_grand_total rgt, prev_received_total prt;

  return v_result;
end;
$function$;

comment on function private.get_revenue_report_core(uuid, date, date, text, date, text) is
  'Nucleo do relatorio de Faturamento por periodo (spec 038, tickets 01+02): recebe "hoje" injetado, valida periodo e granularidade, agrega Receita Reconhecida de Item por agrupamento e Recebido por forma de pagamento (paid_at, sem subtrair estornos). Sem checagem de acesso.';
