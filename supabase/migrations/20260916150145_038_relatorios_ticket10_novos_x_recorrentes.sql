-- Ticket 10 da spec 038 (Modulo de Relatorios): Novos x recorrentes,
-- quarta pagina "Clientes" (/relatorios/clientes). Novo contrato
-- get_customer_report. Spec: specs/038-modulo-de-relatorios/spec.md, secao
-- "9-10. get_customer_report" e historias 65 a 70.
--
-- Esta fatia cobre SO visitantes/novos/recorrentes/clientes-de-uma-visita
-- (visitors, previous_visitors, buckets[], single_visit_customers[]). O
-- campo `registrations` (origem de cadastro/canal de aquisicao) do mesmo
-- contrato e o ticket 11, que faz CREATE OR REPLACE nesta mesma funcao
-- depois para acrescenta-lo. NAO implementado aqui.
--
-- Indices: nenhum novo. idx_appointments_tenant_start_time (ticket 07),
-- idx_comandas_tenant_closed_at_fechada (ticket 01) e
-- idx_appointments_tenant_customer_start_time (ticket 09) ja cobrem as
-- consultas deste ticket (confirmado contra pg_indexes no banco dev antes de
-- escrever esta migracao). `customers (tenant_id, created_at)` e so para o
-- ticket 11 (registrations), nao criado aqui.
--
-- Relogio: SO p_today (date), sem p_now (timestamptz). Diferente do ticket
-- 07/09, nada aqui classifica por INSTANTE -- Visita e um conceito de DIA de
-- negocio (business_day), e a propria definicao de "Cliente de Uma Visita"
-- e "unica Visita ATE HOJE" (uma data, nao um instante). Nao ha Agendamento
-- futuro para checar aqui (isso e do ticket 09). Injetar p_now seria
-- parametro morto; a validacao do fuso (que nos outros nucleos forca
-- `perform p_now/now() at time zone p_timezone`) usa `p_today` aqui, nunca
-- now().
--
-- Nucleo usa private.report_customer_visits(p_tenant_id, p_timezone) UMA
-- VEZ, materializada em CTE, e deriva visitors/previous_visitors/buckets/
-- single_visit_customers dela. Cada fonte (Visita completa; Visita do
-- periodo; Visita do periodo anterior; Comandas sem cliente do periodo e do
-- anterior) e reduzida a uma linha por cliente (ou agregada direto) na
-- PROPRIA CTE antes de qualquer join, evitando produto cartesiano.
--
-- Regras (spec, secao "9-10"):
--   Cliente Novo no periodo = primeira Visita da vida (min(business_day)
--     sobre TODO o historico do cliente) cai dentro do periodo.
--   Cliente Recorrente = teve Visita no periodo e ja tinha Visita antes do
--     inicio do periodo (primeira Visita da vida < inicio do periodo).
--   unique_customers = novos + recorrentes (mutuamente exclusivos, cobrem
--     todo mundo com Visita no periodo).
--   Nos buckets, Novo conta no bucket da primeira Visita da vida (que cai no
--     periodo, por definicao); Recorrente conta no bucket da primeira Visita
--     DELE DENTRO DO PERIODO (nao a mais recente).
--   Cliente de Uma Visita = Cliente Novo do periodo cuja UNICA Visita, ATE
--     HOJE (p_today, nao ate o fim do periodo), e a do periodo -- ou seja,
--     conta(distinct business_day) ate p_today = 1 para esse cliente.
--     Lista limitada a 200, mais recentes primeiro.
--   Atendimentos sem cliente identificado = Comandas fechada sem
--     customer_id no periodo, contadas direto de public.comandas (Visita ja
--     filtra customer_id is not null, entao nao serve para isso).
--
-- Decisao sem precedente explicito na spec: previous_visitors NAO tem o
-- campo new_single_visit. "Cliente de Uma Visita" depende de "ate hoje"
-- (um corte movel), o que nao faz sentido para um periodo anterior FIXO no
-- passado -- o numero mudaria a cada execucao sem o periodo anterior nunca
-- mudar, o que contradiz a ideia de "periodo anterior" como fotografia
-- comparavel e estavel. Omitido do jsonb (a chave nao aparece).
create or replace function private.get_customer_report_core(
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
  -- Forca a validacao do fuso antes de qualquer agregacao. Usa p_today
  -- (injetado), nunca now(): este nucleo nao precisa de p_now (ver nota
  -- acima), e usar now() so para validar violaria o contrato "relogio
  -- injetado, nunca lido" (o mesmo lapso corrigido no ticket 07).
  perform p_today::timestamp at time zone p_timezone;

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
  -- Visita, na propria CTE, UMA VEZ so (varre todo o historico do tenant).
  visits as (
    select * from private.report_customer_visits(p_tenant_id, p_timezone)
  ),
  -- Primeira Visita da vida e total de dias de Visita ate hoje, por cliente,
  -- direto de "visits" (reduzido a uma linha por cliente ANTES de qualquer
  -- join, evitando produto cartesiano).
  life_agg as (
    select
      customer_id,
      min(business_day) as life_first_visit_date,
      count(distinct business_day) filter (where business_day <= p_today) as visits_to_date_count
    from visits
    group by customer_id
  ),
  -- Primeira Visita DENTRO DO PERIODO, por cliente (so quem tem Visita no
  -- periodo aparece aqui).
  period_first_agg as (
    select
      customer_id,
      min(business_day) as period_first_visit_date
    from visits
    where business_day between p_start_date and p_end_date
    group by customer_id
  ),
  -- Um cliente por linha, ja classificado Novo x Recorrente. A primeira
  -- Visita da vida de quem tem Visita no periodo nunca e depois do fim do
  -- periodo (e <= a primeira Visita dele no periodo), entao "primeira Visita
  -- da vida dentro do periodo" equivale a "primeira Visita da vida >= inicio
  -- do periodo".
  period_customers as (
    select
      pfa.customer_id,
      pfa.period_first_visit_date,
      la.life_first_visit_date,
      la.visits_to_date_count,
      (la.life_first_visit_date >= p_start_date) as is_new
    from period_first_agg pfa
    join life_agg la on la.customer_id = pfa.customer_id
  ),
  visitors_agg as (
    select
      count(*) as unique_customers,
      count(*) filter (where is_new) as new_customers,
      count(*) filter (where not is_new) as returning_customers,
      count(*) filter (where is_new and visits_to_date_count = 1) as new_single_visit
    from period_customers
  ),
  unidentified_agg as (
    select count(*) as unidentified_attendances
    from public.comandas c
    where c.tenant_id = p_tenant_id
      and c.status = 'fechada'
      and c.customer_id is null
      and c.closed_at >= (p_start_date::timestamp at time zone p_timezone)
      and c.closed_at < ((p_end_date + 1)::timestamp at time zone p_timezone)
  ),
  -- Periodo anterior: mesma logica, reaproveitando life_agg (ja calculado
  -- sobre todo o historico, nao precisa recalcular).
  prev_period_first_agg as (
    select
      customer_id,
      min(business_day) as period_first_visit_date
    from visits
    where business_day between v_prev_start and v_prev_end
    group by customer_id
  ),
  prev_period_customers as (
    select
      ppfa.customer_id,
      la.life_first_visit_date,
      (la.life_first_visit_date >= v_prev_start) as is_new
    from prev_period_first_agg ppfa
    join life_agg la on la.customer_id = ppfa.customer_id
  ),
  prev_visitors_agg as (
    select
      count(*) as unique_customers,
      count(*) filter (where is_new) as new_customers,
      count(*) filter (where not is_new) as returning_customers
    from prev_period_customers
  ),
  prev_unidentified_agg as (
    select count(*) as unidentified_attendances
    from public.comandas c
    where c.tenant_id = p_tenant_id
      and c.status = 'fechada'
      and c.customer_id is null
      and c.closed_at >= (v_prev_start::timestamp at time zone p_timezone)
      and c.closed_at < ((v_prev_end + 1)::timestamp at time zone p_timezone)
  ),
  -- Buckets: Novo conta no bucket da primeira Visita da vida (que cai no
  -- periodo); Recorrente conta no bucket da primeira Visita DELE DENTRO DO
  -- PERIODO. period_customers ja tem uma linha por cliente, entao o join com
  -- buckets (via between) nao multiplica linhas alem do necessario.
  bucket_agg as (
    select
      b.bucket_start,
      b.bucket_end,
      count(pc.customer_id) filter (
        where pc.is_new and pc.life_first_visit_date between b.bucket_start and b.bucket_end
      ) as new_customers,
      count(pc.customer_id) filter (
        where not pc.is_new and pc.period_first_visit_date between b.bucket_start and b.bucket_end
      ) as returning_customers
    from buckets b
    left join period_customers pc
      on (pc.is_new and pc.life_first_visit_date between b.bucket_start and b.bucket_end)
      or (not pc.is_new and pc.period_first_visit_date between b.bucket_start and b.bucket_end)
    group by b.bucket_start, b.bucket_end
  ),
  -- Clientes de Uma Visita: Novo do periodo com so uma Visita ate hoje. A
  -- Visita unica deles e a propria primeira Visita da vida (= period_first,
  -- pois so tem uma), entao busca em "visits" pelo (customer_id,
  -- life_first_visit_date) para telefone/profissional.
  single_visit_candidates as (
    select
      pc.customer_id,
      pc.life_first_visit_date as visit_date
    from period_customers pc
    where pc.is_new and pc.visits_to_date_count = 1
  ),
  single_visit_detail as (
    select
      svc.customer_id,
      svc.visit_date,
      v.professional_name
    from single_visit_candidates svc
    join visits v on v.customer_id = svc.customer_id and v.business_day = svc.visit_date
  )
  select jsonb_build_object(
    'timezone', p_timezone,
    'business_today', p_today,
    'period', jsonb_build_object('start', p_start_date, 'end', p_end_date),
    'previous_period', jsonb_build_object('start', v_prev_start, 'end', v_prev_end),
    'visitors', jsonb_build_object(
      'unique_customers', va.unique_customers,
      'new_customers', va.new_customers,
      'returning_customers', va.returning_customers,
      'new_single_visit', va.new_single_visit,
      'unidentified_attendances', ua.unidentified_attendances
    ),
    'previous_visitors', jsonb_build_object(
      'unique_customers', pva.unique_customers,
      'new_customers', pva.new_customers,
      'returning_customers', pva.returning_customers,
      'unidentified_attendances', pua.unidentified_attendances
    ),
    'buckets', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'start_date', ba.bucket_start,
          'end_date', ba.bucket_end,
          'new_customers', ba.new_customers,
          'returning_customers', ba.returning_customers
        )
        order by ba.bucket_start
      ) from bucket_agg ba),
      '[]'::jsonb
    ),
    'single_visit_customers', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'customer_id', svd.customer_id,
          'name', cu.name,
          'phone', cu.phone,
          'visit_date', svd.visit_date,
          'professional_name', svd.professional_name
        )
        order by svd.visit_date desc, svd.customer_id
      )
      from (
        select * from single_visit_detail
        order by visit_date desc, customer_id
        limit 200
      ) svd
      join public.customers cu on cu.id = svd.customer_id),
      '[]'::jsonb
    )
  )
  into v_result
  from visitors_agg va, unidentified_agg ua, prev_visitors_agg pva, prev_unidentified_agg pua;

  return v_result;
