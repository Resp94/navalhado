-- Ticket 06 da spec 034: abate de vale na Quitacao de Comissao.
--
-- register_commission_payout ganha dois parametros de uma vez -- debitos a abater
-- (vale) e creditos a pagar (gorjeta, ticket 07) -- para pagar o custo de derrubar a
-- assinatura e refazer os privilegios uma unica vez, como o proprio repositorio ja
-- fez ao remover o overload legado da mesma funcao. O parametro de credito e
-- recusado com erro explicito ate o ticket 07 libera-lo.
--
-- Semantica do abate: p_amount continua sendo o valor efetivamente desembolsado
-- (o que muda de mao); p_advance_amount e quanto do vale em aberto do profissional
-- e simultaneamente quitado por compensacao contabil, sem gerar cash_movement
-- proprio (o vale ja gerou sua propria saida de gaveta quando foi lancado, no
-- ticket 05; abater nao move dinheiro de novo). As obrigacoes de comissao sao
-- entao alocadas pelo total reconciliado (p_amount + p_advance_amount), pois a
-- comissao inteira foi quitada -- parte em dinheiro/pix, parte em compensacao.
--
-- Ordem de lock fixa: toda trava em commission_obligations (dois loops, soma e
-- alocacao) precede qualquer trava em professional_account_entries (um loop,
-- soma sem trava + alocacao com trava), para que duas quitacoes concorrentes
-- nunca se travem em ordem invertida.

-- -----------------------------------------------------------------------------
-- 1. commission_payouts ganha a mesma trilha de valor abatido que ja tem para o
--    valor legado (legacy_allocated_amount).
-- -----------------------------------------------------------------------------
alter table public.commission_payouts
  add column if not exists advance_amount numeric(10,2) not null default 0
    constraint commission_payouts_advance_amount_check check (advance_amount >= 0);

-- -----------------------------------------------------------------------------
-- 2. professional_advance_allocations: rateio entre quitacao e lancamento,
--    espelhando commission_payout_allocations (quitacao <-> obrigacao).
-- -----------------------------------------------------------------------------
create table if not exists public.professional_advance_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payout_id uuid not null references public.commission_payouts(id) on delete restrict,
  entry_id uuid not null references public.professional_account_entries(id) on delete restrict,
  amount numeric(10,2) not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint professional_advance_allocations_amount_check check (amount > 0),
  constraint professional_advance_allocations_unique unique (payout_id, entry_id)
);

create index if not exists idx_professional_advance_allocations_tenant on public.professional_advance_allocations (tenant_id);
create index if not exists idx_professional_advance_allocations_payout on public.professional_advance_allocations (payout_id);
create index if not exists idx_professional_advance_allocations_entry on public.professional_advance_allocations (entry_id);

alter table public.professional_advance_allocations enable row level security;

drop policy if exists professional_advance_allocations_select_financial on public.professional_advance_allocations;
create policy professional_advance_allocations_select_financial
  on public.professional_advance_allocations for select to authenticated
  using (
    (select private.is_saas_admin())
    or exists (
      select 1
      from public.commission_payouts cp
      where cp.id = professional_advance_allocations.payout_id
        and cp.tenant_id = (select private.get_auth_tenant_id())
        and (
          (select private.get_auth_role()) in ('gerente', 'proprietario')
          or (
            (select private.get_auth_role()) = 'barbeiro'
            and (select private.is_own_professional(cp.professional_id))
          )
        )
    )
  );

revoke all on table public.professional_advance_allocations from public, anon;
grant select on table public.professional_advance_allocations to authenticated;
revoke insert, update, delete on table public.professional_advance_allocations from authenticated;

