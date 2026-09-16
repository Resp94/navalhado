-- Ticket 06 (spec 033): estorno de Quitacao de Comissao. O gerente desfaz um
-- repasse registrado por engano; cada obrigacao volta exatamente ao saldo que
-- tinha antes daquele pagamento, a quitacao estornada deixa de contar como
-- paga mas permanece visivel no historico, e o dinheiro volta a gaveta
-- quando o repasse foi em dinheiro (com o turno ainda aberto).

alter table public.commission_payouts
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by uuid references public.users(id) on delete set null,
  add column if not exists reversal_reason text;

alter table public.commission_payouts
  drop constraint if exists commission_payouts_reversal_reason_check;
alter table public.commission_payouts
  add constraint commission_payouts_reversal_reason_check
  check (reversed_at is null or length(btrim(reversal_reason)) >= 5);

alter table public.cash_movements
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by uuid references auth.users(id),
  add column if not exists reversal_reason text;

create index if not exists idx_commission_payouts_reversed
  on public.commission_payouts (professional_id, tenant_id)
  where reversed_at is null;

-- A quitacao estornada deixa de contar como paga: o calculo legado (itens sem
-- obrigacao no livro novo) e o saldo por profissional passam a ignorar
-- quitacoes com reversed_at preenchido.
create or replace function public.register_commission_payout(
  p_professional_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_notes text default null,
  p_paid_at timestamptz default timezone('utc'::text, now()),
  p_tenant_id uuid default null,
  p_cash_session_id uuid default null
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
  v_target_tenant uuid;
  v_professional_tenant uuid;
  v_professional_active boolean;
  v_professional_deleted_at timestamptz;
  v_payment_method text;
  v_payout_amount numeric;
  v_open_obligation_amount numeric := 0;
  v_legacy_total_commission numeric := 0;
  v_legacy_paid_commission numeric := 0;
  v_legacy_open_amount numeric := 0;
  v_remaining numeric;
  v_allocation numeric;
  v_allocated_amount numeric := 0;
  v_legacy_allocated_amount numeric := 0;
  v_payout_id uuid;
  v_obligation record;
  v_cash_session public.cash_sessions%rowtype;
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
    raise exception 'Acesso negado para quitar comissoes.' using errcode = '42501';
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
    raise exception 'O valor do pagamento deve ser maior que zero.' using errcode = '22023';
  end if;
  v_payout_amount := round(p_amount, 2);
  if v_payout_amount <= 0 then
    raise exception 'O valor do pagamento deve ter pelo menos um centavo.' using errcode = '22023';
  end if;

  if v_payment_method = 'cash' then
    if p_cash_session_id is null then
      raise exception 'Informe a sessao de caixa para quitacao em dinheiro.' using errcode = '22023';
    end if;

    select * into v_cash_session
    from public.cash_sessions
    where id = p_cash_session_id
      and tenant_id = v_target_tenant
    for update;

    if not found or v_cash_session.status <> 'open' then
      raise exception 'A sessao de caixa informada nao esta aberta ou nao pertence a unidade.' using errcode = 'P0001';
    end if;
  else
    if p_cash_session_id is not null then
      raise exception 'Sessao de caixa so pode ser informada para quitacao em dinheiro.' using errcode = '22023';
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

  for v_obligation in
    select o.id, o.amount, o.settled_amount
    from public.commission_obligations o
    where o.tenant_id = v_target_tenant
      and o.professional_id = p_professional_id
      and o.status in ('open', 'partially_paid')
      and o.settled_amount < o.amount
    order by o.created_at, o.id
    for update
  loop
    v_open_obligation_amount := v_open_obligation_amount + (v_obligation.amount - v_obligation.settled_amount);
  end loop;

  with legacy_items as (
    select
      case
        when ci.snapshot_status in ('confirmed', 'estimated')
         and ci.snapshot_commission_amount is not null
          then ci.snapshot_commission_amount
        when ci.snapshot_status in ('unavailable', 'reverted') then 0
        when ci.item_type in ('servico', 'service') or ci.service_id is not null then
          round(ci.total_price * coalesce(ps.custom_commission_percentage, s.commission_percentage, prof.commission_percentage, 0) / 100, 2)
        when ci.item_type in ('produto', 'product') or ci.product_id is not null then
          round(ci.total_price * coalesce(prod.commission_percentage, 0) / 100, 2)
        else 0
      end as commission_amount
    from public.comanda_itens ci
    join public.comandas c on c.id = ci.comanda_id
    left join public.professionals prof on prof.id = ci.professional_id
    left join public.services s on s.id = ci.service_id
    left join public.professional_services ps
      on ps.service_id = ci.service_id
     and ps.professional_id = ci.professional_id
     and ps.tenant_id = ci.tenant_id
    left join public.products prod on prod.id = ci.product_id
    where c.tenant_id = v_target_tenant
      and c.status in ('fechada', 'closed')
      and ci.professional_id = p_professional_id
      and not exists (
        select 1 from public.commission_obligations o where o.comanda_item_id = ci.id
      )
  )
  select coalesce(sum(commission_amount), 0)
    into v_legacy_total_commission
  from legacy_items;

  -- Quitacoes estornadas deixam de contar como pagas no calculo legado.
  select coalesce(sum(
    case
      when exists (select 1 from public.commission_payout_allocations a where a.payout_id = cp.id)
        then coalesce(cp.legacy_allocated_amount, 0)
      else cp.amount
    end
  ), 0)
    into v_legacy_paid_commission
  from public.commission_payouts cp
  where cp.tenant_id = v_target_tenant
    and cp.professional_id = p_professional_id
    and cp.reversed_at is null;

  v_legacy_open_amount := greatest(0, v_legacy_total_commission - v_legacy_paid_commission);
  if v_payout_amount > v_open_obligation_amount + v_legacy_open_amount then
    raise exception 'O valor informado excede o saldo pendente de comissao.' using errcode = 'P0001';
  end if;

  insert into public.commission_payouts (
    tenant_id, professional_id, amount, payment_method, notes, paid_at, created_by, cash_session_id
  ) values (
    v_target_tenant, p_professional_id, v_payout_amount, v_payment_method,
    p_notes, coalesce(p_paid_at, timezone('utc'::text, now())), v_user_id, p_cash_session_id
  ) returning id into v_payout_id;

  if v_payment_method = 'cash' then
    insert into public.cash_movements (
      tenant_id, cash_session_id, type, amount, reason, performed_by, payout_id
    ) values (
      v_target_tenant, p_cash_session_id, 'repasse_comissao', v_payout_amount,
      coalesce(nullif(btrim(p_notes), ''), 'Repasse de comissao'), v_user_id, v_payout_id
    );
  end if;

  v_remaining := v_payout_amount;
  for v_obligation in
    select o.id, o.amount, o.settled_amount
    from public.commission_obligations o
    where o.tenant_id = v_target_tenant
      and o.professional_id = p_professional_id
      and o.status in ('open', 'partially_paid')
      and o.settled_amount < o.amount
    order by o.created_at, o.id
    for update
  loop
    exit when v_remaining <= 0;
    v_allocation := least(v_remaining, v_obligation.amount - v_obligation.settled_amount);
    if v_allocation <= 0 then
      continue;
    end if;

    insert into public.commission_payout_allocations (
      tenant_id, payout_id, obligation_id, amount
    ) values (
      v_target_tenant, v_payout_id, v_obligation.id, v_allocation
    );

    update public.commission_obligations
    set settled_amount = settled_amount + v_allocation,
        status = case
          when settled_amount + v_allocation >= amount then 'paid'
          else 'partially_paid'
        end
    where id = v_obligation.id;

    v_remaining := v_remaining - v_allocation;
    v_allocated_amount := v_allocated_amount + v_allocation;
  end loop;

  v_legacy_allocated_amount := greatest(0, v_payout_amount - v_allocated_amount);
  update public.commission_payouts
  set legacy_allocated_amount = v_legacy_allocated_amount
  where id = v_payout_id;

  return jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'amount', v_payout_amount,
    'professional_id', p_professional_id,
    'allocated_amount', v_allocated_amount,
    'legacy_amount', greatest(0, v_payout_amount - v_allocated_amount),
    'cash_session_id', p_cash_session_id
  );
