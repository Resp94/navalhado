-- Ticket 01 da spec 037 (Fluxo de Caixa Projetado): tracer bullet do
-- Realizado de Comandas ponta a ponta.
-- Spec: specs/037-fluxo-de-caixa-projetado/spec.md, secoes "Fontes do
-- realizado, lidas nos livros de origem", "Periodos e agrupamento",
-- "Contrato de leitura" e "Indices".
--
-- Esta fatia cobre so entradas realizadas (pagamentos de Comanda fechada).
-- Os tickets seguintes (02 a 08) estendem public.get_projected_cash_flow e
-- private.get_projected_cash_flow_core com saidas realizadas, estimativa de
-- entrada, saidas previstas e Compromissos sem Data -- por isso o contrato
-- devolve hoje so o subconjunto do formato completo descrito na spec
-- (timezone, business_today, buckets com inflow_realized, pending_flow e
-- detail.inflow_by_method).
--
-- Indice novo: comanda_pagamentos ainda nao tinha indice por unidade e
-- momento do pagamento, e a consulta filtra exatamente por isso.
create index if not exists comanda_pagamentos_tenant_paid_at_idx
  on public.comanda_pagamentos (tenant_id, paid_at);

-- Nucleo privado: recebe "hoje" e o fuso como parametros (nunca le now()
-- para decidir o dia de negocio), para que os testes de agrupamento e de
-- limite de validacao sejam deterministicos sem esperar o relogio real.
-- Valida periodo e granularidade com os mesmos limites do repositorio do
-- modulo `src/modules/fluxo-caixa/`. Nao faz checagem de acesso: quem chama
-- (a funcao publica) ja resolveu e validou o tenant.
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
  bucket_agg as (
    select
      b.bucket_start,
      b.bucket_end,
      b.kind,
      coalesce(sum(d.total), 0.00) as inflow_realized,
      -- pending_flow, nesta fatia, e so o realizado com data posterior a
      -- hoje (ex.: agrupamentos futuros inteiros). Os tickets seguintes
      -- somam aqui estimativa, previsto e vencido.
      coalesce(sum(d.total) filter (where d.local_date > p_today), 0.00) as pending_flow,
      coalesce(sum(d.dinheiro), 0.00) as dinheiro,
      coalesce(sum(d.pix), 0.00) as pix,
      coalesce(sum(d.cartao), 0.00) as cartao,
      coalesce(sum(d.outros), 0.00) as outros
    from buckets b
    left join daily_agg d on d.local_date between b.bucket_start and b.bucket_end
    group by b.bucket_start, b.bucket_end, b.kind
  )
  select jsonb_build_object(
    'timezone', p_timezone,
    'business_today', p_today,
    'buckets', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'start_date', bucket_start,
          'end_date', bucket_end,
          'kind', kind,
          'inflow_realized', round(inflow_realized, 2),
          'pending_flow', round(pending_flow, 2),
          'detail', jsonb_build_object(
            'inflow_by_method', jsonb_build_object(
              'dinheiro', round(dinheiro, 2),
              'pix', round(pix, 2),
              'cartao', round(cartao, 2),
              'outros', round(outros, 2)
            )
          )
        )
        order by bucket_start
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from bucket_agg;

  return v_result;
end;
$function$;

comment on function private.get_projected_cash_flow_core(uuid, date, date, text, date, text) is
  'Nucleo do fluxo de caixa projetado (ticket 01 da spec 037): recebe "hoje" injetado, valida periodo e granularidade e agrega entradas realizadas de pagamentos de Comanda por agrupamento. Sem checagem de acesso.';

revoke all on function private.get_projected_cash_flow_core(uuid, date, date, text, date, text) from public, anon, authenticated;
grant execute on function private.get_projected_cash_flow_core(uuid, date, date, text, date, text) to service_role;

-- Funcao publica: valida acesso (gerente do proprio tenant; proprietario em
-- qualquer tenant, o mesmo tratamento das demais RPCs financeiras), resolve
-- o fuso do tenant e o dia de negocio de hoje, e delega ao nucleo privado.
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
  'Fluxo de Caixa Projetado (spec 037, ticket 01): entradas realizadas de Comandas fechadas por agrupamento de dia, semana ou mes. Superficie do gerente do proprio tenant; proprietario acessa qualquer tenant.';

revoke all on function public.get_projected_cash_flow(uuid, date, date, text) from public, anon;
grant execute on function public.get_projected_cash_flow(uuid, date, date, text) to authenticated, service_role;
