-- Ticket 07: calcula e persiste a conferência do caixa no mesmo fechamento.
alter table public.cash_sessions
  add column if not exists expected_amount numeric(10,2)
    check (expected_amount is null or expected_amount >= 0),
  add column if not exists difference_amount numeric(10,2);

create or replace function public.close_cash_session(
  p_session_id uuid,
  p_tenant_id uuid,
  p_closing_amount numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_session public.cash_sessions%rowtype;
  v_cash_received numeric := 0;
  v_pix_received numeric := 0;
  v_card_received numeric := 0;
  v_other_received numeric := 0;
  v_payment_count integer := 0;
  v_supplies numeric := 0;
  v_withdrawals numeric := 0;
  v_expected numeric := 0;
  v_difference numeric := 0;
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
    raise exception 'Acesso negado. Apenas gerentes e proprietários podem fechar o caixa.' using errcode = '42501';
  end if;

  if p_session_id is null or p_tenant_id is null then
    raise exception 'Sessão e unidade são obrigatórias.' using errcode = '22023';
  end if;

  if p_closing_amount is null or p_closing_amount < 0 then
    raise exception 'O valor de fechamento não pode ser negativo.' using errcode = '22023';
  end if;

  if v_user_role <> 'proprietario' and v_user_tenant <> p_tenant_id then
    raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
  end if;

  select *
    into v_session
  from public.cash_sessions
  where id = p_session_id
    and tenant_id = p_tenant_id
  for update;

  if not found or v_session.status <> 'open' then
    raise exception 'A sessão de caixa não está aberta ou não existe.' using errcode = 'P0001';
  end if;

  select
    coalesce(sum(cp.amount) filter (where cp.payment_method = 'cash'), 0),
    coalesce(sum(cp.amount) filter (where cp.payment_method = 'pix'), 0),
    coalesce(sum(cp.amount) filter (where cp.payment_method in ('credit_card', 'debit_card')), 0),
    coalesce(sum(cp.amount) filter (where cp.payment_method = 'other'), 0),
    count(*)
    into v_cash_received, v_pix_received, v_card_received, v_other_received, v_payment_count
  from public.comanda_pagamentos cp
  where cp.cash_session_id = p_session_id
    and cp.tenant_id = p_tenant_id;

  select
    coalesce(sum(cm.amount) filter (where cm.type = 'suprimento'), 0),
    coalesce(sum(cm.amount) filter (where cm.type = 'sangria'), 0)
    into v_supplies, v_withdrawals
  from public.cash_movements cm
  where cm.cash_session_id = p_session_id
    and cm.tenant_id = p_tenant_id;

  v_expected := round(v_session.initial_amount + v_cash_received + v_supplies - v_withdrawals, 2);
  v_difference := round(p_closing_amount - v_expected, 2);

  update public.cash_sessions
  set closed_by = v_user_id,
      closing_amount = round(p_closing_amount, 2),
      expected_amount = v_expected,
      difference_amount = v_difference,
      status = 'closed',
      closed_at = timezone('utc'::text, now()),
      notes = p_notes
  where id = p_session_id
    and tenant_id = p_tenant_id
  returning * into v_session;

  select to_jsonb(v_session) || jsonb_build_object(
    'cash_received', v_cash_received,
    'pix_received', v_pix_received,
    'card_received', v_card_received,
    'other_received', v_other_received,
    'payment_count', v_payment_count,
    'supplies', v_supplies,
    'withdrawals', v_withdrawals
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.close_cash_session(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.close_cash_session(uuid, uuid, numeric, text) to authenticated;
