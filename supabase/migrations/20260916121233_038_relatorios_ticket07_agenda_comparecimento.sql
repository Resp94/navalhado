-- Ticket 07 da spec 038 (Modulo de Relatorios): Comparecimento, cancelamento
-- e no-show, novo contrato de leitura da pagina Agenda.
-- Spec: specs/038-modulo-de-relatorios/spec.md, secao "6-7.
-- get_schedule_report" e historias 42 a 49. Esta fatia cobre status_totals
-- (periodo e anterior), by_origin, by_professional e cancellation_reasons.
-- O mapa de calor (heatmap) e do ticket 08 (CREATE OR REPLACE futuro), NAO
-- entra no jsonb_build_object desta migracao.
--
-- Relogio duplo injetavel: p_today (dia de negocio, para os limites do
-- periodo, igual aos outros nucleos) E p_now (timestamptz, para classificar
-- sem-desfecho/futuro pelo instante, nao so pelo dia) -- ambos passados pela
-- funcao publica, nunca decididos pelo nucleo, para pgTAP deterministico.
--
-- Base: Agendamentos com start_time no periodo (janela meio-aberta no fuso
-- do tenant, sem envolver a coluna indexada em funcao). Classificacao (uma
-- CTE base, target_appointments, com a classificacao ja calculada como
-- coluna, evitando repetir o CASE em cada agregacao):
--   completed: status = 'completed'
--   no_show:   status = 'no_show'
--   canceled:  status = 'canceled' (nunca futuro/sem-desfecho, seja qual for o start_time)
--   unresolved (Agendamento sem Desfecho): status in (pending,confirmed,in_progress) and start_time < p_now
--   future:    status in (pending,confirmed,in_progress) and start_time >= p_now
--
-- Taxas: attendance_rate = completed / (completed + no_show); cancellation_rate
-- = canceled / (total - future); denominador zero devolve null (nunca zero).
--
-- Armadilha do produto cartesiano (mesma das 037/034): status_totals,
-- by_origin, by_professional e cancellation_reasons sao agregados cada um na
-- PROPRIA CTE a partir da mesma target_appointments, nunca joins entre CTEs
-- multi-linha independentes.
--
-- p_professional_id filtra status_totals/by_origin/cancellation_reasons, mas
-- NAO filtra by_professional -- o INVERSO da regra do ticket 05/06 (la,
-- p_professional_id filtrava so a lista de servicos, nunca a de
-- profissionais; aqui, by_professional e sempre completa, e o filtro atinge
-- tudo em volta dela). Isso esta explicito na spec ("Profissional informado
-- filtra os totais, a origem e os motivos, mas nao a lista por
-- profissional").
--
-- Indice: cria idx_appointments_tenant_start_time (tenant_id, start_time)
-- SEM filtro de status. O indice existente com esse par,
-- idx_appointments_agenda_daily, tem WHERE status <> 'canceled' e por isso
-- nao serve para este relatorio, que precisa contar cancelados.
create index if not exists idx_appointments_tenant_start_time
  on public.appointments (tenant_id, start_time);

create or replace function private.get_schedule_report_core(
  p_tenant_id uuid,
  p_start_date date,
  p_end_date date,
  p_professional_id uuid,
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
  if p_now is null then
    raise exception 'O instante atual é obrigatório para calcular o relatório.' using errcode = '22023';
  end if;
  if p_timezone is null or btrim(p_timezone) = '' then
    raise exception 'O fuso horário da unidade é obrigatório.' using errcode = '22023';
  end if;
  -- Forca a validacao do fuso antes de qualquer agregacao. Usa p_now, nunca
  -- now(), para manter o nucleo determinista (relogio injetado, nao lido).
  perform p_now at time zone p_timezone;

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

  v_prev_end := p_start_date - 1;
  v_prev_start := v_prev_end - (v_extent - 1);

  with target_appointments as (
    select
      a.id,
      a.origin,
      a.professional_id,
      a.cancellation_reason,
      case
        when a.status = 'completed' then 'completed'
        when a.status = 'no_show' then 'no_show'
        when a.status = 'canceled' then 'canceled'
        when a.status in ('pending', 'confirmed', 'in_progress') and a.start_time < p_now then 'unresolved'
        else 'future'
      end as classification
    from public.appointments a
    where a.tenant_id = p_tenant_id
      and a.start_time >= (p_start_date::timestamp at time zone p_timezone)
      and a.start_time < ((p_end_date + 1)::timestamp at time zone p_timezone)
      and (p_professional_id is null or a.professional_id = p_professional_id)
  ),
  previous_appointments as (
    select
      case
        when a.status = 'completed' then 'completed'
        when a.status = 'no_show' then 'no_show'
        when a.status = 'canceled' then 'canceled'
        when a.status in ('pending', 'confirmed', 'in_progress') and a.start_time < p_now then 'unresolved'
        else 'future'
      end as classification
    from public.appointments a
    where a.tenant_id = p_tenant_id
      and a.start_time >= (v_prev_start::timestamp at time zone p_timezone)
      and a.start_time < ((v_prev_end + 1)::timestamp at time zone p_timezone)
      and (p_professional_id is null or a.professional_id = p_professional_id)
  ),
  status_totals_row as (
    select
      count(*) as total,
      count(*) filter (where classification = 'completed') as completed,
      count(*) filter (where classification = 'no_show') as no_show,
      count(*) filter (where classification = 'canceled') as canceled,
      count(*) filter (where classification = 'unresolved') as unresolved,
      count(*) filter (where classification = 'future') as future
    from target_appointments
  ),
  previous_status_totals_row as (
    select
      count(*) as total,
      count(*) filter (where classification = 'completed') as completed,
      count(*) filter (where classification = 'no_show') as no_show,
      count(*) filter (where classification = 'canceled') as canceled,
      count(*) filter (where classification = 'unresolved') as unresolved,
      count(*) filter (where classification = 'future') as future
    from previous_appointments
  ),
  -- by_origin agregado na propria CTE (uma linha por origem).
  origin_agg as (
    select
      origin,
      count(*) as total,
      count(*) filter (where classification = 'completed') as completed,
      count(*) filter (where classification = 'no_show') as no_show,
      count(*) filter (where classification = 'canceled') as canceled,
      count(*) filter (where classification = 'unresolved') as unresolved,
      count(*) filter (where classification = 'future') as future
    from target_appointments
    group by origin
  ),
  -- by_professional agregado na propria CTE (uma linha por profissional),
  -- SEM aplicar p_professional_id -- por isso consulta a base do tenant
  -- inteiro no periodo, independente do filtro usado nas demais CTEs.
  professional_target as (
    select
      a.professional_id,
      case
        when a.status = 'completed' then 'completed'
        when a.status = 'no_show' then 'no_show'
        when a.status = 'canceled' then 'canceled'
        when a.status in ('pending', 'confirmed', 'in_progress') and a.start_time < p_now then 'unresolved'
        else 'future'
      end as classification
    from public.appointments a
    where a.tenant_id = p_tenant_id
      and a.start_time >= (p_start_date::timestamp at time zone p_timezone)
      and a.start_time < ((p_end_date + 1)::timestamp at time zone p_timezone)
      and a.professional_id is not null
  ),
  professional_agg as (
    select
      professional_id,
      count(*) as total,
      count(*) filter (where classification = 'completed') as completed,
      count(*) filter (where classification = 'no_show') as no_show,
      count(*) filter (where classification = 'canceled') as canceled,
      count(*) filter (where classification = 'unresolved') as unresolved
    from professional_target
    group by professional_id
  ),
  -- Motivos de cancelamento, normalizados (trim + lower para agrupar), vazio
  -- vira 'sem motivo informado'. Exibicao usa o mesmo texto normalizado (nao
  -- ha grafia "mais frequente" pedida aqui, diferente do canal de aquisicao
  -- do relatorio 9-10).
  cancellation_reason_agg as (
    select
      coalesce(nullif(btrim(lower(cancellation_reason)), ''), 'sem motivo informado') as reason,
      count(*) as count
    from target_appointments
    where classification = 'canceled'
    group by 1
  ),
  cancellation_reasons_ranked as (
    select
      reason,
      count,
      row_number() over (order by count desc, reason asc) as rn
    from cancellation_reason_agg
  ),
  cancellation_reasons_top as (
    select reason, count
    from cancellation_reasons_ranked
    where rn <= 10
  ),
  cancellation_reasons_rest as (
    select coalesce(sum(count), 0) as count
    from cancellation_reasons_ranked
    where rn > 10
  ),
  cancellation_reasons_final as (
    select reason, count, 1 as sort_rank
    from cancellation_reasons_top
    union all
    select 'outros', count, 2 as sort_rank
    from cancellation_reasons_rest
    where count > 0
  )
  select jsonb_build_object(
    'timezone', p_timezone,
    'business_today', p_today,
    'period', jsonb_build_object('start', p_start_date, 'end', p_end_date),
    'previous_period', jsonb_build_object('start', v_prev_start, 'end', v_prev_end),
    'status_totals', jsonb_build_object(
      'total', st.total,
      'completed', st.completed,
      'no_show', st.no_show,
      'canceled', st.canceled,
      'unresolved', st.unresolved,
      'future', st.future,
      'attendance_rate', case when (st.completed + st.no_show) > 0 then round(st.completed::numeric / (st.completed + st.no_show), 4) else null end,
      'cancellation_rate', case when (st.total - st.future) > 0 then round(st.canceled::numeric / (st.total - st.future), 4) else null end
    ),
    'previous_status_totals', jsonb_build_object(
      'total', pst.total,
      'completed', pst.completed,
      'no_show', pst.no_show,
      'canceled', pst.canceled,
      'unresolved', pst.unresolved,
      'future', pst.future,
      'attendance_rate', case when (pst.completed + pst.no_show) > 0 then round(pst.completed::numeric / (pst.completed + pst.no_show), 4) else null end,
      'cancellation_rate', case when (pst.total - pst.future) > 0 then round(pst.canceled::numeric / (pst.total - pst.future), 4) else null end
    ),
    'by_origin', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'origin', o.origin,
          'total', o.total,
          'completed', o.completed,
          'no_show', o.no_show,
          'canceled', o.canceled,
          'unresolved', o.unresolved,
          'attendance_rate', case when (o.completed + o.no_show) > 0 then round(o.completed::numeric / (o.completed + o.no_show), 4) else null end
        )
        order by o.origin
      )
      from origin_agg o),
      '[]'::jsonb
    ),
    'by_professional', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'professional_id', pa.professional_id,
          'name', prof.name,
          'is_active', prof.is_active,
          'archived', prof.deleted_at is not null,
          'total', pa.total,
          'completed', pa.completed,
          'no_show', pa.no_show,
          'canceled', pa.canceled,
          'unresolved', pa.unresolved,
          'attendance_rate', case when (pa.completed + pa.no_show) > 0 then round(pa.completed::numeric / (pa.completed + pa.no_show), 4) else null end
        )
        order by pa.total desc
      )
      from professional_agg pa
      join public.professionals prof
        on prof.id = pa.professional_id
       and prof.tenant_id = p_tenant_id),
      '[]'::jsonb
    ),
    'cancellation_reasons', coalesce(
      (select jsonb_agg(
        jsonb_build_object('reason', crf.reason, 'count', crf.count)
        order by crf.sort_rank, crf.count desc, crf.reason
      )
      from cancellation_reasons_final crf),
      '[]'::jsonb
    )
  )
  into v_result
  from status_totals_row st, previous_status_totals_row pst;

  return v_result;
