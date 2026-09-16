-- Ticket 15 da spec 036 (Contas a Pagar): Baixa pela gaveta, seu estorno e o
-- pagamento de conta no extrato impresso.
-- Spec: specs/036-contas-a-pagar/spec.md, secao "Entrega 4 -- Baixa pela
-- gaveta".
--
-- Nenhuma funcao de apuracao e editada: private.compute_cash_session_expected_amount
-- (ticket 01/036) ja deriva o sentido de cada tipo por fora da agregacao, entao
-- o tipo novo 'baixa_conta_pagar' com sentido 'saida' passa a ser subtraido do
-- valor esperado sem tocar a funcao. As mesmas tres funcoes que ja consomem a
-- apuracao unica (close_cash_session, register_commission_payout,
-- register_professional_advance) enxergam o disponivel reduzido automaticamente
-- -- so close_cash_session precisa mudar aqui, e so pra gravar a versao de
-- calculo nova (nenhuma coluna de fotografia nova na Sessao de Caixa).
--
-- Vinculo bidirecional cash_movements <-> payable_settlements, mesmo padrao do
-- vale (ticket 05/034, cash_movements.professional_id <->
-- professional_account_entries.cash_movement_id), mas com indice unico nas
-- DUAS pontas (o vale so tem unicidade do lado do lancamento): uma Baixa nao
-- pode reivindicar a mesma saida de gaveta que outra, e um movimento nao pode
-- ser reivindicado por duas Baixas.
--
-- payable_settlements_drawer_link_check (ticket 07/036) ja exige
-- cash_movement_id preenchido no INSERT quando source = 'gaveta' -- CHECK nao
-- e deferravel no Postgres. Por isso a ordem de escrita e invertida em relacao
-- ao vale: o movimento nasce primeiro (sem payable_settlement_id ainda), a
-- Baixa nasce em seguida ja apontando pra ele, e so entao o movimento e
-- atualizado com o vinculo de volta -- as tres escritas na mesma transacao da
-- RPC.

-- -----------------------------------------------------------------------------
-- 1. Tipo novo de movimento e sentido materializado
-- -----------------------------------------------------------------------------
alter table public.cash_movements
  drop constraint if exists cash_movements_type_check;
alter table public.cash_movements
  add constraint cash_movements_type_check
  check (type = any (array['sangria', 'suprimento', 'repasse_comissao', 'vale_profissional', 'baixa_conta_pagar']));

-- Coluna gerada: nao ha "alter expression" no Postgres, entao dropar e recriar
-- e a unica forma de acrescentar um ramo ao CASE sem ramo padrao (mesma tecnica
-- da criacao no ticket 01/036).
alter table public.cash_movements
  drop column direction;
alter table public.cash_movements
  add column direction text
    generated always as (
      case type
        when 'suprimento' then 'entrada'
        when 'sangria' then 'saida'
        when 'repasse_comissao' then 'saida'
        when 'vale_profissional' then 'saida'
        when 'baixa_conta_pagar' then 'saida'
      end
    ) stored not null;

alter table public.cash_movements
  drop constraint if exists cash_movements_direction_check;
alter table public.cash_movements
  add constraint cash_movements_direction_check
  check (direction in ('entrada', 'saida'));

comment on column public.cash_movements.direction is
  'Sentido do movimento na gaveta (entrada ou saida), derivado do tipo sem ramo padrao. Tipo novo exige declarar o sentido aqui.';

-- -----------------------------------------------------------------------------
-- 2. Vinculo bidirecional cash_movements <-> payable_settlements
-- -----------------------------------------------------------------------------
alter table public.cash_movements
  add column if not exists payable_settlement_id uuid references public.payable_settlements(id);

create unique index if not exists idx_cash_movements_payable_settlement_unique
  on public.cash_movements (payable_settlement_id)
  where payable_settlement_id is not null;

