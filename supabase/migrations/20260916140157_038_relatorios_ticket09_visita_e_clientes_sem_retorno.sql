-- Ticket 09 da spec 038 (Modulo de Relatorios): Visita (segunda regra de
-- dominio compartilhada da spec) e Clientes sem Retorno (relatorio 8), novo
-- contrato de leitura da propria pagina /relatorios/clientes-sem-retorno.
-- Spec: specs/038-modulo-de-relatorios/spec.md, secoes "Regras de dominio
-- compartilhadas" (Visita) e "8. get_customers_without_return".
--
-- Sem periodo: e uma fotografia de hoje (so p_today/p_now injetados, sem
-- p_start_date/p_end_date).

-- Indice novo: hoje so existe indice por cliente isolado
-- (idx_appointments_customer_id) e por (tenant_id, start_time) sem cliente.
-- A busca da ultima Visita por Agendamento e do Agendamento futuro
-- pending/confirmed filtra pelos tres campos juntos.
create index if not exists idx_appointments_tenant_customer_start_time
  on public.appointments (tenant_id, customer_id, start_time);

-- Funcao privada compartilhada: Visita. Um cliente identificado esteve na
-- barbearia num dia de negocio (no fuso p_tz) por Agendamento concluido ou
-- por Comanda fechada com customer_id preenchido; os dois no mesmo dia sao
-- uma Visita so. Language sql + STABLE (mesmo padrao de
-- report_recognized_items, ticket 01) para o planejador poder embutir a
-- consulta. Sem grant para authenticated nem anon: so as funcoes definidoras
-- (via o role elevado que assumem) a chamam.
--
-- Shape escolhido: uma linha por (customer_id, business_day), com os
-- servicos e o prazo minimo JA resolvidos para esse dia (nao uma linha por
-- item), porque o unico consumidor (o nucleo de Clientes sem Retorno) so
-- precisa da ULTIMA Visita de cada cliente, com o prazo minimo entre os
-- servicos dessa visita e o nome do ultimo servico/profissional para
-- exibicao -- nao precisa do detalhe por item. Agregar aqui, uma vez, evita
-- repetir a logica de "servico da Visita" em cada nucleo que vier a usar
-- Visita no futuro (ex.: relatorio 9-10, ticket ainda nao implementado).
--
-- Prioridade dos campos (fielmente a spec): servicos_realizados vem dos
-- itens de servico da Comanda quando ha Comanda fechada nesse dia (a
-- Comanda e o registro definitivo do que foi de fato cobrado); quando nao ha
-- Comanda fechada nesse dia, vem do servico do Agendamento. O profissional e
-- o inverso: vem do Agendamento quando ha Agendamento concluido nesse dia (o
-- Agendamento e um valor unico e confiavel de quem foi escalado); quando nao
-- ha Agendamento concluido nesse dia, vem do item de servico de MAIOR VALOR
-- da Comanda (que pode ter varios profissionais quando dividida). O prazo de
-- retorno minimo acompanha a mesma fonte escolhida para os servicos (nao um
-- minimo entre as duas fontes), para nao misturar prazo de um servico com o
-- nome de outro.
--
-- Armadilha do produto cartesiano: cada fonte (Agendamentos concluidos;
-- Comandas fechadas, so para marcar o dia; itens de servico de Comanda
-- fechada, para os detalhes) e agregada na PROPRIA CTE, reduzida a uma linha
-- por (customer_id, business_day) ANTES de qualquer join com as outras.
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
    -- Marca o dia como Visita mesmo quando a Comanda fechada nao tem item de
    -- servico (por exemplo, so produto) -- a Visita depende so de existir
    -- Comanda fechada com cliente, nao do conteudo dela.
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
      case when cd.business_day is not null then csa.service_names else aa.service_names end as service_names,
      case when aa.business_day is not null then aa.professional_id else csa.professional_id end as professional_id,
      case when cd.business_day is not null then csa.return_period_days_min else aa.return_period_days_min end as return_period_days_min
    from all_days d
    left join appt_agg aa on aa.customer_id = d.customer_id and aa.business_day = d.business_day
    left join comanda_days cd on cd.customer_id = d.customer_id and cd.business_day = d.business_day
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
  'Visita (spec 038): por cliente identificado e dia de negocio (fuso p_tz), uma linha com os servicos realizados e o profissional, unindo Agendamento completed e Comanda fechada com customer_id (mesmo dia = uma Visita so). Servicos preferem a Comanda quando ha Comanda fechada no dia; profissional prefere o Agendamento quando ha Agendamento concluido no dia. Sem checagem de acesso, sem grant para authenticated/anon.';

