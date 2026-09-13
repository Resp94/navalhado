-- Ticket 05 da spec 036: sentido e vinculos do movimento no extrato da Sessao
-- de Caixa.
--
-- Spec: specs/036-contas-a-pagar/spec.md, secao "Entrega 1 - Apuracao unica do
-- valor esperado da gaveta" (extrato impresso).
--
-- Motivo: o extrato agrupava movimentos por nomes fixos e omitia o vale de
-- profissional -- o vale sai da gaveta, entra no valor esperado (ticket 01
-- desta spec) e nao aparecia no papel, entao o papel nao fechava com a
-- contagem. O contrato de leitura get_cash_session_statement passa a devolver,
-- em cada movimento, o sentido ja materializado pelo ticket 01
-- (cash_movements.direction, gerada e obrigatoria) e o vinculo com o
-- profissional quando existir (cash_movements.professional_id, usado hoje
-- pelo vale). Chaves aditivas: a assinatura da funcao, as chaves ja
-- existentes e as demais secoes do extrato (ajustes, reaberturas) nao mudam.
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

  -- Chaves aditivas 'direction' e 'professional_id': o sentido ja e obrigatorio
  -- em cash_movements (ticket 01) e o vinculo com o profissional ja existe na
  -- linha do vale (spec 034); o extrato passa a devolver os dois em vez de
  -- deixar quem le adivinhar pelo tipo.
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'type', m.type,
      'direction', m.direction,
      'amount', m.amount,
      'reason', m.reason,
      'performed_by', m.performed_by,
      'payout_id', m.payout_id,
      'professional_id', m.professional_id,
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