-- payable_settlements.cash_movement_id ja existia (ticket 07/036) com indice
-- simples; passa a unico -- uma Baixa nao pode reivindicar a mesma saida de
-- gaveta que outra.
drop index if exists idx_payable_settlements_cash_movement_id;
create unique index if not exists idx_payable_settlements_cash_movement_id
  on public.payable_settlements (cash_movement_id)
  where cash_movement_id is not null;

-- -----------------------------------------------------------------------------
-- 3. settle_payable: aceita a origem gaveta (mesma assinatura do ticket 07/036).
-- -----------------------------------------------------------------------------
create or replace function public.settle_payable(
  p_payable_id uuid,
  p_principal numeric,
  p_payment_date date,
  p_payment_method text,
  p_interest_amount numeric default 0,
  p_discount_amount numeric default 0,
  p_source text default 'fora_do_caixa',
  p_cash_session_id uuid default null,
  p_tenant_id uuid default null
)
returns public.payable_settlements
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_timezone text;
  v_today date;
  v_payable public.payables%rowtype;
  v_source text;
  v_payment_method text;
  v_principal numeric(12,2);
  v_interest numeric(12,2);
  v_discount numeric(12,2);
  v_paid_amount numeric(12,2);
  v_remaining numeric(12,2);
  v_new_paid_amount numeric(12,2);
  v_new_status text;
  v_settlement public.payable_settlements%rowtype;
  v_cash_session public.cash_sessions%rowtype;
  v_cash_available numeric;
  v_movement_id uuid;
  v_payment_date date;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Usuário não autenticado.' using errcode = '42501';
  end if;

  select u.role, u.tenant_id
    into v_user_role, v_user_tenant
  from public.users u
  where u.id = v_user_id
    and u.is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado para dar Baixa em Contas a Pagar.' using errcode = '42501';
  end if;

  if p_tenant_id is not null then
    if v_user_role <> 'proprietario' and v_user_tenant is distinct from p_tenant_id then
      raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
    end if;
    v_target_tenant := p_tenant_id;
  else
    v_target_tenant := v_user_tenant;
  end if;

  if v_target_tenant is null then
    raise exception 'Unidade não informada.' using errcode = '22023';
  end if;

  -- Ordem de lock fixa: Conta a Pagar antes da Sessão de Caixa.
  select * into v_payable
  from public.payables
  where id = p_payable_id
    and tenant_id = v_target_tenant
  for update;

  if not found then
    raise exception 'Conta a pagar não encontrada.' using errcode = 'P0001';
  end if;

  if v_payable.status not in ('open', 'partially_paid') then
    raise exception 'Só é possível dar Baixa numa conta em aberto ou parcialmente paga.' using errcode = 'P0001';
  end if;

  v_source := lower(btrim(coalesce(p_source, 'fora_do_caixa')));
  if v_source not in ('gaveta', 'fora_do_caixa') then
    raise exception 'Origem do dinheiro inválida.' using errcode = '22023';
  end if;

  v_payment_method := lower(btrim(coalesce(p_payment_method, '')));
  if v_payment_method not in (
    'cash', 'pix', 'transfer', 'boleto', 'credit_card', 'debit_card', 'automatic_debit', 'other'
  ) then
    raise exception 'Forma de pagamento inválida.' using errcode = '22023';
  end if;

  select coalesce(t.timezone, 'America/Sao_Paulo')
    into v_timezone
  from public.tenants t
  where t.id = v_target_tenant;

  v_today := (now() at time zone v_timezone)::date;

  if v_source = 'gaveta' then
    if v_payment_method <> 'cash' then
      raise exception 'Baixa pela gaveta só aceita a forma de pagamento dinheiro.' using errcode = '22023';
    end if;
    if p_cash_session_id is null then
      raise exception 'Informe a sessão de caixa para Baixa pela gaveta.' using errcode = '22023';
    end if;

    select * into v_cash_session
    from public.cash_sessions
    where id = p_cash_session_id
      and tenant_id = v_target_tenant
    for update;

    if not found or v_cash_session.status <> 'open' then
      raise exception 'A sessão de caixa informada não está aberta ou não pertence à unidade.' using errcode = 'P0001';
    end if;

    -- A data do pagamento pela gaveta é sempre o dia de negócio corrente,
    -- definida pelo servidor: o dinheiro sai da gaveta no momento da operação.
    v_payment_date := v_today;
  else
    if p_cash_session_id is not null then
      raise exception 'Sessão de caixa só pode ser informada para Baixa pela gaveta.' using errcode = '22023';
    end if;

    if p_payment_date is null then
      raise exception 'Data do pagamento é obrigatória.' using errcode = '22023';
    end if;
    if p_payment_date > v_today then
      raise exception 'A data do pagamento não pode estar no futuro.' using errcode = '22023';
    end if;
    v_payment_date := p_payment_date;
  end if;

  if p_principal is null then
    raise exception 'Principal é obrigatório.' using errcode = '22023';
  end if;
  v_principal := round(p_principal::numeric, 2);
  if v_principal <= 0 then
    raise exception 'O principal deve ser maior que zero.' using errcode = '22023';
  end if;

  v_remaining := round(v_payable.amount - v_payable.paid_amount, 2);
  if v_principal > v_remaining then
    raise exception 'O principal não pode exceder o saldo restante da conta.' using errcode = '22023';
  end if;

  v_interest := round(coalesce(p_interest_amount, 0)::numeric, 2);
  if v_interest < 0 then
    raise exception 'Juros e multa não podem ser negativos.' using errcode = '22023';
  end if;

  v_discount := round(coalesce(p_discount_amount, 0)::numeric, 2);
  if v_discount < 0 then
    raise exception 'O desconto não pode ser negativo.' using errcode = '22023';
  end if;
  if v_discount > v_principal + v_interest then
    raise exception 'O desconto não pode exceder o principal mais os juros.' using errcode = '22023';
  end if;

  v_paid_amount := v_principal + v_interest - v_discount;
  -- Valor pago zero só é aceito fora do caixa (abatimento concedido pelo fornecedor).
  if v_source = 'gaveta' and v_paid_amount <= 0 then
    raise exception 'O valor pago deve ser maior que zero.' using errcode = '22023';
  end if;

  if v_source = 'gaveta' then
    -- Saldo disponivel = valor esperado da gaveta, pela apuracao unica, com a
    -- sessao ja travada acima.
    select d.expected_amount
      into v_cash_available
    from private.compute_cash_session_expected_amount(p_cash_session_id, v_target_tenant) d;

    if v_paid_amount > v_cash_available then
      raise exception 'O valor pago excede o saldo disponível na gaveta do turno.' using errcode = 'P0001';
    end if;

    -- O CHECK payable_settlements_drawer_link_check exige cash_movement_id ja
    -- preenchido no INSERT da Baixa (CHECK nao e deferravel) -- o movimento
    -- nasce primeiro, sem o vinculo de volta ainda.
    insert into public.cash_movements (
      tenant_id, cash_session_id, type, amount, reason, performed_by
    ) values (
      v_target_tenant, p_cash_session_id, 'baixa_conta_pagar', v_paid_amount,
      'Baixa de conta a pagar: ' || v_payable.description, v_user_id
    ) returning id into v_movement_id;
  end if;

  insert into public.payable_settlements (
    tenant_id, payable_id, principal, interest_amount, discount_amount,
    payment_date, payment_method, source, cash_session_id, cash_movement_id, created_by
  ) values (
    v_target_tenant, p_payable_id, v_principal, v_interest, v_discount,
    v_payment_date, v_payment_method, v_source, p_cash_session_id, v_movement_id, v_user_id
  ) returning * into v_settlement;

  if v_source = 'gaveta' then
    update public.cash_movements
    set payable_settlement_id = v_settlement.id
    where id = v_movement_id;
  end if;

  v_new_paid_amount := round(v_payable.paid_amount + v_principal, 2);
  v_new_status := case
    when v_new_paid_amount >= v_payable.amount then 'paid'
    when v_new_paid_amount > 0 then 'partially_paid'
    else 'open'
  end;

  update public.payables
  set paid_amount = v_new_paid_amount,
      status = v_new_status,
      updated_at = timezone('utc'::text, now()),
      updated_by = v_user_id
  where id = p_payable_id;

  return v_settlement;
