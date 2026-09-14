-- Ticket 06 da spec 036 (Contas a Pagar): tabela de Conta a Pagar avulsa, RPC de
-- criacao e RPC de leitura paginada.
-- Spec: specs/036-contas-a-pagar/spec.md, secoes "Entrega 2 -- Livro de Contas a
-- Pagar", "Interface" e "ADR e vocabulario".
--
-- Escopo estrito deste ticket: conta avulsa (Serie sempre nula), sem Baixa,
-- Estorno de Baixa, cancelamento, edicao, totais nem alerta -- tickets 07 a 09.
-- As colunas de Serie nascem aqui, sempre nulas, sem chave estrangeira ate o
-- ticket 11 criar a tabela de Serie.
--
-- Resolucao de tenant e revalidacao de papel seguem o mesmo padrao das RPCs de
-- Categoria de Despesa e Fornecedor (spec 035): parametro de tenant opcional,
-- recusado quando diverge do tenant do usuario e o usuario nao e 'proprietario'
-- (administrador do SaaS), ausente vale o tenant do usuario -- com a forma
-- segura "is distinct from" (nao "<>") na comparacao.
--
-- O dia de negocio corrente e calculado no servidor a partir de tenants.timezone,
-- no mesmo padrao ja usado pela migration 20260913170000 (Fluxo de Caixa
-- Projetado, ticket 01/037): "coalesce(timezone, 'America/Sao_Paulo')" e
-- "(now() at time zone v_timezone)::date". Nenhum contrato aceita "hoje" vindo
-- do navegador.

create table if not exists public.payables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  description text not null,
  category_id uuid not null,
  supplier_id uuid,
  amount numeric(12,2) not null,
  paid_amount numeric(12,2) not null default 0,
  status text not null default 'open',
  due_date date not null,
  competence_date date not null,
  document_number text,
  notes text,
  series_id uuid,
  series_position integer,
  created_at timestamptz not null default timezone('utc'::text, now()),
  created_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  updated_by uuid references public.users(id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references public.users(id) on delete set null,
  cancellation_reason text,
  constraint payables_description_length_check check (char_length(description) between 2 and 200),
  constraint payables_amount_check check (amount > 0),
  constraint payables_paid_amount_check check (paid_amount >= 0 and paid_amount <= amount),
  constraint payables_status_check check (status in ('open', 'partially_paid', 'paid', 'cancelled')),
  constraint payables_document_number_length_check
    check (document_number is null or char_length(document_number) <= 60),
  constraint payables_notes_length_check check (notes is null or char_length(notes) <= 500),
  constraint payables_series_consistency_check check ((series_id is null) = (series_position is null)),
  constraint payables_series_position_check check (series_position is null or series_position > 0),
  constraint payables_cancellation_trail_check
    check ((cancelled_at is null) = (cancelled_by is null) and (cancelled_at is null) = (cancellation_reason is null)),
  constraint payables_status_paid_amount_check check (
    (status = 'open' and paid_amount = 0 and cancelled_at is null)
    or (status = 'partially_paid' and paid_amount > 0 and paid_amount < amount and cancelled_at is null)
    or (status = 'paid' and paid_amount = amount and cancelled_at is null)
    or (status = 'cancelled' and paid_amount = 0 and cancelled_at is not null)
  )
);

comment on table public.payables is
  'Conta a Pagar (spec 036, ticket 06): livro separado dos movimentos de caixa. Escrita exclusiva por RPC; leitura por RPC paginada.';
comment on column public.payables.competence_date is
  'Data de competencia, gravada ja na criacao com o vencimento como valor inicial. Nao e consumida por nenhuma tela desta spec.';
comment on column public.payables.series_id is
  'Sempre nula neste ticket. A tabela de Serie e a chave estrangeira compasta so sao criadas no ticket 11/036.';
comment on column public.payables.series_position is
  'Sempre nula neste ticket, junto com series_id (ambas nulas ou ambas preenchidas).';

alter table public.payables
  add constraint payables_tenant_id_key unique (tenant_id, id);

alter table public.payables
  add constraint payables_category_fk
  foreign key (tenant_id, category_id)
  references public.financial_categories (tenant_id, id);

alter table public.payables
  add constraint payables_supplier_fk
  foreign key (tenant_id, supplier_id)
  references public.suppliers (tenant_id, id);

