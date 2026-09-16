-- Ticket 11: vincula novas quitacoes as obrigacoes sem perder o historico legado.
create table if not exists public.commission_payout_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payout_id uuid not null references public.commission_payouts(id) on delete restrict,
  obligation_id uuid not null references public.commission_obligations(id) on delete restrict,
  amount numeric not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint commission_payout_allocations_amount_check check (amount > 0),
  constraint commission_payout_allocations_unique unique (payout_id, obligation_id)
);

create index if not exists idx_commission_payout_allocations_tenant on public.commission_payout_allocations (tenant_id);
create index if not exists idx_commission_payout_allocations_payout on public.commission_payout_allocations (payout_id);
create index if not exists idx_commission_payout_allocations_obligation on public.commission_payout_allocations (obligation_id);

alter table public.commission_payout_allocations enable row level security;
drop policy if exists commission_payout_allocations_select_financial on public.commission_payout_allocations;
create policy commission_payout_allocations_select_financial
on public.commission_payout_allocations
for select
to authenticated
using (
  exists (
    select 1
    from public.commission_payouts cp
    join public.users u on u.id = auth.uid()
    where cp.id = commission_payout_allocations.payout_id
      and u.is_active = true
      and (
        (u.role in ('gerente', 'proprietario')
          and (u.role = 'proprietario' or u.tenant_id = commission_payout_allocations.tenant_id))
        or exists (
          select 1
          from public.professionals p
          where p.id = cp.professional_id
            and p.user_id = u.id
            and p.tenant_id = commission_payout_allocations.tenant_id
        )
      )
  )
);

revoke all on table public.commission_payout_allocations from public, anon;
grant select on table public.commission_payout_allocations to authenticated;

create or replace function public.register_commission_payout(
  p_professional_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_notes text default null,
  p_paid_at timestamp with time zone default timezone('utc'::text, now()),
  p_tenant_id uuid default null
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
  v_payout_id uuid;
  v_obligation record;
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

  -- Mantem a compatibilidade: itens sem obrigacao usam o calculo legado, sem
  -- competir com obrigacoes confirmadas ja estao no livro novo.
  with legacy_items as (
    select ci.total_price,
      case
        when ci.item_type in ('servico', 'service') or ci.service_id is not null then
          coalesce(ps.custom_commission_percentage, s.commission_percentage, prof.commission_percentage, 0)
        when ci.item_type in ('produto', 'product') or ci.product_id is not null then
          coalesce(prod.commission_percentage, 0)
        else 0
      end as commission_percentage
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
  select coalesce(sum(round(total_price * commission_percentage / 100, 2)), 0)
    into v_legacy_total_commission
  from legacy_items;

  select coalesce(sum(cp.amount), 0)
    into v_legacy_paid_commission
  from public.commission_payouts cp
  where cp.tenant_id = v_target_tenant
    and cp.professional_id = p_professional_id
    and not exists (
      select 1 from public.commission_payout_allocations a where a.payout_id = cp.id
    );

  v_legacy_open_amount := greatest(0, v_legacy_total_commission - v_legacy_paid_commission);
  if v_payout_amount > v_open_obligation_amount + v_legacy_open_amount then
    raise exception 'O valor informado excede o saldo pendente de comissao.' using errcode = 'P0001';
  end if;

  insert into public.commission_payouts (
    tenant_id, professional_id, amount, payment_method, notes, paid_at, created_by
  ) values (
    v_target_tenant, p_professional_id, v_payout_amount, v_payment_method,
    p_notes, coalesce(p_paid_at, timezone('utc'::text, now())), v_user_id
  ) returning id into v_payout_id;

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

  return jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'amount', v_payout_amount,
    'professional_id', p_professional_id,
    'allocated_amount', v_allocated_amount,
    'legacy_amount', greatest(0, v_payout_amount - v_allocated_amount)
  );
end;
$$;

revoke all on function public.register_commission_payout(uuid, numeric, text, text, timestamptz, uuid) from public, anon;
grant execute on function public.register_commission_payout(uuid, numeric, text, text, timestamptz, uuid) to authenticated;