end;
$function$;

comment on function public.settle_payable(uuid, numeric, date, text, numeric, numeric, text, uuid, uuid) is
  'Ticket 07+15/036: Baixa de Conta a Pagar, fora do caixa ou pela gaveta. Pela gaveta: só dinheiro, sessão aberta travada antes da escrita, data definida pelo servidor, valor limitado ao disponível apurado por private.compute_cash_session_expected_amount.';

-- -----------------------------------------------------------------------------
-- 4. reverse_payable_settlement: estorno pela gaveta devolve o valor ao turno,
--    so aceito com a sessao do movimento ainda aberta.
-- -----------------------------------------------------------------------------
create or replace function public.reverse_payable_settlement(
  p_settlement_id uuid,
  p_reason text,
  p_tenant_id uuid default null
)
returns public.payable_settlements
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_reason text;
  v_payable_id uuid;
  v_payable public.payables%rowtype;
  v_settlement public.payable_settlements%rowtype;
  v_cash_session public.cash_sessions%rowtype;
  v_new_paid_amount numeric(12,2);
  v_new_status text;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Usuário não autenticado.' using errcode = '42501';
  end if;

  select u.role, u.tenant_id
    into v_user_role, v_user_tenant
  from public.users u
  where u.id = v_user_id
    and u.is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado para estornar Baixa.' using errcode = '42501';
  end if;

  if p_tenant_id is not null then
    if v_user_role <> 'proprietario' and v_user_tenant is distinct from p_tenant_id then
      raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
    end if;
    v_target_tenant := p_tenant_id;
  else
    v_target_tenant := v_user_tenant;
  end if;

  if v_target_tenant is null then
    raise exception 'Unidade não informada.' using errcode = '22023';
  end if;

  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) < 5 then
    raise exception 'Informe um motivo com pelo menos cinco caracteres.' using errcode = '22023';
  end if;

  select payable_id into v_payable_id
  from public.payable_settlements
  where id = p_settlement_id
    and tenant_id = v_target_tenant;

  if not found then
    raise exception 'Baixa não encontrada.' using errcode = 'P0001';
  end if;

  -- Ordem de lock fixa: Conta a Pagar antes da Baixa.
  select * into v_payable
  from public.payables
  where id = v_payable_id
    and tenant_id = v_target_tenant
  for update;

  if not found then
    raise exception 'Conta a pagar não encontrada.' using errcode = 'P0001';
  end if;

  select * into v_settlement
  from public.payable_settlements
  where id = p_settlement_id
    and tenant_id = v_target_tenant
  for update;

  if v_settlement.reversed_at is not null then
    raise exception 'Esta Baixa já foi estornada.' using errcode = 'P0001';
  end if;

  if v_settlement.cash_movement_id is not null then
    select cs.* into v_cash_session
    from public.cash_sessions cs
    join public.cash_movements cm on cm.cash_session_id = cs.id
    where cm.id = v_settlement.cash_movement_id
    for update of cs;

    if not found or v_cash_session.status <> 'open' then
      raise exception 'A sessão de caixa da Baixa está encerrada; reabra o turno antes de estornar.' using errcode = 'P0001';
    end if;
  end if;

  update public.payable_settlements
  set reversed_at = timezone('utc'::text, now()),
      reversed_by = v_user_id,
      reversal_reason = v_reason
  where id = p_settlement_id
  returning * into v_settlement;

  if v_settlement.cash_movement_id is not null then
    update public.cash_movements
    set reversed_at = timezone('utc'::text, now()),
        reversed_by = v_user_id,
        reversal_reason = v_reason
    where id = v_settlement.cash_movement_id
      and type = 'baixa_conta_pagar'
      and reversed_at is null;
  end if;

  v_new_paid_amount := round(v_payable.paid_amount - v_settlement.principal, 2);
  if v_new_paid_amount < 0 then
    v_new_paid_amount := 0;
  end if;
  v_new_status := case
    when v_new_paid_amount <= 0 then 'open'
    when v_new_paid_amount < v_payable.amount then 'partially_paid'
    else 'paid'
  end;

  update public.payables
  set paid_amount = v_new_paid_amount,
      status = v_new_status,
      updated_at = timezone('utc'::text, now()),
      updated_by = v_user_id
  where id = v_payable_id;

  return v_settlement;