-- -----------------------------------------------------------------------------
-- 3. get_professional_commission_balance: estendido (create or replace, mesma
--    assinatura, mesmo retorno jsonb) para expor o saldo da Conta do Profissional
--    e o liquido sugerido. O liquido exibido e o liquido liquidado passam a vir
--    da mesma origem: o front nunca soma coisas de fontes diferentes.
--
--    Neste ticket, credits_open_amount ja e exposto (gorjeta, ticket 04) mas
--    ainda NAO entra no liquido sugerido -- pagar credito so e possivel a partir
--    do ticket 07. suggested_net_amount = comissao aberta menos vale aberto.
-- -----------------------------------------------------------------------------
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
  v_advances_open_amount numeric := 0;
  v_credits_open_amount numeric := 0;
  v_suggested_net_amount numeric := 0;
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

  select
    coalesce(sum(e.amount - e.settled_amount) filter (where e.entry_type = 'vale'), 0),
    coalesce(sum(e.amount - e.settled_amount) filter (where e.entry_type = 'gorjeta'), 0)
    into v_advances_open_amount, v_credits_open_amount
  from public.professional_account_entries e
  where e.tenant_id = v_target_tenant
    and e.professional_id = p_professional_id
    and e.status in ('open', 'partially_paid');

  v_suggested_net_amount := round(
    greatest(0, (v_open_ledger + greatest(0, v_legacy_generated - v_legacy_paid)) - v_advances_open_amount),
    2
  );

  return jsonb_build_object(
    'current_open_balance', v_open_ledger + greatest(0, v_legacy_generated - v_legacy_paid),
    'generated_commission', v_generated_ledger + v_legacy_generated_period,
    'paid_commission', v_paid_period,
    'advances_open_amount', round(v_advances_open_amount, 2),
    'credits_open_amount', round(v_credits_open_amount, 2),
    'suggested_net_amount', v_suggested_net_amount
  );
end;
$function$;

-- -----------------------------------------------------------------------------
-- 4. register_commission_payout: abate de vale (debito) na mesma transacao da
--    quitacao. Parametro de credito existe e e recusado ate o ticket 07.
-- -----------------------------------------------------------------------------
drop function if exists public.register_commission_payout(uuid, numeric, text, text, timestamp with time zone, uuid, uuid);

create function public.register_commission_payout(
  p_professional_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_notes text default null,
  p_paid_at timestamp with time zone default timezone('utc'::text, now()),
  p_tenant_id uuid default null,
  p_cash_session_id uuid default null,
  p_advance_amount numeric default 0,
  p_credit_amount numeric default 0
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
  v_advance_amount numeric := 0;
  v_credit_amount numeric := 0;
  v_open_obligation_amount numeric := 0;
  v_advances_open_amount numeric := 0;
  v_legacy_total_commission numeric := 0;
  v_legacy_paid_commission numeric := 0;
  v_legacy_open_amount numeric := 0;
  v_remaining numeric;
  v_allocation numeric;
  v_allocated_amount numeric := 0;
  v_legacy_allocated_amount numeric := 0;
  v_advance_remaining numeric;
  v_advance_allocation numeric;
  v_advance_allocated_amount numeric := 0;
  v_payout_id uuid;
  v_obligation record;
  v_advance record;
  v_cash_session public.cash_sessions%rowtype;
  v_cash_received numeric;
  v_supplies numeric;
  v_withdrawals numeric;
  v_cash_payouts_existing numeric;
  v_advances_existing numeric;
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

  v_credit_amount := round(coalesce(p_credit_amount, 0), 2);
  if v_credit_amount <> 0 then
    raise exception 'Pagamento de credito de gorjeta ainda nao esta disponivel.' using errcode = 'P0001';
  end if;

  if p_advance_amount is not null and p_advance_amount < 0 then
    raise exception 'O valor do abate nao pode ser negativo.' using errcode = '22023';
  end if;
  v_advance_amount := round(coalesce(p_advance_amount, 0), 2);

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

  -- Ordem de lock fixa: toda trava em commission_obligations (aqui e mais abaixo)
  -- precede qualquer trava em professional_account_entries (so mais abaixo, apos
  -- as duas travas de obrigacoes).
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

  -- Leitura sem trava: a trava real do abate acontece so no loop de alocacao,
  -- depois das duas travas de commission_obligations.
  select coalesce(sum(e.amount - e.settled_amount), 0)
    into v_advances_open_amount
  from public.professional_account_entries e
  where e.tenant_id = v_target_tenant
    and e.professional_id = p_professional_id
    and e.entry_type = 'vale'
    and e.status in ('open', 'partially_paid');

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
  if v_payout_amount + v_advance_amount > v_open_obligation_amount + v_legacy_open_amount then
    raise exception 'O valor informado excede o saldo pendente de comissao.' using errcode = 'P0001';
  end if;
  if v_advance_amount > v_advances_open_amount then
    raise exception 'O valor do abate excede o saldo de vales em aberto do profissional.' using errcode = 'P0001';
  end if;

  insert into public.commission_payouts (
    tenant_id, professional_id, amount, payment_method, notes, paid_at, created_by, cash_session_id, advance_amount
  ) values (
    v_target_tenant, p_professional_id, v_payout_amount, v_payment_method,
    p_notes, coalesce(p_paid_at, timezone('utc'::text, now())), v_user_id, p_cash_session_id, v_advance_amount
  ) returning id into v_payout_id;

  if v_payment_method = 'cash' then
    insert into public.cash_movements (
      tenant_id, cash_session_id, type, amount, reason, performed_by, payout_id
    ) values (
      v_target_tenant, p_cash_session_id, 'repasse_comissao', v_payout_amount,
      coalesce(nullif(btrim(p_notes), ''), 'Repasse de comissao'), v_user_id, v_payout_id
    );
  end if;

  -- Financiado pelo total reconciliado (dinheiro/pix + abate): a comissao inteira
  -- e considerada quitada, parte em especie, parte por compensacao do vale.
  v_remaining := v_payout_amount + v_advance_amount;
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

  -- "Legado" refere-se apenas ao dinheiro efetivamente desembolsado (v_payout_amount);
  -- o abate nao produz sobra legada -- por isso o teto em least(...).
  v_legacy_allocated_amount := greatest(0, v_payout_amount - least(v_allocated_amount, v_payout_amount));
  update public.commission_payouts
  set legacy_allocated_amount = v_legacy_allocated_amount
  where id = v_payout_id;

  -- Unica trava em professional_account_entries desta funcao, sempre depois das
  -- duas travas de commission_obligations acima.
  v_advance_remaining := v_advance_amount;
  for v_advance in
    select e.id, e.amount, e.settled_amount
    from public.professional_account_entries e
    where e.tenant_id = v_target_tenant
      and e.professional_id = p_professional_id
      and e.entry_type = 'vale'
      and e.status in ('open', 'partially_paid')
      and e.settled_amount < e.amount
    order by e.created_at, e.id
    for update
  loop
    exit when v_advance_remaining <= 0;
    v_advance_allocation := least(v_advance_remaining, v_advance.amount - v_advance.settled_amount);
    if v_advance_allocation <= 0 then
      continue;
    end if;

    insert into public.professional_advance_allocations (
      tenant_id, payout_id, entry_id, amount
    ) values (
      v_target_tenant, v_payout_id, v_advance.id, v_advance_allocation
    );

    update public.professional_account_entries
    set settled_amount = settled_amount + v_advance_allocation,
        status = case
          when settled_amount + v_advance_allocation >= amount then 'settled'
          else 'partially_paid'
        end
    where id = v_advance.id;

    v_advance_remaining := v_advance_remaining - v_advance_allocation;
    v_advance_allocated_amount := v_advance_allocated_amount + v_advance_allocation;
  end loop;

  return jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'amount', v_payout_amount,
    'professional_id', p_professional_id,
    'allocated_amount', v_allocated_amount,
    'legacy_amount', v_legacy_allocated_amount,
    'cash_session_id', p_cash_session_id,
    'advance_amount', v_advance_amount,
    'advance_allocated_amount', v_advance_allocated_amount
  );
