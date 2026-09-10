-- Ticket 10: livro de obrigaes de comisso por item fechado.
create table if not exists public.commission_obligations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete restrict,
  comanda_id uuid not null references public.comandas(id) on delete restrict,
  comanda_item_id uuid references public.comanda_itens(id) on delete set null,
  amount numeric not null,
  settled_amount numeric not null default 0,
  status text not null default 'open',
  commission_rule text not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  reversed_at timestamptz,
  reversed_by uuid references public.users(id) on delete set null,
  reversal_reason text,
  constraint commission_obligations_amount_check check (amount > 0),
  constraint commission_obligations_settled_amount_check check (settled_amount >= 0 and settled_amount <= amount),
  constraint commission_obligations_status_check check (status in ('open', 'partially_paid', 'paid', 'reversed')),
  constraint commission_obligations_rule_check check (
    commission_rule in ('professional_service', 'service', 'professional', 'product')
  ),
  constraint commission_obligations_item_unique unique (comanda_item_id)
);

create index if not exists idx_commission_obligations_tenant_prof_status
  on public.commission_obligations (tenant_id, professional_id, status);
create index if not exists idx_commission_obligations_tenant_created_at
  on public.commission_obligations (tenant_id, created_at);
create index if not exists idx_commission_obligations_comanda
  on public.commission_obligations (comanda_id);

alter table public.commission_obligations enable row level security;

drop policy if exists commission_obligations_select_financial on public.commission_obligations;
create policy commission_obligations_select_financial
on public.commission_obligations
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.is_active = true
      and (
        (u.role in ('gerente', 'proprietario')
          and (u.role = 'proprietario' or u.tenant_id = commission_obligations.tenant_id))
        or exists (
          select 1
          from public.professionals p
          where p.id = commission_obligations.professional_id
            and p.user_id = u.id
            and p.tenant_id = commission_obligations.tenant_id
        )
      )
  )
);

revoke all on table public.commission_obligations from anon;
grant select on table public.commission_obligations to authenticated;

-- O trigger roda dentro da mesma transao do fechamento e  idempotente por item.
create or replace function public.create_commission_obligations_from_closed_comanda()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
begin
  if new.status = 'fechada' and old.status is distinct from new.status then
    insert into public.commission_obligations (
      tenant_id,
      professional_id,
      comanda_id,
      comanda_item_id,
      amount,
      settled_amount,
      status,
      commission_rule,
      created_by
    )
    select
      new.tenant_id,
      ci.professional_id,
      new.id,
      ci.id,
      ci.snapshot_commission_amount,
      0,
      'open',
      ci.snapshot_commission_rule,
      (select auth.uid())
    from public.comanda_itens ci
    where ci.comanda_id = new.id
      and ci.tenant_id = new.tenant_id
      and ci.snapshot_status = 'confirmed'
      and ci.professional_id is not null
      and ci.snapshot_commission_amount > 0
      and ci.snapshot_commission_rule in ('professional_service', 'service', 'professional', 'product')
    on conflict (comanda_item_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_create_commission_obligations on public.comandas;
create trigger trg_create_commission_obligations
after update of status on public.comandas
for each row
when (new.status = 'fechada' and old.status is distinct from new.status)
execute function public.create_commission_obligations_from_closed_comanda();

revoke all on function public.create_commission_obligations_from_closed_comanda() from public, anon, authenticated;


