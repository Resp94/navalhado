-- Ticket 07: extrato da sessão de caixa em uma única chamada, e higiene de
-- search_path na função de resumo financeiro diário.

create or replace function public.get_daily_financial_summary(
  p_start_date date,
  p_end_date date,
  p_time_zone text,
  p_tenant_id uuid default null,
  p_cash_session_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_user_tenant_id uuid;
  v_user_role text;
  v_target_tenant_id uuid;
  v_tenant_time_zone text;
  v_result json;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Usuário não autenticado.' using errcode = '42501';
  end if;

  select tenant_id, role
    into v_user_tenant_id, v_user_role
  from public.users
  where id = v_user_id
    and is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado. Apenas gerentes e proprietários podem acessar o resumo financeiro.' using errcode = '42501';
  end if;

  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
    raise exception 'O período financeiro diário é inválido.' using errcode = '22023';
  end if;

  if p_tenant_id is not null then
    if v_user_role <> 'proprietario' and v_user_tenant_id <> p_tenant_id then
      raise exception 'Acesso negado para a unidade solicitada.' using errcode = '42501';
    end if;
    v_target_tenant_id := p_tenant_id;
  else
    v_target_tenant_id := v_user_tenant_id;
  end if;

  select timezone
    into v_tenant_time_zone
  from public.tenants
  where id = v_target_tenant_id;

  if v_tenant_time_zone is null or btrim(v_tenant_time_zone) = '' then
    raise exception 'O fuso horário da barbearia é obrigatório.' using errcode = '22023';
  end if;

  if p_time_zone is null or btrim(p_time_zone) = '' or p_time_zone <> v_tenant_time_zone then
    raise exception 'O fuso horário informado não corresponde ao configurado na barbearia.' using errcode = '22023';
  end if;

  perform now() at time zone v_tenant_time_zone;

  with days as (
    select generate_series(p_start_date, p_end_date, interval '1 day')::date as local_date
  ),
  closed_comandas as (
    select
      (c.closed_at at time zone v_tenant_time_zone)::date as local_date,
      coalesce(sum(c.total_amount), 0.00) as realized_revenue,
      count(*)::integer as closed_comandas_count
    from public.comandas c
    where c.tenant_id = v_target_tenant_id
      and c.status in ('fechada', 'closed')
      and c.closed_at >= (p_start_date::timestamp at time zone v_tenant_time_zone)
      and c.closed_at < ((p_end_date + 1)::timestamp at time zone v_tenant_time_zone)
    group by (c.closed_at at time zone v_tenant_time_zone)::date
  ),
  payments as (
    select
      (cp.paid_at at time zone v_tenant_time_zone)::date as local_date,
      coalesce(sum(cp.amount), 0.00) as received_total,
      coalesce(sum(cp.amount) filter (where cp.payment_method = 'cash'), 0.00) as dinheiro,
      coalesce(sum(cp.amount) filter (where cp.payment_method = 'pix'), 0.00) as pix,
      coalesce(sum(cp.amount) filter (where cp.payment_method in ('credit_card', 'debit_card')), 0.00) as cartao,
      coalesce(sum(cp.amount) filter (where cp.payment_method = 'other'), 0.00) as outros,
      count(*)::integer as payment_count
    from public.comanda_pagamentos cp
    join public.comandas c
      on c.id = cp.comanda_id
     and c.tenant_id = cp.tenant_id
    where cp.tenant_id = v_target_tenant_id
      and c.status in ('fechada', 'closed')
      and cp.paid_at >= (p_start_date::timestamp at time zone v_tenant_time_zone)
      and cp.paid_at < ((p_end_date + 1)::timestamp at time zone v_tenant_time_zone)
      and (p_cash_session_id is null or cp.cash_session_id = p_cash_session_id)
    group by (cp.paid_at at time zone v_tenant_time_zone)::date
  )
  select coalesce(
    json_agg(
      json_build_object(
        'date', d.local_date,
        'realized_revenue', coalesce(cc.realized_revenue, 0.00),
        'received_total', coalesce(p.received_total, 0.00),
        'by_method', json_build_object(
          'dinheiro', coalesce(p.dinheiro, 0.00),
          'pix', coalesce(p.pix, 0.00),
          'cartao', coalesce(p.cartao, 0.00),
          'outros', coalesce(p.outros, 0.00)
        ),
        'closed_comandas_count', coalesce(cc.closed_comandas_count, 0),
        'payment_count', coalesce(p.payment_count, 0)
      )
      order by d.local_date
    ),
    '[]'::json
  )
  into v_result
  from days d
  left join closed_comandas cc on cc.local_date = d.local_date
  left join payments p on p.local_date = d.local_date;

  return v_result;
end;
$function$;

-- Extrato completo de uma sessão de caixa: fotografia do fechamento
-- corrente, ajustes posteriores, divergência ajustada acumulada,
-- movimentações do turno e histórico de reaberturas — em uma única chamada.
create or replace function public.get_cash_session_statement(
  p_session_id uuid,
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_session public.cash_sessions%rowtype;
  v_adjustments jsonb;
  v_adjusted_difference numeric;
  v_movements jsonb;
  v_reopenings jsonb;
  v_result jsonb;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Usuário não autenticado.' using errcode = '42501';
  end if;

  select role, tenant_id
    into v_user_role, v_user_tenant
  from public.users
  where id = v_user_id
    and is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado. Apenas gerentes e proprietários podem consultar o extrato do caixa.' using errcode = '42501';
  end if;

  if p_session_id is null or p_tenant_id is null then
    raise exception 'Sessão e unidade são obrigatórias.' using errcode = '22023';
  end if;

  if v_user_role <> 'proprietario' and v_user_tenant <> p_tenant_id then
    raise exception 'Acesso negado para a unidade solicitada.' using errcode = '42501';
  end if;

  select * into v_session
  from public.cash_sessions
  where id = p_session_id and tenant_id = p_tenant_id;

  if not found then
    raise exception 'A sessão de caixa não existe.' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'created_by', a.created_by,
      'reason', a.reason,
      'adjustment_amount', a.adjustment_amount,
      'original_expected_amount', a.original_expected_amount,
      'original_closing_amount', a.original_closing_amount,
      'original_difference_amount', a.original_difference_amount,
      'adjusted_expected_amount', a.adjusted_expected_amount,
      'adjusted_closing_amount', a.adjusted_closing_amount,
      'adjusted_difference_amount', a.adjusted_difference_amount,
      'created_at', a.created_at
    )
    order by a.created_at
  ), '[]'::jsonb),
  coalesce(sum(a.adjustment_amount), 0)
  into v_adjustments, v_adjusted_difference
  from public.cash_session_adjustments a
  where a.cash_session_id = p_session_id and a.tenant_id = p_tenant_id;

  v_adjusted_difference := coalesce(v_session.difference_amount, 0) + v_adjusted_difference;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'type', m.type,
      'amount', m.amount,
      'reason', m.reason,
      'performed_by', m.performed_by,
      'payout_id', m.payout_id,
      'created_at', m.created_at,
      'reversed_at', m.reversed_at,
      'reversed_by', m.reversed_by,
      'reversal_reason', m.reversal_reason
    )
    order by m.created_at
  ), '[]'::jsonb)
  into v_movements
  from public.cash_movements m
  where m.cash_session_id = p_session_id and m.tenant_id = p_tenant_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'reopened_by', r.reopened_by,
      'reopened_at', r.reopened_at,
      'reason', r.reason,
      'original_closing_amount', r.original_closing_amount,
      'original_expected_amount', r.original_expected_amount,
      'original_difference_amount', r.original_difference_amount,
      'original_closed_by', r.original_closed_by,
      'original_closed_at', r.original_closed_at
    )
    order by r.reopened_at
  ), '[]'::jsonb)
  into v_reopenings
  from public.cash_session_reopenings r
  where r.cash_session_id = p_session_id and r.tenant_id = p_tenant_id;

  v_result := jsonb_build_object(
    'session', to_jsonb(v_session),
    'adjustments', v_adjustments,
    'adjusted_difference_amount', v_adjusted_difference,
    'movements', v_movements,
    'reopenings', v_reopenings
  );

  return v_result;
end;
$function$;

revoke all on function public.get_cash_session_statement(uuid, uuid) from public;
revoke all on function public.get_cash_session_statement(uuid, uuid) from anon;
grant execute on function public.get_cash_session_statement(uuid, uuid) to authenticated;
grant execute on function public.get_cash_session_statement(uuid, uuid) to service_role;