end;
$function$;

comment on function public.reverse_payable_settlement(uuid, text, uuid) is
  'Ticket 07+15/036: estorna uma Baixa de Conta a Pagar, devolvendo o principal ao saldo. Pela gaveta, exige a sessão do movimento aberta e devolve o valor à gaveta. Nada é apagado.';

-- -----------------------------------------------------------------------------
-- 5. close_cash_session: versao de calculo nova -- o valor esperado ja
--    considera pagamentos de conta pela apuracao unica, sem coluna de
--    fotografia nova.
-- -----------------------------------------------------------------------------
create or replace function public.close_cash_session(
  p_session_id uuid,
  p_tenant_id uuid,
  p_closing_amount numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
  v_commission_payouts numeric := 0;
  v_professional_advances numeric := 0;
  v_payable_settlements numeric := 0;
  v_movements_by_type jsonb;
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
  if v_user_role <> 'proprietario' and v_user_tenant is distinct from p_tenant_id then
    raise exception 'Acesso negado para a unidade solicitada.' using errcode = '42501';
  end if;

  select * into v_session
  from public.cash_sessions
  where id = p_session_id and tenant_id = p_tenant_id
  for update;
  if not found or v_session.status <> 'open' then
    raise exception 'A sessão de caixa não está aberta ou não existe.' using errcode = 'P0001';
  end if;

  -- Valor esperado da gaveta pela apuracao unica (a sessao ja esta travada acima)
  -- e, na MESMA instrucao, os meios nao fisicos e a contagem de pagamentos da
  -- fotografia do turno: um unico snapshot de leitura, para que a contagem nunca
  -- discorde do dinheiro recebido que entrou no valor esperado.
  select d.cash_received, d.expected_amount, d.movements_by_type,
         p.pix_received, p.card_received, p.other_received, p.payment_count
    into v_cash_received, v_expected, v_movements_by_type,
         v_pix_received, v_card_received, v_other_received, v_payment_count
  from private.compute_cash_session_expected_amount(p_session_id, p_tenant_id) d
  cross join (
    select
      coalesce(sum(cp.amount) filter (where cp.payment_method = 'pix'), 0) as pix_received,
      coalesce(sum(cp.amount) filter (where cp.payment_method in ('credit_card', 'debit_card')), 0) as card_received,
      coalesce(sum(cp.amount) filter (where cp.payment_method = 'other'), 0) as other_received,
      count(*) as payment_count
    from public.comanda_pagamentos cp
    where cp.cash_session_id = p_session_id and cp.tenant_id = p_tenant_id
  ) p;

  -- Parcelas por tipo para a fotografia e as chaves de retorno, lidas do mesmo
  -- detalhamento que produziu o valor esperado.
  select
    coalesce(sum((m->>'amount')::numeric) filter (where m->>'type' = 'suprimento'), 0),
    coalesce(sum((m->>'amount')::numeric) filter (where m->>'type' = 'sangria'), 0),
    coalesce(sum((m->>'amount')::numeric) filter (where m->>'type' = 'repasse_comissao'), 0),
    coalesce(sum((m->>'amount')::numeric) filter (where m->>'type' = 'vale_profissional'), 0),
    coalesce(sum((m->>'amount')::numeric) filter (where m->>'type' = 'baixa_conta_pagar'), 0)
  into v_supplies, v_withdrawals, v_commission_payouts, v_professional_advances, v_payable_settlements
  from jsonb_array_elements(v_movements_by_type) m;

  v_difference := round(p_closing_amount - v_expected, 2);

  update public.cash_sessions
  set closed_by = v_user_id,
      closing_amount = round(p_closing_amount, 2),
      expected_amount = v_expected,
      difference_amount = v_difference,
      cash_received_amount = round(v_cash_received, 2),
      pix_received_amount = round(v_pix_received, 2),
      card_received_amount = round(v_card_received, 2),
      other_received_amount = round(v_other_received, 2),
      payment_count = v_payment_count,
      supplies_amount = round(v_supplies, 2),
      withdrawals_amount = round(v_withdrawals, 2),
      calculation_version = 'cash_expected_v4',
      status = 'closed',
      closed_at = timezone('utc'::text, now()),
      notes = p_notes
  where id = p_session_id and tenant_id = p_tenant_id
  returning * into v_session;

  select to_jsonb(v_session) || jsonb_build_object(
    'cash_received', v_cash_received,
    'pix_received', v_pix_received,
    'card_received', v_card_received,
    'other_received', v_other_received,
    'payment_count', v_payment_count,
    'supplies', v_supplies,
    'withdrawals', v_withdrawals,
    'commission_payouts', v_commission_payouts,
    'professional_advances', v_professional_advances,
    'payable_settlements', v_payable_settlements
  ) into v_result;
  return v_result;
end;
$function$;

comment on function public.close_cash_session(uuid, uuid, numeric, text) is
  'Ticket 01+15/036: fecha a Sessão de Caixa. Versão de cálculo cash_expected_v4: o valor esperado já considera pagamentos de conta a pagar pela gaveta, pela apuração única. Nenhuma coluna de fotografia nova.';

revoke all on function public.close_cash_session(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.close_cash_session(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.close_cash_session(uuid, uuid, numeric, text) to service_role;

-- -----------------------------------------------------------------------------
-- 6. get_cash_session_statement: chaves aditivas para o pagamento de conta --
--    vinculo com a Baixa e a descricao da Conta a Pagar, ja que o extrato
--    ganha rotulo proprio pra esse tipo no ticket 15/036.
-- -----------------------------------------------------------------------------
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

  if v_user_role <> 'proprietario' and v_user_tenant is distinct from p_tenant_id then
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

  -- Chaves aditivas 'payable_settlement_id' e 'payable_description': o vinculo
  -- ja existe na linha (ticket 15/036) e a descricao vem da Conta a Pagar via
  -- a Baixa, pra o extrato mostrar rotulo proprio sem replicar a leitura.
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
      'payable_settlement_id', m.payable_settlement_id,
      'payable_description', p.description,
      'created_at', m.created_at,
      'reversed_at', m.reversed_at,
      'reversed_by', m.reversed_by,
      'reversal_reason', m.reversal_reason
    )
    order by m.created_at
  ), '[]'::jsonb)
  into v_movements
  from public.cash_movements m
  left join public.payable_settlements ps on ps.id = m.payable_settlement_id
  left join public.payables p on p.id = ps.payable_id
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

comment on function public.get_cash_session_statement(uuid, uuid) is
  'Ticket 02+05+15/036: extrato da Sessão de Caixa, com sentido, vínculos e a descrição da Conta a Pagar em pagamentos pela gaveta. Chaves aditivas.';

revoke all on function public.get_cash_session_statement(uuid, uuid) from public;
revoke all on function public.get_cash_session_statement(uuid, uuid) from anon;
grant execute on function public.get_cash_session_statement(uuid, uuid) to authenticated;
grant execute on function public.get_cash_session_statement(uuid, uuid) to service_role;