revoke all on function private.report_customer_visits(uuid, text) from public, anon, authenticated, service_role;

-- Nucleo privado: relogio duplo injetado (p_today para "dias desde a ultima
-- Visita"; p_now para "Agendamento futuro pending/confirmed"), nunca now().
-- language plpgsql (precisa de validacao e jsonb_build_object condicional),
-- STABLE, SECURITY DEFINER (chama report_customer_visits, que nao tem
-- grant). Sem checagem de acesso: quem chama (a funcao publica) ja resolveu
-- e validou o tenant.
create or replace function private.get_customers_without_return_core(
  p_tenant_id uuid,
  p_overdue_band text,
  p_professional_id uuid,
  p_limit integer,
  p_offset integer,
  p_today date,
  p_now timestamptz,
  p_timezone text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if p_tenant_id is null then
    raise exception 'Unidade (tenant_id) não informada.' using errcode = '22023';
  end if;
  if p_today is null then
    raise exception 'A data de hoje é obrigatória para calcular o relatório.' using errcode = '22023';
  end if;
  if p_now is null then
    raise exception 'O instante atual é obrigatório para calcular o relatório.' using errcode = '22023';
  end if;
  if p_timezone is null or btrim(p_timezone) = '' then
    raise exception 'O fuso horário da unidade é obrigatório.' using errcode = '22023';
  end if;
  -- Forca a validacao do fuso antes de qualquer agregacao. Usa p_now, nunca
  -- now(), para manter o nucleo determinista (relogio injetado, nao lido).
  perform p_now at time zone p_timezone;

  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'O limite deve estar entre 1 e 100.' using errcode = '22023';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception 'O deslocamento não pode ser negativo.' using errcode = '22023';
  end if;
  if p_overdue_band is not null and p_overdue_band not in ('up_to_15', 'd16_30', 'd31_60', 'over_60') then
    raise exception 'Faixa de atraso desconhecida. Use até 15, 16 a 30, 31 a 60 ou mais de 60 dias.' using errcode = '22023';
  end if;

  with visits as (
    select * from private.report_customer_visits(p_tenant_id, p_timezone)
  ),
  -- Ultima Visita de cada cliente do tenant (uma linha por cliente).
  last_visit as (
    select distinct on (v.customer_id)
      v.customer_id,
      v.business_day as last_visit_date,
      v.service_names,
      v.return_period_days_min,
      v.professional_id,
      v.professional_name
    from visits v
    order by v.customer_id, v.business_day desc
  ),
  -- p_professional_id filtra pelo profissional da ULTIMA Visita.
  last_visit_filtered as (
    select *
    from last_visit lv
    where p_professional_id is null or lv.professional_id = p_professional_id
  ),
  -- Agendamento futuro pending/confirmed com start_time > p_now, por
  -- cliente (uma linha por cliente que tem ao menos um).
  future_appointment as (
    select distinct a.customer_id
    from public.appointments a
    where a.tenant_id = p_tenant_id
      and a.customer_id is not null
      and a.status in ('pending', 'confirmed')
      and a.start_time > p_now
  ),
  classified as (
    select
      lvf.customer_id,
      lvf.last_visit_date,
      lvf.service_names,
      lvf.professional_id,
      lvf.professional_name,
      coalesce(lvf.return_period_days_min, 20) as return_period_days,
      (p_today - lvf.last_visit_date) as days_since,
      (p_today - lvf.last_visit_date) - coalesce(lvf.return_period_days_min, 20) as days_overdue,
      (fa.customer_id is not null) as has_future_appointment
    from last_visit_filtered lvf
    left join future_appointment fa on fa.customer_id = lvf.customer_id
  ),
  without_return as (
    select
      c.*,
      case
        when c.days_overdue <= 15 then 'up_to_15'
        when c.days_overdue <= 30 then 'd16_30'
        when c.days_overdue <= 60 then 'd31_60'
        else 'over_60'
      end as overdue_band
    from classified c
    where c.days_overdue > 0
      and not c.has_future_appointment
  ),
  bands_row as (
    select
      count(*) filter (where overdue_band = 'up_to_15') as up_to_15,
      count(*) filter (where overdue_band = 'd16_30') as d16_30,
      count(*) filter (where overdue_band = 'd31_60') as d31_60,
      count(*) filter (where overdue_band = 'over_60') as over_60
    from without_return
  ),
  totals_row as (
    select
      (select count(*) from without_return) as without_return,
      (select count(*) from classified) - (select count(*) from without_return) as within_return,
      case
        when p_professional_id is not null then 0
        else (
          select count(*)
          from public.customers cu
          where cu.tenant_id = p_tenant_id
            and not exists (select 1 from last_visit lv where lv.customer_id = cu.id)
        )
      end as no_visit_ever
  ),
  list_filtered as (
    select *
    from without_return wr
    where p_overdue_band is null or wr.overdue_band = p_overdue_band
  ),
  list_count as (
    select count(*) as total_count from list_filtered
  ),
  list_page as (
    select *
    from list_filtered
    order by days_overdue desc, customer_id
    limit p_limit offset p_offset
  )
  select jsonb_build_object(
    'timezone', p_timezone,
    'business_today', p_today,
    'totals', jsonb_build_object(
      'without_return', tr.without_return,
      'within_return', tr.within_return,
      'no_visit_ever', tr.no_visit_ever
    ),
    'bands', jsonb_build_object(
      'up_to_15', br.up_to_15,
      'd16_30', br.d16_30,
      'd31_60', br.d31_60,
      'over_60', br.over_60
    ),
    'items', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'customer_id', lp.customer_id,
          'name', cu.name,
          'phone', cu.phone,
          'has_phone', (cu.phone is not null and btrim(cu.phone) <> ''),
          'last_visit_date', lp.last_visit_date,
          'last_service_name', (lp.service_names)[array_upper(lp.service_names, 1)],
          'last_professional_name', lp.professional_name,
          'return_period_days', lp.return_period_days,
          'days_since', lp.days_since,
          'days_overdue', lp.days_overdue
        )
        order by lp.days_overdue desc, lp.customer_id
      )
      from list_page lp
      join public.customers cu on cu.id = lp.customer_id),
      '[]'::jsonb
    ),
    'total_count', lc.total_count
  )
  into v_result
  from totals_row tr, bands_row br, list_count lc;

  return v_result;
