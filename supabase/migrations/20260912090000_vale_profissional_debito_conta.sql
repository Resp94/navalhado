-- Ticket 05 da spec 034: vale de profissional como debito na Conta do Profissional.
-- Tabela propria (professional_account_entries, ja criada no ticket 04): as obrigacoes
-- de comissao exigem vinculo obrigatorio com Comanda e valor estritamente positivo,
-- guardas que um vale nao satisfaz (nao nasce de Comanda, e deducao).
--
-- Vinculo bidirecional com cash_movements, no mesmo padrao ja usado para
-- repasse_comissao/payout_id: o movimento aponta o profissional, o lancamento
-- aponta o movimento.

-- -----------------------------------------------------------------------------
-- 1. Vinculo bidirecional cash_movements <-> professional_account_entries
-- -----------------------------------------------------------------------------
alter table public.cash_movements
  add column if not exists professional_id uuid references public.professionals(id) on delete restrict;

create index if not exists idx_cash_movements_professional
  on public.cash_movements (professional_id)
  where professional_id is not null;

alter table public.professional_account_entries
  add column if not exists cash_movement_id uuid references public.cash_movements(id) on delete restrict;

-- Um vale nao pode reivindicar a mesma saida de gaveta que outro.
create unique index if not exists idx_professional_account_entries_cash_movement
  on public.professional_account_entries (cash_movement_id)
  where cash_movement_id is not null;

-- -----------------------------------------------------------------------------
-- 2. register_professional_advance: lanca o vale e, se em dinheiro, a saida
--    correspondente na gaveta -- reusando a mesma validacao de saldo disponivel
--    ja usada em register_commission_payout, agora tambem descontando vales
--    ja existentes no turno (ticket 03).
-- -----------------------------------------------------------------------------
create or replace function public.register_professional_advance(
  p_professional_id uuid,
  p_amount numeric,
  p_reason text,
  p_payment_method text,
  p_tenant_id uuid default null,
  p_cash_session_id uuid default null
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
  v_target_tenant uuid;
  v_professional_tenant uuid;
  v_professional_active boolean;
  v_professional_deleted_at timestamptz;
  v_payment_method text;
  v_amount numeric;
  v_reason text;
  v_cash_session public.cash_sessions%rowtype;
  v_cash_received numeric;
  v_supplies numeric;
  v_withdrawals numeric;
  v_cash_payouts_existing numeric;
  v_advances_existing numeric;
  v_cash_available numeric;
  v_entry_id uuid;
  v_movement_id uuid;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  select role, tenant_id
    into v_user_role, v_user_tenant
  from public.users
  where id = v_user_id
    and is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado para lancar vale.' using errcode = '42501';
  end if;

  if p_tenant_id is not null then
    if v_user_role <> 'proprietario' and v_user_tenant <> p_tenant_id then
      raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
    end if;
    v_target_tenant := p_tenant_id;
  else
    v_target_tenant := v_user_tenant;
  end if;

  if v_target_tenant is null then
    raise exception 'Unidade nao informada.' using errcode = '22023';
  end if;

  v_payment_method := lower(btrim(coalesce(p_payment_method, '')));
  if v_payment_method not in ('pix', 'cash', 'credit_card', 'debit_card', 'transfer', 'other') then
    raise exception 'Metodo de pagamento invalido.' using errcode = 'P0001';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount = 'NaN'::numeric then
    raise exception 'O valor do vale deve ser maior que zero.' using errcode = '22023';
  end if;
  v_amount := round(p_amount, 2);
  if v_amount <= 0 then
    raise exception 'O valor do vale deve ter pelo menos um centavo.' using errcode = '22023';
  end if;

  v_reason := btrim(coalesce(p_reason, ''));
  if length(v_reason) < 5 then
    raise exception 'Informe um motivo com pelo menos cinco caracteres.' using errcode = '22023';
  end if;

  if v_payment_method = 'cash' then
    if p_cash_session_id is null then
      raise exception 'Informe a sessao de caixa para vale em dinheiro.' using errcode = '22023';
    end if;

    select * into v_cash_session
    from public.cash_sessions
    where id = p_cash_session_id
      and tenant_id = v_target_tenant
    for update;

    if not found or v_cash_session.status <> 'open' then
      raise exception 'A sessao de caixa informada nao esta aberta ou nao pertence a unidade.' using errcode = 'P0001';
    end if;

    select coalesce(sum(cp.amount) filter (where cp.payment_method = 'cash'), 0)
      into v_cash_received
    from public.comanda_pagamentos cp
    where cp.cash_session_id = p_cash_session_id and cp.tenant_id = v_target_tenant;

    select
      coalesce(sum(cm.amount) filter (where cm.type = 'suprimento'), 0),
      coalesce(sum(cm.amount) filter (where cm.type = 'sangria'), 0),
      coalesce(sum(cm.amount) filter (where cm.type = 'repasse_comissao' and cm.reversed_at is null), 0),
      coalesce(sum(cm.amount) filter (where cm.type = 'vale_profissional' and cm.reversed_at is null), 0)
      into v_supplies, v_withdrawals, v_cash_payouts_existing, v_advances_existing
    from public.cash_movements cm
    where cm.cash_session_id = p_cash_session_id and cm.tenant_id = v_target_tenant;

    v_cash_available := round(
      v_cash_session.initial_amount + v_cash_received + v_supplies - v_withdrawals
        - v_cash_payouts_existing - v_advances_existing,
      2
    );

    if v_amount > v_cash_available then
      raise exception 'O valor do vale em dinheiro excede o saldo disponivel na gaveta do turno.' using errcode = 'P0001';
    end if;
  else
    if p_cash_session_id is not null then
      raise exception 'Sessao de caixa so pode ser informada para vale em dinheiro.' using errcode = '22023';
    end if;
  end if;

  select tenant_id, is_active, deleted_at
    into v_professional_tenant, v_professional_active, v_professional_deleted_at
  from public.professionals
  where id = p_professional_id
  for update;

  if not found or v_professional_tenant <> v_target_tenant or not coalesce(v_professional_active, false) or v_professional_deleted_at is not null then
    raise exception 'Profissional nao encontrado ou inativo.' using errcode = 'P0001';
  end if;

  insert into public.professional_account_entries (
    tenant_id, professional_id, entry_type, direction, amount, settled_amount,
    status, reason, created_by
  ) values (
    v_target_tenant, p_professional_id, 'vale', 'debit', v_amount, 0,
    'open', v_reason, v_user_id
  ) returning id into v_entry_id;

  if v_payment_method = 'cash' then
    insert into public.cash_movements (
      tenant_id, cash_session_id, type, amount, reason, performed_by, professional_id
    ) values (
      v_target_tenant, p_cash_session_id, 'vale_profissional', v_amount, v_reason, v_user_id, p_professional_id
    ) returning id into v_movement_id;

    update public.professional_account_entries
    set cash_movement_id = v_movement_id
    where id = v_entry_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'entry_id', v_entry_id,
    'professional_id', p_professional_id,
    'amount', v_amount,
    'cash_movement_id', v_movement_id,
    'cash_session_id', p_cash_session_id
  );