end;
$function$;

create or replace function public.get_professional_commission_balance(
  p_professional_id uuid,
  p_start_date timestamp with time zone default null,
  p_end_date timestamp with time zone default null,
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_open_ledger numeric := 0;
  v_generated_ledger numeric := 0;
  v_legacy_generated numeric := 0;
  v_legacy_generated_period numeric := 0;
  v_legacy_paid numeric := 0;
  v_paid_period numeric := 0;
  v_start timestamptz := coalesce(p_start_date, '-infinity'::timestamptz);
  v_end timestamptz := coalesce(p_end_date, 'infinity'::timestamptz);
begin
  select role, tenant_id into v_user_role, v_user_tenant
  from public.users where id = v_user_id and is_active = true;
  if v_user_role is null then
    raise exception 'Acesso negado para consultar comissoes.' using errcode = '42501';
  end if;

  if v_user_role = 'barbeiro' then
    select p.tenant_id into v_target_tenant
    from public.professionals p
    where p.id = p_professional_id
      and p.user_id = v_user_id
      and p.is_active = true
      and p.deleted_at is null;
    if not found or (p_tenant_id is not null and v_target_tenant <> p_tenant_id) then
      raise exception 'Acesso negado para este extrato.' using errcode = '42501';
    end if;
  elsif v_user_role in ('gerente', 'proprietario') then
    if p_tenant_id is not null then
      if v_user_role <> 'proprietario' and v_user_tenant <> p_tenant_id then
        raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
      end if;
      v_target_tenant := p_tenant_id;
    else
      v_target_tenant := v_user_tenant;
    end if;
  else
    raise exception 'Acesso negado para consultar comissoes.' using errcode = '42501';
  end if;
  if v_target_tenant is null then
    raise exception 'Unidade nao informada.' using errcode = '22023';
  end if;

  select coalesce(sum(greatest(0, o.amount - o.settled_amount)), 0)
    into v_open_ledger
  from public.commission_obligations o
  where o.tenant_id = v_target_tenant
    and o.professional_id = p_professional_id
    and o.status in ('open', 'partially_paid');

  select coalesce(sum(o.amount), 0)
    into v_generated_ledger
  from public.commission_obligations o
  where o.tenant_id = v_target_tenant
    and o.professional_id = p_professional_id
    and o.status <> 'reversed'
    and o.created_at >= v_start and o.created_at <= v_end;

  with legacy_items as (
    select ci.total_price, c.closed_at,
      case
        when ci.snapshot_status in ('confirmed', 'estimated')
         and ci.snapshot_commission_amount is not null
          then ci.snapshot_commission_amount
        else 0
      end as commission_amount
    from public.comanda_itens ci
    join public.comandas c on c.id = ci.comanda_id
    where c.tenant_id = v_target_tenant
      and c.status in ('fechada', 'closed')
      and ci.professional_id = p_professional_id
      and not exists (select 1 from public.commission_obligations o where o.comanda_item_id = ci.id)
  )
  select coalesce(sum(commission_amount), 0),
         coalesce(sum(commission_amount) filter (where closed_at >= v_start and closed_at <= v_end), 0)
    into v_legacy_generated, v_legacy_generated_period
  from legacy_items;

  -- Quitacoes estornadas deixam de contar como pagas.
  select coalesce(sum(
    case
      when exists (select 1 from public.commission_payout_allocations a where a.payout_id = cp.id)
        then coalesce(cp.legacy_allocated_amount, 0)
      else cp.amount
    end
  ), 0) into v_legacy_paid
  from public.commission_payouts cp
  where cp.tenant_id = v_target_tenant
    and cp.professional_id = p_professional_id
    and cp.reversed_at is null;

  select coalesce(sum(cp.amount), 0) into v_paid_period
  from public.commission_payouts cp
  where cp.tenant_id = v_target_tenant
    and cp.professional_id = p_professional_id
    and cp.reversed_at is null
    and cp.paid_at >= v_start and cp.paid_at <= v_end;

  return jsonb_build_object(
    'current_open_balance', v_open_ledger + greatest(0, v_legacy_generated - v_legacy_paid),
    'generated_commission', v_generated_ledger + v_legacy_generated_period,
    'paid_commission', v_paid_period
  );
end;
$function$;

-- O fechamento passa a ignorar movimentacoes de repasse de comissao ja
-- estornadas no calculo do valor esperado.
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
    raise exception 'Acesso negado para a unidade solicitada.' using errcode = '42501';
  end if;

  select * into v_session
  from public.cash_sessions
  where id = p_session_id and tenant_id = p_tenant_id
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
  where cp.cash_session_id = p_session_id and cp.tenant_id = p_tenant_id;

  select
    coalesce(sum(cm.amount) filter (where cm.type = 'suprimento'), 0),
    coalesce(sum(cm.amount) filter (where cm.type = 'sangria'), 0),
    coalesce(sum(cm.amount) filter (where cm.type = 'repasse_comissao' and cm.reversed_at is null), 0)
  into v_supplies, v_withdrawals, v_commission_payouts
  from public.cash_movements cm
  where cm.cash_session_id = p_session_id and cm.tenant_id = p_tenant_id;

  v_expected := round(
    v_session.initial_amount + v_cash_received + v_supplies - v_withdrawals - v_commission_payouts,
    2
  );
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
      calculation_version = 'cash_expected_v2',
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
    'commission_payouts', v_commission_payouts
  ) into v_result;
  return v_result;
