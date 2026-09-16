-- Ticket 08 da spec 038 (Modulo de Relatorios): Mapa de calor por dia e
-- horario, estendendo o mesmo contrato do ticket 07
-- (private.get_schedule_report_core / public.get_schedule_report), sem
-- assinatura nova. Acrescenta a chave `heatmap` ao jsonb ja devolvido.
--
-- Contagem: reaproveita target_appointments (ja filtrada por
-- p_professional_id e classificada), so exclui classification = 'canceled'
-- -- faltas, concluidos, sem-desfecho e futuros contam, porque eram demanda
-- real da agenda. Dia da semana e hora vem de `start_time at time zone
-- p_timezone` (nunca UTC cru), a mesma tecnica ja usada no nucleo para os
-- limites do periodo.
--
-- Convencao de weekday: extract(dow from ...) do Postgres, 0 = domingo a
-- 6 = sabado (mesma convencao ja usada nas RPCs de agenda publica, ex.
-- migracoes 067/069 -- "CASE extract(dow FROM p_date) WHEN 0 THEN
-- 'domingo' ... WHEN 6 THEN 'sabado'"). Exemplo: um Agendamento numa
-- segunda-feira as 14h local tem weekday = 1, hour = 14.
--
-- hours: intervalo [menor hora de abertura, maior hora de fechamento]
-- entre os dias com business_hours.<dia>.active = true (chaves em
-- portugues, {open, close, active}, mesmo formato ja lido pelo Fluxo de
-- Caixa Projetado -- dia ausente ou sem "active" conta como fechado e NAO
-- amplia a faixa). Esse intervalo e ampliado (nunca reduzido) para cobrir
-- qualquer hora que tenha, de fato, Agendamento nao cancelado no periodo,
-- mesmo fora do expediente configurado ou com a configuracao inteira
-- ausente/inativa.
--
-- cells: so as combinacoes (weekday, hour) com pelo menos 1 Agendamento nao
-- cancelado -- celula ausente e 0, o frontend preenche o resto cruzando
-- `hours` x os 7 dias (nenhuma grade completa e devolvida aqui, ja que toda
-- combinacao zerada seria redundante com o proprio `hours`).
--
-- Armadilha do produto cartesiano (mesma das 034/037/ticket07):
-- heatmap_counts agrega sozinha, direto de target_appointments, sem juntar
-- com nenhuma outra CTE multi-linha; a leitura do expediente
-- (active_business_hours) e outra CTE independente, tambem agregada antes
-- de qualquer combinacao (heatmap_range so cruza duas agregacoes de 1
-- linha cada, produto cartesiano 1x1, nunca multiplica contagem).
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
      a.start_time,
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
  ),
  -- Mapa de calor: agregado direto de target_appointments (ja com o filtro
  -- de p_professional_id aplicado), excluindo cancelados. Uma linha por
  -- (weekday, hour) com pelo menos 1 Agendamento -- nunca celula zerada.
  heatmap_counts as (
    select
      extract(dow from (ta.start_time at time zone p_timezone))::int as weekday,
      extract(hour from (ta.start_time at time zone p_timezone))::int as hour,
      count(*) as count
    from target_appointments ta
    where ta.classification <> 'canceled'
    group by 1, 2
  ),
  -- Expediente do tenant: uma linha por dia ATIVO com {open, close}, para
  -- achar a menor hora de abertura e a maior hora de fechamento entre eles.
  -- Dia ausente ou com active <> true nunca entra aqui (nao amplia a
  -- faixa).
  active_business_hours as (
    select
      (t.business_hours -> d.key ->> 'open')::time as open_time,
      (t.business_hours -> d.key ->> 'close')::time as close_time
    from public.tenants t
    cross join lateral unnest(array['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo']) as d(key)
    where t.id = p_tenant_id
      and coalesce((t.business_hours -> d.key ->> 'active')::boolean, false)
      and t.business_hours -> d.key ->> 'open' is not null
      and t.business_hours -> d.key ->> 'close' is not null
  ),
  business_hours_extent as (
    select
      min(extract(hour from open_time))::int as min_open_hour,
      max(extract(hour from close_time))::int as max_close_hour
    from active_business_hours
  ),
  heatmap_hour_extent as (
    select
      min(hour) as min_hour,
      max(hour) as max_hour
    from heatmap_counts
  ),
  -- Cruza as duas agregacoes de 1 linha (nunca multi-linha) para ampliar o
  -- expediente por Agendamento fora dele, sem produto cartesiano.
  heatmap_range as (
    select
      least(bhe.min_open_hour, hhe.min_hour) as range_start,
      greatest(bhe.max_close_hour, hhe.max_hour) as range_end
    from business_hours_extent bhe, heatmap_hour_extent hhe
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
    ),
    'heatmap', jsonb_build_object(
      'hours', coalesce(
        (select jsonb_agg(h order by h) from generate_series(hr.range_start, hr.range_end) as h),
        '[]'::jsonb
      ),
      'cells', coalesce(
        (select jsonb_agg(
          jsonb_build_object('weekday', hc.weekday, 'hour', hc.hour, 'count', hc.count)
          order by hc.weekday, hc.hour
        )
        from heatmap_counts hc),
        '[]'::jsonb
      )
    )
  )
  into v_result
  from status_totals_row st, previous_status_totals_row pst, heatmap_range hr;

  return v_result;
