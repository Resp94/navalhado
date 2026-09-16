-- Ticket 01 da spec 038 (Modulo de Relatorios): esqueleto do modulo e
-- Faturamento por periodo, ponta a ponta.
-- Spec: specs/038-modulo-de-relatorios/spec.md, secoes "Posicao no produto",
-- "Leitura: um contrato por pagina", "Padroes de banco", "Periodo", "Regras
-- de dominio compartilhadas" (Receita Reconhecida de Item), "1-3.
-- get_revenue_report" e "Indices".
--
-- Esta fatia cobre so totais/buckets/data_quality/period/previous_period do
-- Faturamento por periodo (relatorio 1). Recebido por forma de pagamento
-- (relatorio 2) e ticket medio (relatorio 3) sao tickets seguintes (02/03),
-- que estendem o mesmo contrato com CREATE OR REPLACE FUNCTION.

-- Indice novo: comandas so tinha indice por (tenant_id, status), que nao
-- ajuda no recorte por closed_at que o relatorio de faturamento faz.
create index if not exists idx_comandas_tenant_closed_at_fechada
  on public.comandas (tenant_id, closed_at)
  where status = 'fechada';

-- Funcao privada compartilhada: Receita Reconhecida de Item. Recebe tenant e
-- intervalo (datas civis + fuso) e devolve, por item de Comanda fechada cujo
-- closed_at cai no intervalo, o valor reconhecido pela mesma regra de
-- get_tenant_financial_metrics: confirmado/estimado pelo snapshot,
-- indisponivel pelo preco total, revertido ou sem snapshot vale zero.
-- ATENCAO: filtra so status = 'fechada'. get_tenant_financial_metrics filtra
-- status in ('fechada', 'closed') por compatibilidade com um valor legado que
-- o CHECK atual de comandas.status ja proibe gravar -- por isso as duas
-- leituras coincidem hoje, mas nao sao a mesma consulta. Se o CHECK for
-- relaxado e 'closed' voltar a existir, esta funcao e get_tenant_financial_metrics
-- precisam ser atualizadas juntas, ou o teste cruzado (33_relatorio_faturamento)
-- vai divergir silenciosamente. Language sql + STABLE para o
-- planejador poder embutir a consulta e empurrar os filtros de tenant e data
-- para dentro. Sem grant para authenticated nem anon: so as funcoes
-- definidoras (via o role elevado que elas assumem) a chamam.
create or replace function private.report_recognized_items(
  p_tenant_id uuid,
  p_start date,
  p_end date,
  p_tz text
)
returns table (
  comanda_id uuid,
  item_type text,
  service_id uuid,
  product_id uuid,
  professional_id uuid,
  customer_id uuid,
  gross numeric,
  net numeric,
  quantity integer,
  commission numeric,
  business_day date,
  comanda_data_quality text
)
language sql
stable
set search_path = ''
as $function$
  with target_comandas as (
    select c.id, c.customer_id, c.closed_at
    from public.comandas c
    where c.tenant_id = p_tenant_id
      and c.status = 'fechada'
      and c.closed_at >= (p_start::timestamp at time zone p_tz)
      and c.closed_at < ((p_end + 1)::timestamp at time zone p_tz)
  ),
  item_quality as (
    select
      tc.id as comanda_id,
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
    ci.comanda_id,
    ci.item_type,
    ci.service_id,
    ci.product_id,
    ci.professional_id,
    tc.customer_id,
    (case
      when ci.snapshot_status in ('confirmed', 'estimated') and ci.snapshot_gross_amount is not null
        then ci.snapshot_gross_amount
      when ci.snapshot_status = 'unavailable' and ci.total_price is not null
        then ci.total_price
      else 0.00
    end)::numeric as gross,
    (case
      when ci.snapshot_status in ('confirmed', 'estimated') and ci.snapshot_net_amount is not null
        then ci.snapshot_net_amount
      when ci.snapshot_status = 'unavailable' and ci.total_price is not null
        then ci.total_price
      else 0.00
    end)::numeric as net,
    (case
      when ci.snapshot_status in ('confirmed', 'estimated') then coalesce(ci.snapshot_quantity, ci.quantity)
      when ci.snapshot_status = 'unavailable' then coalesce(ci.quantity, 0)
      else 0
    end)::integer as quantity,
    (case
      when ci.snapshot_status in ('confirmed', 'estimated') and ci.snapshot_commission_amount is not null
        then ci.snapshot_commission_amount
      else 0.00
    end)::numeric as commission,
    (tc.closed_at at time zone p_tz)::date as business_day,
    iq.data_quality as comanda_data_quality
  from target_comandas tc
  join public.comanda_itens ci on ci.comanda_id = tc.id
  join item_quality iq on iq.comanda_id = tc.id
$function$;

comment on function private.report_recognized_items(uuid, date, date, text) is
  'Receita Reconhecida de Item (spec 038): itens de Comandas fechadas no intervalo, com a mesma regra de reconhecimento de get_tenant_financial_metrics. Sem checagem de acesso, sem grant para authenticated/anon.';

revoke all on function private.report_recognized_items(uuid, date, date, text) from public, anon, authenticated;
grant execute on function private.report_recognized_items(uuid, date, date, text) to service_role;

-- Nucleo privado do relatorio de faturamento: recebe "hoje" e o fuso como
-- parametros (nunca le now() para decidir o dia de negocio). Valida periodo
-- e granularidade com os mesmos limites do repositorio do modulo
-- src/modules/relatorios/. Nao faz checagem de acesso: quem chama (a funcao
-- publica) ja resolveu e validou o tenant.
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
  bucket_agg as (
    select
      b.bucket_start,
      b.bucket_end,
      coalesce(sum(ia.gross), 0.00) as gross,
      coalesce(sum(ia.net), 0.00) as net,
      coalesce(sum(ia.services_net), 0.00) as services_net,
      coalesce(sum(ia.products_net), 0.00) as products_net,
      coalesce(sum(ca.closed_comandas), 0) as closed_comandas,
      coalesce(sum(ca.tips), 0.00) as tips
    from buckets b
    left join items_agg ia on ia.business_day between b.bucket_start and b.bucket_end
    left join comandas_agg ca on ca.business_day between b.bucket_start and b.bucket_end
    group by b.bucket_start, b.bucket_end
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
      'closed_comandas', tr.closed_comandas
    ),
    'previous_totals', jsonb_build_object(
      'gross', round(pit.gross, 2),
      'discounts', round(pit.gross - pit.net, 2),
      'net', round(pit.net, 2),
      'services_net', round(pit.services_net, 2),
      'products_net', round(pit.products_net, 2),
      'tips', round(pct.tips, 2),
      'closed_comandas', pct.closed_comandas
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
          'closed_comandas', ba.closed_comandas
        )
        order by ba.bucket_start
      ) from bucket_agg ba),
      '[]'::jsonb
    )
  )
  into v_result
  from totals_row tr, quality_counts qc, prev_items_totals pit, prev_comandas_totals pct;

  return v_result;
