-- Ticket 03 da spec 035 (Plano de Contas): tabela de Categorias Financeiras,
-- catorze Categorias de Despesa padrao semeadas por gatilho + backfill.
-- Spec: specs/035-plano-de-contas-categorias-e-fornecedores/spec.md, secoes
-- "Entrega 2 -- Categorias de Despesa", "Integridade entre tenants por chave
-- composta", "Acesso" e "Indices".
--
-- Escopo estrito deste ticket: schema, semeadura/backfill e leitura por RLS.
-- Escrita por RPC (criar, renomear, arquivar, reativar) e o ticket 04.

create table if not exists public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nature text not null,
  name text not null,
  seed_key text,
  archived_at timestamptz,
  archived_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  created_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  updated_by uuid references public.users(id) on delete set null,
  constraint financial_categories_nature_check check (nature in ('expense')),
  constraint financial_categories_name_length_check
    check (char_length(name) between 2 and 60),
  constraint financial_categories_archived_consistency_check
    check ((archived_at is null) = (archived_by is null))
);

comment on table public.financial_categories is
  'Categorias financeiras planas do tenant. Nesta spec (035), so nature = expense. Escrita exclusiva por RPC (ticket 04); leitura por tabela com RLS.';
comment on column public.financial_categories.seed_key is
  'Chave estavel da categoria padrao semeada. Nula para categoria criada pelo gestor. Base da idempotencia da semeadura, independente de renomeacao.';

alter table public.financial_categories
  add constraint financial_categories_tenant_id_key unique (tenant_id, id);

create unique index if not exists idx_financial_categories_tenant_nature_lower_name
  on public.financial_categories (tenant_id, nature, lower(name));

create unique index if not exists idx_financial_categories_tenant_seed_key
  on public.financial_categories (tenant_id, seed_key)
  where seed_key is not null;

create index if not exists idx_financial_categories_created_by
  on public.financial_categories (created_by);
create index if not exists idx_financial_categories_updated_by
  on public.financial_categories (updated_by);
create index if not exists idx_financial_categories_archived_by
  on public.financial_categories (archived_by);

revoke all on table public.financial_categories from anon;
grant select on table public.financial_categories to authenticated;
revoke insert, update, delete on table public.financial_categories from authenticated;

alter table public.financial_categories enable row level security;

drop policy if exists financial_categories_select_policy on public.financial_categories;
create policy financial_categories_select_policy
  on public.financial_categories for select to authenticated
  using (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) in ('gerente', 'proprietario')
    )
  );

create or replace function private.seed_default_expense_categories(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_tenant_id is null then
    return;
  end if;

  insert into public.financial_categories (tenant_id, nature, name, seed_key, created_by)
  values
    (p_tenant_id, 'expense', 'Aluguel e condomínio', 'aluguel_condominio', null),
    (p_tenant_id, 'expense', 'Energia', 'energia', null),
    (p_tenant_id, 'expense', 'Água', 'agua', null),
    (p_tenant_id, 'expense', 'Internet e telefone', 'internet_telefone', null),
    (p_tenant_id, 'expense', 'Produtos para revenda', 'produtos_revenda', null),
    (p_tenant_id, 'expense', 'Insumos de bancada', 'insumos_bancada', null),
    (p_tenant_id, 'expense', 'Manutenção e reparos', 'manutencao_reparos', null),
    (p_tenant_id, 'expense', 'Marketing', 'marketing', null),
    (p_tenant_id, 'expense', 'Impostos e taxas', 'impostos_taxas', null),
    (p_tenant_id, 'expense', 'Contabilidade', 'contabilidade', null),
    (p_tenant_id, 'expense', 'Software e assinaturas', 'software_assinaturas', null),
    (p_tenant_id, 'expense', 'Salários e encargos', 'salarios_encargos', null),
    (p_tenant_id, 'expense', 'Pró-labore', 'pro_labore', null),
    (p_tenant_id, 'expense', 'Outras despesas', 'outras_despesas', null)
  on conflict do nothing;
end;
$function$;

comment on function private.seed_default_expense_categories(uuid) is
  'Insere as catorze Categorias de Despesa padrao para o tenant, ignorando conflito de chave estavel ou de nome. Idempotente. Spec 035, ticket 03.';

revoke all on function private.seed_default_expense_categories(uuid) from public, anon, authenticated;
grant execute on function private.seed_default_expense_categories(uuid) to service_role;

create or replace function private.seed_default_expense_categories_on_tenant_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.seed_default_expense_categories(new.id);
  return new;
end;
$function$;

drop trigger if exists trg_seed_default_expense_categories on public.tenants;
create trigger trg_seed_default_expense_categories
after insert on public.tenants
for each row
execute function private.seed_default_expense_categories_on_tenant_insert();

revoke all on function private.seed_default_expense_categories_on_tenant_insert() from public, anon, authenticated;

do $backfill$
declare
  v_tenant record;
begin
  for v_tenant in select id from public.tenants loop
    perform private.seed_default_expense_categories(v_tenant.id);
  end loop;
end;
$backfill$;