end;
$function$;

comment on function private.get_customer_report_core(uuid, date, date, text, date, text) is
  'Nucleo de Novos x recorrentes (spec 038, ticket 10): usa private.report_customer_visits UMA VEZ. Cliente Novo = primeira Visita da vida cai no periodo; Recorrente = teve Visita no periodo e ja tinha Visita antes do inicio. Buckets: Novo pela primeira Visita da vida, Recorrente pela primeira Visita dele dentro do periodo. Cliente de Uma Visita = Novo do periodo com so uma Visita ate p_today (lista ate 200, mais recentes primeiro). Atendimentos sem cliente identificado = Comandas fechada sem customer_id, contadas direto (Visita ja exige customer_id). previous_visitors nao tem new_single_visit (depende de "ate hoje", incompativel com periodo anterior fixo). So p_today injetado (sem p_now: nada aqui classifica por instante). Sem checagem de acesso, sem registrations (ticket 11).';

revoke all on function private.get_customer_report_core(uuid, date, date, text, date, text) from public, anon, authenticated;
grant execute on function private.get_customer_report_core(uuid, date, date, text, date, text) to service_role;

-- Funcao publica: mesmo padrao de acesso e validacao das demais RPCs de
-- relatorio (gerente do proprio tenant, tenant nulo recusado; proprietario
-- em qualquer tenant), mensagens de erro identicas ao ticket 01.
create or replace function public.get_customer_report(
  p_tenant_id uuid,
  p_start_date date,
  p_end_date date,
  p_granularity text default 'day'
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

  return private.get_customer_report_core(
    v_target_tenant, p_start_date, p_end_date, p_granularity, v_today, v_timezone
  );
end;
$function$;

comment on function public.get_customer_report(uuid, date, date, text) is
  'Novos x recorrentes (spec 038, ticket 10): visitantes unicos/novos/recorrentes/novos-de-uma-visita/sem-cliente do periodo e do anterior, agrupamento por dia/semana/mes e lista de Clientes de Uma Visita (ate 200). Reusa a Visita do ticket 09. Gerente do proprio tenant (tenant nulo recusado); proprietario acessa qualquer tenant. Ainda sem `registrations` (ticket 11 faz CREATE OR REPLACE para acrescentar).';

revoke all on function public.get_customer_report(uuid, date, date, text) from public, anon;
grant execute on function public.get_customer_report(uuid, date, date, text) to authenticated, service_role;
