-- Correcao de revisao do ticket 07: o nucleo chamava now() diretamente so
-- para validar o fuso, descartando o valor -- viola o contrato "relogio
-- injetado, nunca lido" do proprio cabecalho da migracao anterior. Troca
-- para p_now (ja injetado), sem mudanca de comportamento observavel.
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

revoke all on function private.get_schedule_report_core(uuid, date, date, uuid, date, timestamptz, text) from public, anon, authenticated;
grant execute on function private.get_schedule_report_core(uuid, date, date, uuid, date, timestamptz, text) to service_role;
