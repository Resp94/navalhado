-- Ticket 05 da spec 038 (Modulo de Relatorios): Ranking de profissionais e
-- Ranking de servicos, novo contrato de leitura da pagina Equipe e Servicos.
-- Spec: specs/038-modulo-de-relatorios/spec.md, secao "4-5.
-- get_team_services_report" e historias 32 a 41 (37 e 38-41 completas na
-- 06/proxima fatia; esta fatia cobre 32-37, o ranking de profissionais e o
-- ranking de servicos ja no mesmo contrato, como o par de RPCs pede).
--
-- Reusa private.report_recognized_items (ticket 01) como UNICA fonte de
-- dado de item: nao requery comanda_itens/comandas para a agregacao
-- principal. A classificacao de qualidade do dado usa uma consulta propria
-- (mesmo padrao do ticket 01: report_recognized_items so emite linha para
-- Comanda com item, e a qualidade precisa cobrir toda Comanda fechada do
-- periodo).
--
-- Atendimento = Comanda distinta em que o profissional tem item de SERVICO
-- reconhecido. Venda so de produto nao e atendimento (services_quantity/
-- attendances ficam em 0, mas o profissional aparece com products_net e
-- comissao gerada pelo produto).
--
-- Armadilha do produto cartesiano (mesma da 037 e dos tickets 01/02/03):
-- servico e produto sao agregados cada um na PROPRIA CTE
-- (professional_service_agg / professional_product_agg), reduzidos a uma
-- linha por profissional, e so entao juntados 1:1 por professional_id em
-- professional_agg. Juntar as duas fontes (varias linhas por profissional
-- cada) num unico group by multiplicaria quantidade/net/comissao de quem
-- tem mais de um servico E mais de um produto no periodo.
--
-- Decisao de reconciliacao (totals.net vs soma de professionals[].net):
-- professional_id em comanda_itens e nullable no schema, mas a spec pede
-- explicitamente "soma do liquido por profissional igual ao liquido total"
-- (historia 36 / checklist do ticket 05). Para que essa igualdade valha por
-- CONSTRUCAO e nao por coincidencia dos dados atuais (hoje 0 itens sem
-- profissional no banco dev), totals.net/services_net desta funcao somam so
-- os itens de `recognized` com professional_id preenchido -- a mesma base
-- que alimenta a lista de profissionais. Um item de servico ou produto sem
-- profissional (hipotese ainda nao observada nos dados) ficaria fora dos
-- totais e fora da lista de profissionais, nunca inflando um sem aparecer
-- no outro. Se essa hipotese um dia se concretizar, o relatorio precisa de
-- uma decisao de produto propria (ex.: uma linha "sem profissional" na
-- lista); nao inventamos isso aqui. O teste de reconciliacao do pgTAP
-- (34_relatorio_equipe_e_servicos) trava essa decisao -- so para net.
--
-- ATENCAO: totals.attendances NAO reconcilia com a soma de
-- professionals[].attendances, e isso e esperado, nao um defeito da mesma
-- classe do paragrafo acima. totals.attendances conta comandas distintas
-- com item de servico no tenant inteiro (uma unica contagem global);
-- professionals[].attendances conta, para CADA profissional, as comandas
-- distintas em que ELE tem item de servico. Uma Comanda dividida entre dois
-- profissionais conta 1 vez em totals.attendances e 1 vez em cada um dos
-- dois profissionais -- soma(professionals[].attendances) pode ultrapassar
-- totals.attendances sempre que houver Comanda dividida no periodo. O
-- teste pgTAP (34_relatorio_equipe_e_servicos) documenta essa divergencia
-- com valores explicitos, nunca afirma igualdade para attendances.
--
-- p_professional_id (opcional) filtra SO a lista de servicos (services[]),
-- nunca a lista de profissionais -- historia 40 / secao "4-5." da spec.
--
-- Indice: nenhum novo. report_recognized_items ja usa
-- idx_comandas_tenant_closed_at_fechada (ticket 01) para o recorte de
-- periodo, e a agregacao por professional_id/service_id acontece sobre o
-- resultado ja materializado da funcao (linhas ja filtradas por tenant e
-- data), nao contra comanda_itens de novo -- os indices existentes
-- (idx_comanda_itens_comanda_id, idx_comanda_itens_professional_id,
-- idx_comanda_itens_service_id) ja bastam e sao conferidos no explain deste
-- ticket.
create or replace function private.get_team_services_report_core(
  p_tenant_id uuid,
  p_start_date date,
  p_end_date date,
  p_professional_id uuid,
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

  with recognized as (
    select * from private.report_recognized_items(p_tenant_id, p_start_date, p_end_date, p_timezone)
  ),
  -- Servicos do profissional, reduzidos a uma linha por professional_id
  -- ANTES de juntar com produtos.
  professional_service_agg as (
    select
      professional_id,
      sum(gross) as gross,
      sum(net) as net,
      sum(commission) as commission,
      sum(quantity) as services_quantity,
      count(distinct comanda_id) as attendances
    from recognized
    where professional_id is not null
      and (item_type in ('servico', 'service') or service_id is not null)
    group by professional_id
  ),
  -- Produtos do profissional, na propria CTE, reduzidos a uma linha por
  -- professional_id.
  professional_product_agg as (
    select
      professional_id,
      sum(gross) as gross,
      sum(net) as net,
      sum(commission) as commission
    from recognized
    where professional_id is not null
      and (item_type in ('produto', 'product') or product_id is not null)
    group by professional_id
  ),
  -- Todos os profissionais com QUALQUER item reconhecido no periodo
  -- (servico ou produto), para incluir quem so vendeu produto.
  professional_ids as (
    select distinct professional_id
    from recognized
    where professional_id is not null
  ),
  -- Junta as duas fontes ja reduzidas 1:1 por professional_id -- sem
  -- fan-out possivel, cada CTE de origem ja tem no maximo uma linha por
  -- profissional.
  professional_agg as (
    select
      pid.professional_id,
      coalesce(psa.gross, 0.00) + coalesce(ppa.gross, 0.00) as gross,
      coalesce(psa.net, 0.00) + coalesce(ppa.net, 0.00) as net,
      coalesce(psa.commission, 0.00) + coalesce(ppa.commission, 0.00) as commission,
      coalesce(psa.services_quantity, 0) as services_quantity,
      coalesce(ppa.net, 0.00) as products_net,
      coalesce(psa.attendances, 0) as attendances
    from professional_ids pid
    left join professional_service_agg psa on psa.professional_id = pid.professional_id
    left join professional_product_agg ppa on ppa.professional_id = pid.professional_id
  ),
  -- Servicos executados no periodo, opcionalmente filtrados por
  -- profissional (p_professional_id filtra SO esta lista).
  service_agg as (
    select
      service_id,
      sum(net) as net,
      sum(quantity) as quantity
    from recognized
    where service_id is not null
      and (item_type in ('servico', 'service'))
      and (p_professional_id is null or professional_id = p_professional_id)
    group by service_id
  ),
  -- Totais do relatorio: mesma base de professional_agg (professional_id
  -- preenchido), para que net/services_net batam com a soma por profissional
  -- por construcao. attendances aqui e uma contagem global (distinct
  -- comanda_id no tenant inteiro), NAO a soma das contagens por profissional
  -- -- nao reconcilia com soma(professionals[].attendances) quando ha
  -- Comanda dividida (ver nota da migracao sobre reconciliacao).
  totals_row as (
    select
      coalesce(sum(net), 0.00) as net,
      coalesce(sum(net) filter (where professional_id is not null and (item_type in ('servico', 'service') or service_id is not null)), 0.00) as services_net,
      coalesce(count(distinct comanda_id) filter (where professional_id is not null and (item_type in ('servico', 'service') or service_id is not null)), 0) as attendances
    from recognized
    where professional_id is not null
  ),
  -- Qualidade do dado do periodo inteiro, calculada direto (mesmo padrao do
  -- ticket 01), cobrindo toda Comanda fechada do periodo, nao so as com item
  -- reconhecido.
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
  )
  select jsonb_build_object(
    'timezone', p_timezone,
    'business_today', p_today,
    'period', jsonb_build_object('start', p_start_date, 'end', p_end_date),
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
    'professionals', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'professional_id', p.professional_id,
          'name', prof.name,
          'is_active', prof.is_active,
          'archived', prof.deleted_at is not null,
          'net', round(p.net, 2),
          'gross', round(p.gross, 2),
          'share', case when tr.net > 0 then round(p.net / tr.net, 4) else null end,
          'attendances', p.attendances,
          'services_quantity', p.services_quantity,
          'products_net', round(p.products_net, 2),
          'average_ticket', case when p.attendances > 0 then round(p.net / p.attendances, 2) else null end,
          'commission', round(p.commission, 2)
        )
        order by p.net desc
      )
      from professional_agg p
      join public.professionals prof
        on prof.id = p.professional_id
       and prof.tenant_id = p_tenant_id
      cross join totals_row tr),
      '[]'::jsonb
    ),
    'services', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'service_id', s.service_id,
          'name', svc.name,
          'category', svc.category,
          'archived', svc.deleted_at is not null,
          'quantity', s.quantity,
          'net', round(s.net, 2),
          'share', case when tr.services_net > 0 then round(s.net / tr.services_net, 4) else null end,
          'average_unit_net', case when s.quantity > 0 then round(s.net / s.quantity, 2) else null end
        )
        order by s.net desc
      )
      from service_agg s
      join public.services svc
        on svc.id = s.service_id
       and svc.tenant_id = p_tenant_id
      cross join totals_row tr),
      '[]'::jsonb
    ),
    'totals', jsonb_build_object(
      'net', round(tr.net, 2),
      'services_net', round(tr.services_net, 2),
      'attendances', tr.attendances
    )
  )
  into v_result
  from totals_row tr, quality_counts qc;

  return v_result;
