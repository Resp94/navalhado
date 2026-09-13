-- Ticket 03 da spec 036 (expand): sangria e suprimento por RPC, com trava de
-- saldo na gaveta.
--
-- Spec: specs/036-contas-a-pagar/spec.md, secao "Entrega 1 - Apuracao unica do
-- valor esperado da gaveta" (fechamento da brecha de insercao direta).
--
-- Motivo: hoje o gestor lanca sangria e suprimento com um insert direto em
-- cash_movements. A politica de insercao (cash_movements_insert_policy) so
-- confere tenant, papel e sessao aberta -- ela nao sabe validar saldo, e nao
-- confere o autor informado pelo navegador:
--
--   1. Autor forjavel: performed_by vem do cliente e ninguem confere.
--   2. Saldo sem trava: uma sangria acima do disponivel deixa
--      expected_amount negativo, violando cash_sessions_expected_amount_check
--      no fechamento -- o mesmo defeito que a spec 033/034 corrigiu para a
--      quitacao de comissao e o vale (migrations
--      20260912060000_validar_saldo_gaveta_quitacao_comissao.sql).
--
-- public.register_cash_movement(p_cash_session_id, p_tenant_id, p_type,
-- p_amount, p_reason) e a nova RPC de movimento manual:
--
--   - aceita somente 'sangria' e 'suprimento' (qualquer outro tipo e
--     recusado, mesmo que a restricao da tabela um dia aceite outros
--     valores);
--   - grava performed_by a partir de auth.uid(), sem parametro de autor;
--   - trava a sessao (FOR UPDATE), exige que esteja aberta e pertenca ao
--     tenant informado, e so entao valida o saldo;
--   - para sangria, recusa qualquer valor acima do disponivel apurado por
--     private.compute_cash_session_expected_amount (ticket 01/036), com a
--     mesma mensagem-padrao da quitacao de comissao e do vale.
--
-- Expand-contract: este ticket migra os chamadores (aba de Caixa) para a
-- RPC, mas NAO revoga a insercao direta nem remove
-- cash_movements_insert_policy -- isso e o ticket 04, que so pode ser
-- aplicado depois que o frontend deste ticket estiver publicado em producao.
-- Arquivos pgTAP que inserem movimentos como superusuario so para montar
-- contexto (ex.: vale_profissional em 25_validar_saldo_gaveta_...) continuam
-- usando insert direto, fora do papel authenticated.
create or replace function public.register_cash_movement(
  p_cash_session_id uuid,
  p_tenant_id uuid,
  p_type text,
  p_amount numeric,
  p_reason text
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
  v_type text;
  v_amount numeric;
  v_reason text;
  v_session public.cash_sessions%rowtype;
  v_cash_available numeric;
  v_movement public.cash_movements%rowtype;
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
    raise exception 'Acesso negado. Apenas gerentes e proprietários podem lançar movimentações de caixa.' using errcode = '42501';
  end if;

  if p_cash_session_id is null or p_tenant_id is null then
    raise exception 'Sessão e unidade são obrigatórias.' using errcode = '22023';
  end if;
  if v_user_role <> 'proprietario' and v_user_tenant <> p_tenant_id then
    raise exception 'Acesso negado para a unidade solicitada.' using errcode = '42501';
  end if;

  v_type := lower(btrim(coalesce(p_type, '')));
  if v_type not in ('sangria', 'suprimento') then
    raise exception 'Tipo de movimentação inválido. Use sangria ou suprimento.' using errcode = 'P0001';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount = 'NaN'::numeric then
    raise exception 'O valor da movimentação deve ser maior que zero.' using errcode = '22023';
  end if;
  v_amount := round(p_amount, 2);
  if v_amount <= 0 then
    raise exception 'O valor da movimentação deve ter pelo menos um centavo.' using errcode = '22023';
  end if;

  v_reason := btrim(coalesce(p_reason, ''));
  if v_reason = '' then
    raise exception 'Informe o motivo da movimentação.' using errcode = '22023';
  end if;

  -- Trava a sessao antes de validar estado e saldo: mesma ordem de lock das
  -- demais escritas financeiras (quitacao de comissao, vale, fechamento).
  select * into v_session
  from public.cash_sessions
  where id = p_cash_session_id and tenant_id = p_tenant_id
  for update;

  if not found or v_session.status <> 'open' then
    raise exception 'A sessão de caixa não está aberta ou não existe.' using errcode = 'P0001';
  end if;

  if v_type = 'sangria' then
    -- Saldo disponivel = valor esperado da gaveta, pela apuracao unica, com a
    -- sessao ja travada acima. Sangria acima do disponivel e recusada em vez
    -- de deixar expected_amount negativo no fechamento do turno.
    select d.expected_amount
      into v_cash_available
    from private.compute_cash_session_expected_amount(p_cash_session_id, p_tenant_id) d;

    if v_amount > v_cash_available then
      raise exception 'O valor da sangria excede o saldo disponível na gaveta do turno.' using errcode = 'P0001';
    end if;
  end if;

  insert into public.cash_movements (
    tenant_id, cash_session_id, type, amount, reason, performed_by
  ) values (
    p_tenant_id, p_cash_session_id, v_type, v_amount, v_reason, v_user_id
  ) returning * into v_movement;

  return jsonb_build_object(
    'id', v_movement.id,
    'tenant_id', v_movement.tenant_id,
    'cash_session_id', v_movement.cash_session_id,
    'type', v_movement.type,
    'amount', v_movement.amount,
    'reason', v_movement.reason,
    'performed_by', v_movement.performed_by,
    'created_at', v_movement.created_at
  );
end;
$function$;

comment on function public.register_cash_movement(uuid, uuid, text, numeric, text) is
  'Ticket 03/036: sangria e suprimento por RPC. Trava a sessao, grava o autor da sessao autenticada e recusa sangria acima do saldo disponivel na gaveta.';

revoke all on function public.register_cash_movement(uuid, uuid, text, numeric, text) from public, anon;
grant execute on function public.register_cash_movement(uuid, uuid, text, numeric, text) to authenticated;
grant execute on function public.register_cash_movement(uuid, uuid, text, numeric, text) to service_role;
