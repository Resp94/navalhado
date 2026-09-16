-- Correção pós-QA do ticket 04: quitação de comissão em dinheiro não
-- validava se a gaveta do turno tinha saldo suficiente para a saída,
-- permitindo que o fechamento de caixa ficasse impossível de concluir
-- (expected_amount negativo violando cash_sessions_expected_amount_check).
-- Agora register_commission_payout recusa o repasse em dinheiro que
-- excede o saldo disponível na gaveta daquele turno.

create or replace function public.register_commission_payout(
  p_professional_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_notes text default null,
  p_paid_at timestamp with time zone default timezone('utc'::text, now()),
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
  v_cash_received numeric;
  v_supplies numeric;
  v_withdrawals numeric;
  v_cash_payouts_existing numeric;
  v_cash_available numeric;
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

    select coalesce(sum(cp.amount) filter (where cp.payment_method = 'cash'), 0)
      into v_cash_received
    from public.comanda_pagamentos cp
    where cp.cash_session_id = p_cash_session_id and cp.tenant_id = v_target_tenant;

    select
      coalesce(sum(cm.amount) filter (where cm.type = 'suprimento'), 0),
      coalesce(sum(cm.amount) filter (where cm.type = 'sangria'), 0),
      coalesce(sum(cm.amount) filter (where cm.type = 'repasse_comissao' and cm.reversed_at is null), 0)
      into v_supplies, v_withdrawals, v_cash_payouts_existing
    from public.cash_movements cm
    where cm.cash_session_id = p_cash_session_id and cm.tenant_id = v_target_tenant;

    v_cash_available := round(
      v_cash_session.initial_amount + v_cash_received + v_supplies - v_withdrawals - v_cash_payouts_existing,
      2
    );

    if v_payout_amount > v_cash_available then
      raise exception 'O valor do repasse em dinheiro excede o saldo disponivel na gaveta do turno.' using errcode = 'P0001';
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