end;
$function$;

comment on function private.get_schedule_report_core(uuid, date, date, uuid, date, timestamptz, text) is
  'Nucleo do relatorio de Agenda: comparecimento, cancelamento, no-show e mapa de calor (spec 038, tickets 07 e 08). Recebe "hoje" (dia de negocio) e "agora" (instante) injetados. Classifica cada Agendamento com start_time no periodo em completed/no_show/canceled/unresolved (sem desfecho: pending/confirmed/in_progress com start_time < p_now)/future (mesmos status com start_time >= p_now); canceled nunca vira future/unresolved. Taxas com denominador zero devolvem null. p_professional_id filtra status_totals/by_origin/cancellation_reasons/heatmap, mas NAO filtra by_professional (inverso da regra do ticket 05/06). Motivos de cancelamento normalizados (trim+lower), vazio como "sem motivo informado", top 10 + "outros". heatmap: cells{weekday,hour,count} conta Agendamentos NAO cancelados (faltas contam) por dia da semana (extract(dow): 0=domingo..6=sabado) e hora de start_time no fuso do tenant, so combinacoes com pelo menos 1 Agendamento (ausente = 0); hours e o intervalo [menor abertura, maior fechamento] entre os dias ativos de tenants.business_hours, ampliado (nunca reduzido) por Agendamento fora do expediente ou com expediente ausente/inativo. Sem checagem de acesso.';

revoke all on function private.get_schedule_report_core(uuid, date, date, uuid, date, timestamptz, text) from public, anon, authenticated;
grant execute on function private.get_schedule_report_core(uuid, date, date, uuid, date, timestamptz, text) to service_role;

-- Funcao publica: corpo inalterado (so delega ao nucleo), recriada junto
-- para manter as duas em sincronia nesta migracao e atualizar o comentario
-- com o novo campo heatmap.
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
  'Agenda (spec 038, tickets 07 e 08): totais por status do periodo e do anterior (concluidos, faltas, cancelados, sem desfecho, futuros, taxa de comparecimento, taxa de cancelamento), por origem, por profissional (sempre completa, inclusive inativos/arquivados), motivos de cancelamento e mapa de calor por dia da semana e hora (heatmap.hours e heatmap.cells{weekday,hour,count}, weekday 0=domingo..6=sabado, so nao cancelados, fuso do tenant). Gerente do proprio tenant (tenant nulo recusado); proprietario acessa qualquer tenant. p_professional_id filtra tudo, exceto by_professional.';

revoke all on function public.get_schedule_report(uuid, date, date, uuid) from public, anon;
grant execute on function public.get_schedule_report(uuid, date, date, uuid) to authenticated, service_role;