end;
$function$;

create or replace function public.reverse_commission_payout(
  p_payout_id uuid,
  p_tenant_id uuid,
  p_reason text
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
  v_target_tenant uuid;
  v_payout public.commission_payouts%rowtype;
  v_cash_session public.cash_sessions%rowtype;
  v_allocation record;
  v_new_settled numeric;
  v_result jsonb;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  select role, tenant_id into v_user_role, v_user_tenant
  from public.users where id = v_user_id and is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado para estornar quitacoes.' using errcode = '42501';
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

  select * into v_payout
  from public.commission_payouts
  where id = p_payout_id and tenant_id = v_target_tenant
  for update;

  if not found then
    raise exception 'Quitacao nao encontrada para esta unidade.' using errcode = 'P0001';
  end if;

  if v_payout.reversed_at is not null then
    raise exception 'Esta quitacao ja foi estornada.' using errcode = 'P0001';
  end if;

  -- Serializa com register_commission_payout pelo mesmo ponto de travamento.
  perform 1 from public.professionals where id = v_payout.professional_id for update;

  if v_payout.payment_method = 'cash' then
    if v_payout.cash_session_id is null then
      raise exception 'Quitacao em dinheiro sem sessao de caixa associada.' using errcode = 'P0001';
    end if;

    select * into v_cash_session
    from public.cash_sessions
    where id = v_payout.cash_session_id
    for update;

    if not found or v_cash_session.status <> 'open' then
      raise exception 'A sessao de caixa do repasse esta encerrada; reabra o turno antes de estornar.' using errcode = 'P0001';
    end if;
  end if;

  for v_allocation in
    select a.id, a.obligation_id, a.amount
    from public.commission_payout_allocations a
    where a.payout_id = p_payout_id
    for update
  loop
    update public.commission_obligations o
    set settled_amount = greatest(0, o.settled_amount - v_allocation.amount),
        status = case
          when greatest(0, o.settled_amount - v_allocation.amount) <= 0 then 'open'
          when greatest(0, o.settled_amount - v_allocation.amount) < o.amount then 'partially_paid'
          else 'paid'
        end
    where o.id = v_allocation.obligation_id
      and o.status <> 'reversed';
  end loop;

  update public.commission_payouts
  set reversed_at = timezone('utc'::text, now()),
      reversed_by = v_user_id,
      reversal_reason = btrim(p_reason)
  where id = p_payout_id;

  if v_payout.payment_method = 'cash' then
    update public.cash_movements
    set reversed_at = timezone('utc'::text, now()),
        reversed_by = v_user_id,
        reversal_reason = btrim(p_reason)
    where payout_id = p_payout_id
      and type = 'repasse_comissao'
      and reversed_at is null;
  end if;

  select to_jsonb(v_payout) || jsonb_build_object(
    'reversed', true,
    'reversed_at', timezone('utc'::text, now())
  ) into v_result;
  return v_result;
end;
$function$;

revoke all on function public.reverse_commission_payout(uuid, uuid, text) from public;
revoke all on function public.reverse_commission_payout(uuid, uuid, text) from anon;
grant execute on function public.reverse_commission_payout(uuid, uuid, text) to authenticated;
grant execute on function public.reverse_commission_payout(uuid, uuid, text) to service_role;