create index if not exists idx_payables_category_id on public.payables (category_id);
create index if not exists idx_payables_supplier_id on public.payables (supplier_id);
create index if not exists idx_payables_series_id on public.payables (series_id) where series_id is not null;
create index if not exists idx_payables_created_by on public.payables (created_by);
create index if not exists idx_payables_updated_by on public.payables (updated_by);
create index if not exists idx_payables_cancelled_by on public.payables (cancelled_by);

create index if not exists idx_payables_tenant_due_date
  on public.payables (tenant_id, due_date);

create index if not exists idx_payables_tenant_due_date_open
  on public.payables (tenant_id, due_date)
  where status in ('open', 'partially_paid');

revoke all on table public.payables from anon;
grant select on table public.payables to authenticated;
revoke insert, update, delete on table public.payables from authenticated;

alter table public.payables enable row level security;

drop policy if exists payables_select_policy on public.payables;
create policy payables_select_policy
  on public.payables for select to authenticated
  using (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) in ('gerente', 'proprietario')
    )
  );

-- -----------------------------------------------------------------------------
-- create_payable: cria Conta a Pagar avulsa (Serie sempre nula).
-- -----------------------------------------------------------------------------
create or replace function public.create_payable(
  p_description text,
  p_category_id uuid,
  p_amount numeric,
  p_due_date date,
  p_supplier_id uuid default null,
  p_competence_date date default null,
  p_document_number text default null,
  p_notes text default null,
  p_tenant_id uuid default null
)
returns public.payables
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_description text;
  v_amount numeric(12,2);
  v_document_number text;
  v_notes text;
  v_category_active boolean;
  v_supplier_active boolean;
  v_payable public.payables%rowtype;
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
    raise exception 'Acesso negado para gerenciar Contas a Pagar.' using errcode = '42501';
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

  v_description := regexp_replace(btrim(coalesce(p_description, '')), '\s+', ' ', 'g');
  if char_length(v_description) < 2 or char_length(v_description) > 200 then
    raise exception 'A descrição deve ter entre 2 e 200 caracteres.' using errcode = '22023';
  end if;

  if p_amount is null then
    raise exception 'Valor é obrigatório.' using errcode = '22023';
  end if;
  v_amount := round(p_amount::numeric, 2);
  if v_amount <= 0 then
    raise exception 'O valor deve ser maior que zero.' using errcode = '22023';
  end if;

  if p_due_date is null then
    raise exception 'Vencimento é obrigatório.' using errcode = '22023';
  end if;

  if p_category_id is null then
    raise exception 'Categoria de despesa é obrigatória.' using errcode = '22023';
  end if;

  select archived_at is null
    into v_category_active
  from public.financial_categories
  where id = p_category_id
    and tenant_id = v_target_tenant
    and nature = 'expense';

  if not found or not v_category_active then
    raise exception 'Categoria de despesa informada não existe ou está arquivada.' using errcode = '22023';
  end if;

  if p_supplier_id is not null then
    select archived_at is null
      into v_supplier_active
    from public.suppliers
    where id = p_supplier_id
      and tenant_id = v_target_tenant;

    if not found or not v_supplier_active then
      raise exception 'Fornecedor informado não existe ou está arquivado.' using errcode = '22023';
    end if;
  end if;

  v_document_number := nullif(btrim(coalesce(p_document_number, '')), '');
  if v_document_number is not null and char_length(v_document_number) > 60 then
    raise exception 'Número do documento deve ter no máximo 60 caracteres.' using errcode = '22023';
  end if;

  v_notes := nullif(btrim(coalesce(p_notes, '')), '');
  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'Observação deve ter no máximo 500 caracteres.' using errcode = '22023';
  end if;

  insert into public.payables (
    tenant_id, description, category_id, supplier_id, amount, due_date, competence_date,
    document_number, notes, created_by
  ) values (
    v_target_tenant, v_description, p_category_id, p_supplier_id, v_amount, p_due_date,
    coalesce(p_competence_date, p_due_date), v_document_number, v_notes, v_user_id
  ) returning * into v_payable;

  return v_payable;
end;
$function$;

comment on function public.create_payable(text, uuid, numeric, date, uuid, date, text, text, uuid) is
  'Ticket 06/036: cria Conta a Pagar avulsa (Série sempre nula). Categoria ativa obrigatória, Fornecedor ativo opcional. Competência nasce igual ao vencimento quando não informada.';