end;
$function$;

comment on function private.get_schedule_report_core(uuid, date, date, uuid, date, timestamptz, text) is
  'Nucleo do relatorio de Agenda: comparecimento, cancelamento e no-show (spec 038, ticket 07). Recebe "hoje" (dia de negocio) e "agora" (instante) injetados. Classifica cada Agendamento com start_time no periodo em completed/no_show/canceled/unresolved (sem desfecho: pending/confirmed/in_progress com start_time < p_now)/future (mesmos status com start_time >= p_now); canceled nunca vira future/unresolved. Taxas com denominador zero devolvem null. p_professional_id filtra status_totals/by_origin/cancellation_reasons, mas NAO filtra by_professional (inverso da regra do ticket 05/06). Motivos de cancelamento normalizados (trim+lower), vazio como "sem motivo informado", top 10 + "outros". Sem checagem de acesso. Heatmap fica para o ticket 08 (CREATE OR REPLACE futuro).';

revoke all on function private.get_schedule_report_core(uuid, date, date, uuid, date, timestamptz, text) from public, anon, authenticated;
grant execute on function private.get_schedule_report_core(uuid, date, date, uuid, date, timestamptz, text) to service_role;

-- Funcao publica: mesmo padrao de acesso das demais RPCs de relatorio
-- (gerente do proprio tenant, recusando tenant nulo; proprietario em
-- qualquer tenant). Resolve v_today (date) e v_now (timestamptz) a partir do
-- fuso do tenant e delega ao nucleo.
create or replace function public.get_schedule_report(
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

  v_now := now();
  v_today := (v_now at time zone v_timezone)::date;

  return private.get_schedule_report_core(
    v_target_tenant, p_start_date, p_end_date, p_professional_id, v_today, v_now, v_timezone
  );
end;
$function$;

comment on function public.get_schedule_report(uuid, date, date, uuid) is
  'Agenda (spec 038, ticket 07): totais por status do periodo e do anterior (concluidos, faltas, cancelados, sem desfecho, futuros, taxa de comparecimento, taxa de cancelamento), por origem, por profissional (sempre completa, inclusive inativos/arquivados) e motivos de cancelamento. Gerente do proprio tenant (tenant nulo recusado); proprietario acessa qualquer tenant. p_professional_id filtra tudo, exceto by_professional.';

revoke all on function public.get_schedule_report(uuid, date, date, uuid) from public, anon;
grant execute on function public.get_schedule_report(uuid, date, date, uuid) to authenticated, service_role;