end;
$function$;

comment on function private.get_customers_without_return_core(uuid, text, uuid, integer, integer, date, timestamptz, text) is
  'Nucleo de Clientes sem Retorno (spec 038, ticket 09): recebe "hoje" e "agora" injetados. Usa a ULTIMA Visita (private.report_customer_visits) de cada cliente; prazo = menor return_period_days entre os servicos da ultima Visita, ou 20 sem servico identificavel. Sem retorno = dias desde a ultima Visita > prazo e sem Agendamento pending/confirmed futuro. Faixas de atraso ate 15/16-30/31-60/mais de 60. p_professional_id filtra totais/faixas/lista pela ultima Visita; p_overdue_band filtra so a lista. Paginacao nao afeta totais/faixas/total_count (total_count respeita profissional e faixa, antes da paginacao). Sem checagem de acesso.';

revoke all on function private.get_customers_without_return_core(uuid, text, uuid, integer, integer, date, timestamptz, text) from public, anon, authenticated;
grant execute on function private.get_customers_without_return_core(uuid, text, uuid, integer, integer, date, timestamptz, text) to service_role;

-- Funcao publica: mesmo padrao de acesso das demais RPCs de relatorio
-- (gerente do proprio tenant, recusando tenant nulo; proprietario em
-- qualquer tenant). Resolve v_today (date) e v_now (timestamptz) a partir do
-- fuso do tenant e delega ao nucleo.
create or replace function public.get_customers_without_return(
  p_tenant_id uuid,
  p_overdue_band text default null,
  p_professional_id uuid default null,
  p_limit integer default 50,
  p_offset integer default 0
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
  v_now timestamptz;
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

  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'O limite deve estar entre 1 e 100.' using errcode = '22023';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception 'O deslocamento não pode ser negativo.' using errcode = '22023';
  end if;
  if p_overdue_band is not null and p_overdue_band not in ('up_to_15', 'd16_30', 'd31_60', 'over_60') then
    raise exception 'Faixa de atraso desconhecida. Use até 15, 16 a 30, 31 a 60 ou mais de 60 dias.' using errcode = '22023';
  end if;

  v_now := now();
  v_today := (v_now at time zone v_timezone)::date;

  return private.get_customers_without_return_core(
    v_target_tenant, p_overdue_band, p_professional_id, p_limit, p_offset, v_today, v_now, v_timezone
  );
end;
$function$;

comment on function public.get_customers_without_return(uuid, text, uuid, integer, integer) is
  'Clientes sem Retorno (spec 038, ticket 09): fotografia de hoje, sem periodo. Ultima Visita de cada cliente, prazo pelo menor Tempo de Retorno entre os servicos dessa Visita (20 dias sem servico identificavel), sem retorno quando dias desde a ultima Visita > prazo e sem Agendamento pending/confirmed futuro. Faixas de atraso, filtro por profissional (totais e lista) e por faixa (so lista), paginacao. Gerente do proprio tenant (tenant nulo recusado); proprietario acessa qualquer tenant.';

revoke all on function public.get_customers_without_return(uuid, text, uuid, integer, integer) from public, anon;
grant execute on function public.get_customers_without_return(uuid, text, uuid, integer, integer) to authenticated, service_role;

-- Notas do ticket: `explain (analyze, buffers)` no banco dev confirmando o
-- uso do indice novo idx_appointments_tenant_customer_start_time.
--
-- A consulta motivadora do indice (Agendamento futuro pending/confirmed de
-- UM cliente, o mesmo padrao usado pela Central 360 do cliente e pela busca
-- por cliente dentro do nucleo) usa o indice normalmente quando o
-- planejador nao acha mais vantajoso um indice parcial mais estreito para o
-- filtro de status pedido. Com apenas ~33 Agendamentos no dev, o
-- planejador as vezes prefere idx_appointments_agenda_daily (parcial,
-- tenant_id+start_time, sem canceled) por ser mais barato nesse volume
-- minusculo -- por isso o teste abaixo usa um filtro de start_time sem
-- filtro de status (que nao casa com o predicado parcial de nenhum indice
-- concorrente), isolando o uso do indice novo:
--
--   explain (analyze, buffers)
--   select a.id, a.start_time, a.status
--   from public.appointments a
--   where a.tenant_id = '<tenant>'::uuid
--     and a.customer_id = '<customer>'::uuid
--     and a.start_time > '2000-01-01'::timestamptz
--   order by a.start_time desc;
--
--   Index Scan Backward using idx_appointments_tenant_customer_start_time
--     on appointments a  (actual time=0.782..0.792 rows=19 loops=1)
--     Index Cond: ((tenant_id = '...'::uuid) AND (customer_id = '...'::uuid)
--       AND (start_time > '2000-01-01 00:00:00+00'::timestamptz))
--     Buffers: shared hit=11 read=1
--   Planning Time: 5.796 ms
--   Execution Time: 0.865 ms
--
-- Confirmado: Index Scan usando idx_appointments_tenant_customer_start_time,
-- com Index Cond casando os tres campos (tenant_id, customer_id,
-- start_time), bem abaixo do limite de 8s do papel authenticated.