end;
$function$;

comment on function private.get_revenue_report_core(uuid, date, date, text, date, text) is
  'Nucleo do relatorio de Faturamento por periodo (spec 038, ticket 01): recebe "hoje" injetado, valida periodo e granularidade, e agrega Receita Reconhecida de Item por agrupamento. Sem checagem de acesso.';

revoke all on function private.get_revenue_report_core(uuid, date, date, text, date, text) from public, anon, authenticated;
grant execute on function private.get_revenue_report_core(uuid, date, date, text, date, text) to service_role;

-- Funcao publica: valida acesso (gerente do proprio tenant, recusando tenant
-- nulo; proprietario em qualquer tenant, tratamento das demais RPCs
-- financeiras) e parametros, resolve o fuso e o dia de negocio de hoje do
-- tenant, e delega ao nucleo privado.
create or replace function public.get_revenue_report(
  p_tenant_id uuid,
  p_start_date date,
  p_end_date date,
  p_granularity text
)
returns jsonb
language plpgsql
stable
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
    raise exception 'Acesso negado. Apenas gerentes podem acessar os relatórios.' using errcode = '42501';
  end if;

  if v_user_role = 'gerente' then
    -- Bloqueio de gerente com tenant nulo (mesmo teste pgTAP 32): nunca
    -- comparar p_tenant_id com um tenant nulo via <>/is distinct sem checar
    -- antes, senao um gerente mal cadastrado passaria para qualquer tenant.
    if v_user_tenant is null then
      raise exception 'Acesso negado. Gerente sem unidade vinculada.' using errcode = '42501';
    end if;
    if p_tenant_id is not null and p_tenant_id is distinct from v_user_tenant then
      raise exception 'Acesso negado para a unidade solicitada.' using errcode = '42501';
    end if;
    v_target_tenant := v_user_tenant;
  else
    -- proprietario: tratamento identico as demais RPCs financeiras, aceito
    -- para qualquer tenant informado (acesso de suporte do administrador do
    -- SaaS, intencional).
    v_target_tenant := coalesce(p_tenant_id, v_user_tenant);
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

  return private.get_revenue_report_core(
    v_target_tenant, p_start_date, p_end_date, p_granularity, v_today, v_timezone
  );
end;
$function$;

comment on function public.get_revenue_report(uuid, date, date, text) is
  'Faturamento por periodo (spec 038, ticket 01): bruto, descontos, liquido, servicos, produtos, gorjetas e Comandas fechadas por agrupamento de dia, semana ou mes, com periodo anterior e qualidade do dado. Gerente do proprio tenant (tenant nulo recusado); proprietario acessa qualquer tenant.';

revoke all on function public.get_revenue_report(uuid, date, date, text) from public, anon;
grant execute on function public.get_revenue_report(uuid, date, date, text) to authenticated, service_role;