revoke all on function public.create_payable(text, uuid, numeric, date, uuid, date, text, text, uuid) from public, anon;
grant execute on function public.create_payable(text, uuid, numeric, date, uuid, date, text, text, uuid) to authenticated;
grant execute on function public.create_payable(text, uuid, numeric, date, uuid, date, text, text, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- list_payables: leitura paginada da lista de Contas a Pagar, com situacao
-- derivada, faixa de destaque e saldo restante calculados no servidor.
-- -----------------------------------------------------------------------------
create or replace function public.list_payables(
  p_due_date_from date default null,
  p_due_date_to date default null,
  p_status text default 'not_cancelled',
  p_page integer default 1,
  p_page_size integer default 20,
  p_tenant_id uuid default null
)
returns table (
  id uuid,
  description text,
  category_id uuid,
  category_name text,
  category_archived boolean,
  supplier_id uuid,
  supplier_name text,
  supplier_archived boolean,
  amount numeric,
  paid_amount numeric,
  remaining_amount numeric,
  status text,
  situation text,
  highlight text,
  due_date date,
  competence_date date,
  document_number text,
  notes text,
  series_id uuid,
  series_position integer,
  created_at timestamptz,
  total_count bigint
)
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
  v_page integer;
  v_page_size integer;
  v_offset integer;
  v_status text;
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
    raise exception 'Acesso negado para consultar Contas a Pagar.' using errcode = '42501';
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

  select coalesce(t.timezone, 'America/Sao_Paulo')
    into v_timezone
  from public.tenants t
  where t.id = v_target_tenant;

  if v_timezone is null then
    raise exception 'Unidade não encontrada.' using errcode = '22023';
  end if;

  v_today := (now() at time zone v_timezone)::date;

  v_status := coalesce(p_status, 'not_cancelled');
  if v_status not in ('not_cancelled', 'open', 'overdue', 'paid', 'cancelled') then
    raise exception 'Estado de filtro inválido.' using errcode = '22023';
  end if;

  v_page := greatest(coalesce(p_page, 1), 1);
  v_page_size := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_offset := (v_page - 1) * v_page_size;

  return query
  with base as (
    select
      p.id,
      p.description,
      p.category_id,
      fc.name as category_name,
      fc.archived_at is not null as category_archived,
      p.supplier_id,
      s.name as supplier_name,
      s.archived_at is not null as supplier_archived,
      p.amount,
      p.paid_amount,
      (p.amount - p.paid_amount) as remaining_amount,
      p.status,
      case
        when p.status in ('open', 'partially_paid') and p.due_date < v_today then 'overdue'
        else p.status
      end as situation,
      case
        when p.status not in ('open', 'partially_paid') then null
        when p.due_date < v_today then 'overdue'
        when p.due_date = v_today then 'due_today'
        when p.due_date <= v_today + 7 then 'due_soon'
        else null
      end as highlight,
      p.due_date,
      p.competence_date,
      p.document_number,
      p.notes,
      p.series_id,
      p.series_position,
      p.created_at
    from public.payables p
    join public.financial_categories fc
      on fc.tenant_id = p.tenant_id and fc.id = p.category_id
    left join public.suppliers s
      on s.tenant_id = p.tenant_id and s.id = p.supplier_id
    where p.tenant_id = v_target_tenant
      and (p_due_date_from is null or p.due_date >= p_due_date_from)
      and (p_due_date_to is null or p.due_date <= p_due_date_to)
      and (
        (v_status = 'not_cancelled' and p.status <> 'cancelled')
        or (v_status = 'open' and p.status in ('open', 'partially_paid'))
        or (v_status = 'overdue' and p.status in ('open', 'partially_paid') and p.due_date < v_today)
        or (v_status = 'paid' and p.status = 'paid')
        or (v_status = 'cancelled' and p.status = 'cancelled')
      )
  )
  select
    base.id, base.description, base.category_id, base.category_name, base.category_archived,
    base.supplier_id, base.supplier_name, base.supplier_archived,
    base.amount, base.paid_amount, base.remaining_amount, base.status, base.situation, base.highlight,
    base.due_date, base.competence_date, base.document_number, base.notes,
    base.series_id, base.series_position, base.created_at,
    count(*) over ()::bigint as total_count
  from base
  order by base.due_date asc, base.id asc
  limit v_page_size offset v_offset;
end;
$function$;

comment on function public.list_payables(date, date, text, integer, integer, uuid) is
  'Ticket 06/036: lista paginada de Contas a Pagar. Situação derivada e faixa de destaque calculadas a partir do dia de negócio do tenant, nunca do navegador.';

revoke all on function public.list_payables(date, date, text, integer, integer, uuid) from public, anon;
grant execute on function public.list_payables(date, date, text, integer, integer, uuid) to authenticated;
grant execute on function public.list_payables(date, date, text, integer, integer, uuid) to service_role;