end;
$function$;

comment on function private.get_team_services_report_core(uuid, date, date, uuid, date, text) is
  'Nucleo do relatorio de Equipe e Servicos (spec 038, ticket 05): recebe "hoje" injetado, valida periodo (sem granularidade), agrega Receita Reconhecida de Item por profissional (servico e produto em CTEs separadas antes de juntar) e por servico. Atendimento = Comanda distinta com item de servico do profissional; venda so de produto nao conta. totals.net/services_net somam so itens com profissional preenchido (reconciliam por construcao com a soma da lista de profissionais); totals.attendances e uma contagem global e NAO reconcilia com a soma de professionals[].attendances quando ha Comanda dividida. p_professional_id filtra so a lista de servicos. Sem checagem de acesso.';

revoke all on function private.get_team_services_report_core(uuid, date, date, uuid, date, text) from public, anon, authenticated;
grant execute on function private.get_team_services_report_core(uuid, date, date, uuid, date, text) to service_role;

-- Funcao publica: mesmo padrao de acesso de get_revenue_report (gerente do
-- proprio tenant, recusando tenant nulo; proprietario em qualquer tenant).
create or replace function public.get_team_services_report(
  p_tenant_id uuid,
  p_start_date date,
  p_end_date date,
  p_professional_id uuid default null
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

  return private.get_team_services_report_core(
    v_target_tenant, p_start_date, p_end_date, p_professional_id, v_today, v_timezone
  );
end;
$function$;

comment on function public.get_team_services_report(uuid, date, date, uuid) is
  'Equipe e Servicos (spec 038, ticket 05): ranking de profissionais (liquido, bruto, participacao, atendimentos, quantidade de servicos, liquido de produtos, ticket medio, comissao gerada) e ranking de servicos (quantidade, liquido, participacao, valor medio) do periodo, incluindo inativos/arquivados. Gerente do proprio tenant (tenant nulo recusado); proprietario acessa qualquer tenant. p_professional_id filtra so a lista de servicos.';

revoke all on function public.get_team_services_report(uuid, date, date, uuid) from public, anon;
grant execute on function public.get_team_services_report(uuid, date, date, uuid) to authenticated, service_role;