end;
$function$;

revoke all on function public.register_commission_payout(uuid, numeric, text, text, timestamp with time zone, uuid, uuid, numeric, numeric) from public, anon;
grant execute on function public.register_commission_payout(uuid, numeric, text, text, timestamp with time zone, uuid, uuid, numeric, numeric) to authenticated;
grant execute on function public.register_commission_payout(uuid, numeric, text, text, timestamp with time zone, uuid, uuid, numeric, numeric) to service_role;

-- -----------------------------------------------------------------------------
-- 5. reverse_commission_payout: devolve tambem os lancamentos de vale abatidos
--    ao estado aberto, no mesmo padrao ja aplicado a commission_obligations.
--    Assinatura inalterada (nao precisa dos novos parametros): a reversao
--    localiza tudo pelo payout_id, ja disponivel em ambas as tabelas de rateio.
-- -----------------------------------------------------------------------------
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
  v_advance_allocation record;
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

  -- Ordem de lock fixa: obrigacoes de comissao antes de lancamentos da Conta do
  -- Profissional (mesma ordem que register_commission_payout).
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

  for v_advance_allocation in
    select a.id, a.entry_id, a.amount
    from public.professional_advance_allocations a
    where a.payout_id = p_payout_id
    for update
  loop
    update public.professional_account_entries e
    set settled_amount = greatest(0, e.settled_amount - v_advance_allocation.amount),
        status = case
          when greatest(0, e.settled_amount - v_advance_allocation.amount) <= 0 then 'open'
          when greatest(0, e.settled_amount - v_advance_allocation.amount) < e.amount then 'partially_paid'
          else 'settled'
        end
    where e.id = v_advance_allocation.entry_id
      and e.status <> 'reversed';
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