end;
$function$;

revoke all on function public.register_professional_advance(uuid, numeric, text, text, uuid, uuid) from public, anon;
grant execute on function public.register_professional_advance(uuid, numeric, text, text, uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. reverse_professional_advance: estorno auditavel, no mesmo padrao ja usado
--    por reverse_commission_payout. Recusa estornar vale ja abatido (ticket 06
--    ainda nao existe, mas a guarda ja fica pronta para quando existir).
-- -----------------------------------------------------------------------------
create or replace function public.reverse_professional_advance(
  p_entry_id uuid,
  p_tenant_id uuid,
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
  v_target_tenant uuid;
  v_entry public.professional_account_entries%rowtype;
  v_cash_session public.cash_sessions%rowtype;
  v_result jsonb;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  select role, tenant_id into v_user_role, v_user_tenant
  from public.users where id = v_user_id and is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado para estornar vale.' using errcode = '42501';
  end if;

  if p_tenant_id is not null then
    if v_user_role <> 'proprietario' and v_user_tenant <> p_tenant_id then
      raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
    end if;
    v_target_tenant := p_tenant_id;
  else
    v_target_tenant := v_user_tenant;
  end if;

  if v_target_tenant is null then
    raise exception 'Unidade nao informada.' using errcode = '22023';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Informe uma justificativa com pelo menos cinco caracteres.' using errcode = '22023';
  end if;

  select * into v_entry
  from public.professional_account_entries
  where id = p_entry_id and tenant_id = v_target_tenant
  for update;

  if not found or v_entry.entry_type <> 'vale' then
    raise exception 'Vale nao encontrado para esta unidade.' using errcode = 'P0001';
  end if;

  if v_entry.reversed_at is not null then
    raise exception 'Este vale ja foi estornado.' using errcode = 'P0001';
  end if;

  if v_entry.settled_amount > 0 then
    raise exception 'Vale ja abatido parcial ou totalmente; estorne o abate antes.' using errcode = 'P0001';
  end if;

  if v_entry.cash_movement_id is not null then
    select cs.* into v_cash_session
    from public.cash_sessions cs
    join public.cash_movements cm on cm.cash_session_id = cs.id
    where cm.id = v_entry.cash_movement_id
    for update of cs;

    if not found or v_cash_session.status <> 'open' then
      raise exception 'A sessao de caixa do vale esta encerrada; reabra o turno antes de estornar.' using errcode = 'P0001';
    end if;
  end if;

  update public.professional_account_entries
  set status = 'reversed',
      reversed_at = timezone('utc'::text, now()),
      reversed_by = v_user_id,
      reversal_reason = btrim(p_reason)
  where id = p_entry_id;

  if v_entry.cash_movement_id is not null then
    update public.cash_movements
    set reversed_at = timezone('utc'::text, now()),
        reversed_by = v_user_id,
        reversal_reason = btrim(p_reason)
    where id = v_entry.cash_movement_id
      and type = 'vale_profissional'
      and reversed_at is null;
  end if;

  select to_jsonb(v_entry) || jsonb_build_object(
    'reversed', true,
    'reversed_at', timezone('utc'::text, now())
  ) into v_result;
  return v_result;
end;
$function$;

revoke all on function public.reverse_professional_advance(uuid, uuid, text) from public, anon;
grant execute on function public.reverse_professional_advance(uuid, uuid, text) to authenticated;
