-- Ticket 06 da spec 035 (Plano de Contas): tabela e RPCs de Fornecedor --
-- criar, atualizar, arquivar, reativar.
-- Spec: specs/035-plano-de-contas-categorias-e-fornecedores/spec.md, secoes
-- "Entrega 2 -- Fornecedores", "Integridade entre tenants por chave
-- composta", "Escrita por RPC, leitura por tabela", "Acesso" e "Indices".
--
-- Mesmo padrao das Categorias de Despesa (ticket 04, migration 140000):
-- resolucao de tenant e revalidacao de papel identicas a
-- register_commission_payout/get_professional_commission_balance, com a
-- forma segura "is distinct from" (nao "<>") na comparacao de tenant -- a
-- migration 140000 nasceu com "<>" e foi corrigida depois; esta ja nasce
-- certa. Conflito de nome OU documento leva SQLSTATE 23505 com detail JSON
-- (existing_id, existing_name, archived), lido pelo mesmo
-- SupabasePlanoContasAdapter.traduzirErro que ja serve Categoria de Despesa.
--
-- Documento: a restricao de verificacao usa private.is_valid_br_document
-- (ticket 05) -- documento invalido e recusado mesmo em escrita direta como
-- superusuario. Nome e documento sao unicos por tenant, incluindo
-- arquivados, na mesma regra das categorias.
--
-- Categoria padrao: chave estrangeira composta (tenant_id, default_category_id)
-- para financial_categories (tenant_id, id) -- a integridade entre tenants
-- fica no schema, nao so na RPC. Na criacao, so aceita categoria ATIVA do
-- mesmo tenant. Na atualizacao, uma categoria padrao ja definida que foi
-- arquivada depois continua aceita SE NAO MUDOU -- so uma categoria nova
-- (ou removida) passa pela checagem de ativa.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  document text,
  phone text,
  email text,
  notes text,
  default_category_id uuid,
  archived_at timestamptz,
  archived_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  created_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  updated_by uuid references public.users(id) on delete set null,
  constraint suppliers_name_length_check check (char_length(name) between 2 and 120),
  constraint suppliers_document_check
    check (document is null or private.is_valid_br_document(document)),
  constraint suppliers_phone_check
    check (phone is null or phone ~ '^[0-9]{10,11}$'),
  constraint suppliers_email_check
    check (email is null or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint suppliers_notes_length_check check (notes is null or char_length(notes) <= 500),
  constraint suppliers_archived_consistency_check
    check ((archived_at is null) = (archived_by is null))
);

comment on table public.suppliers is
  'Fornecedores do tenant: quem recebe pagamentos da barbearia (spec 035, ticket 06). Escrita exclusiva por RPC; leitura por tabela com RLS.';
comment on column public.suppliers.document is
  'CPF ou CNPJ sem mascara, validado por private.is_valid_br_document. Opcional: dois fornecedores sem documento nao colidem.';
comment on column public.suppliers.default_category_id is
  'Categoria de Despesa padrao, referenciada por chave composta (tenant_id, default_category_id). So pre-preenche a Conta a Pagar (spec 036) se estiver ativa.';

alter table public.suppliers
  add constraint suppliers_tenant_id_key unique (tenant_id, id);

alter table public.suppliers
  add constraint suppliers_default_category_fk
  foreign key (tenant_id, default_category_id)
  references public.financial_categories (tenant_id, id)
  on delete set null;

create unique index if not exists idx_suppliers_tenant_lower_name
  on public.suppliers (tenant_id, lower(name));

create unique index if not exists idx_suppliers_tenant_document
  on public.suppliers (tenant_id, document)
  where document is not null;

create index if not exists idx_suppliers_tenant_default_category
  on public.suppliers (tenant_id, default_category_id);

create index if not exists idx_suppliers_created_by
  on public.suppliers (created_by);
create index if not exists idx_suppliers_updated_by
  on public.suppliers (updated_by);
create index if not exists idx_suppliers_archived_by
  on public.suppliers (archived_by);

revoke all on table public.suppliers from anon;
grant select on table public.suppliers to authenticated;
revoke insert, update, delete on table public.suppliers from authenticated;

alter table public.suppliers enable row level security;

drop policy if exists suppliers_select_policy on public.suppliers;
create policy suppliers_select_policy
  on public.suppliers for select to authenticated
  using (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) in ('gerente', 'proprietario')
    )
  );

-- -----------------------------------------------------------------------------
-- create_supplier
-- -----------------------------------------------------------------------------
create or replace function public.create_supplier(
  p_name text,
  p_document text default null,
  p_phone text default null,
  p_email text default null,
  p_notes text default null,
  p_default_category_id uuid default null,
  p_tenant_id uuid default null
)
returns public.suppliers
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_name text;
  v_document text;
  v_phone text;
  v_email text;
  v_notes text;
  v_category_active boolean;
  v_existing_id uuid;
  v_existing_name text;
  v_existing_archived_at timestamptz;
  v_supplier public.suppliers%rowtype;
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
    raise exception 'Acesso negado para gerenciar o Plano de Contas.' using errcode = '42501';
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

  v_name := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'O nome do fornecedor deve ter entre 2 e 120 caracteres.' using errcode = '22023';
  end if;

  v_document := nullif(upper(regexp_replace(coalesce(p_document, ''), '[^0-9A-Za-z]', '', 'g')), '');
  if v_document is not null and not private.is_valid_br_document(v_document) then
    raise exception 'CPF ou CNPJ inválido.' using errcode = '22023';
  end if;

  v_phone := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
  if v_phone is not null and v_phone !~ '^[0-9]{10,11}$' then
    raise exception 'Telefone deve ter 10 ou 11 dígitos.' using errcode = '22023';
  end if;

  v_email := nullif(lower(btrim(coalesce(p_email, ''))), '');
  if v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'E-mail inválido.' using errcode = '22023';
  end if;

  v_notes := nullif(btrim(coalesce(p_notes, '')), '');
  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'Observação deve ter no máximo 500 caracteres.' using errcode = '22023';
  end if;

  if p_default_category_id is not null then
    select archived_at is null
      into v_category_active
    from public.financial_categories
    where id = p_default_category_id
      and tenant_id = v_target_tenant
      and nature = 'expense';

    if not found or not v_category_active then
      raise exception 'Categoria de despesa padrão informada não existe ou está arquivada.' using errcode = '22023';
    end if;
  end if;

  -- Checagem explicita de nome, depois de documento: relatada como conflito
  -- de nome quando os dois colidem (o nome e o campo sempre preenchido).
  select id, name, archived_at
    into v_existing_id, v_existing_name, v_existing_archived_at
  from public.suppliers
  where tenant_id = v_target_tenant
    and lower(name) = lower(v_name);

  if found then
    raise exception 'Já existe um fornecedor com este nome.' using
      errcode = '23505',
      detail = jsonb_build_object(
        'existing_id', v_existing_id,
        'existing_name', v_existing_name,
        'archived', v_existing_archived_at is not null
      )::text;
  end if;

  if v_document is not null then
    select id, name, archived_at
      into v_existing_id, v_existing_name, v_existing_archived_at
    from public.suppliers
    where tenant_id = v_target_tenant
      and document = v_document;

    if found then
      raise exception 'Já existe um fornecedor com este documento.' using
        errcode = '23505',
        detail = jsonb_build_object(
          'existing_id', v_existing_id,
          'existing_name', v_existing_name,
          'archived', v_existing_archived_at is not null
        )::text;
    end if;
  end if;

  begin
    insert into public.suppliers (
      tenant_id, name, document, phone, email, notes, default_category_id, created_by
    ) values (
      v_target_tenant, v_name, v_document, v_phone, v_email, v_notes, p_default_category_id, v_user_id
    ) returning * into v_supplier;
  exception when unique_violation then
    -- Corrida contra as checagens explicitas acima: outra sessao criou o
    -- mesmo nome ou documento entre elas e este INSERT. Mesmo formato de
    -- erro, reconferindo nome primeiro e depois documento.
    select id, name, archived_at
      into v_existing_id, v_existing_name, v_existing_archived_at
    from public.suppliers
    where tenant_id = v_target_tenant
      and lower(name) = lower(v_name);

    if found then
      raise exception 'Já existe um fornecedor com este nome.' using
        errcode = '23505',
        detail = jsonb_build_object(
          'existing_id', v_existing_id,
          'existing_name', v_existing_name,
          'archived', v_existing_archived_at is not null
        )::text;
    end if;

    select id, name, archived_at
      into v_existing_id, v_existing_name, v_existing_archived_at
    from public.suppliers
    where tenant_id = v_target_tenant
      and document = v_document;

    raise exception 'Já existe um fornecedor com este documento.' using
      errcode = '23505',
      detail = jsonb_build_object(
        'existing_id', v_existing_id,
        'existing_name', v_existing_name,
        'archived', v_existing_archived_at is not null
      )::text;
  end;

  return v_supplier;
end;
$function$;

comment on function public.create_supplier(text, text, text, text, text, uuid, uuid) is
  'Ticket 06/035: cria Fornecedor. Nome e documento normalizados e validados; categoria padrão precisa ser ativa do mesmo tenant. Conflito de nome ou documento (inclusive contra arquivado) recusado com SQLSTATE 23505 e detail estruturado.';

revoke all on function public.create_supplier(text, text, text, text, text, uuid, uuid) from public, anon;
grant execute on function public.create_supplier(text, text, text, text, text, uuid, uuid) to authenticated;
grant execute on function public.create_supplier(text, text, text, text, text, uuid, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- update_supplier
-- -----------------------------------------------------------------------------
create or replace function public.update_supplier(
  p_supplier_id uuid,
  p_name text,
  p_document text default null,
  p_phone text default null,
  p_email text default null,
  p_notes text default null,
  p_default_category_id uuid default null,
  p_tenant_id uuid default null
)
returns public.suppliers
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_name text;
  v_document text;
  v_phone text;
  v_email text;
  v_notes text;
  v_category_active boolean;
  v_supplier public.suppliers%rowtype;
  v_existing_id uuid;
  v_existing_name text;
  v_existing_archived_at timestamptz;
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
    raise exception 'Acesso negado para gerenciar o Plano de Contas.' using errcode = '42501';
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

  if p_supplier_id is null then
    raise exception 'Fornecedor é obrigatório.' using errcode = '22023';
  end if;

  -- Trava a linha antes de checar estado e conflito: mesma ordem de lock das
  -- demais escritas do Plano de Contas.
  select * into v_supplier
  from public.suppliers
  where id = p_supplier_id
    and tenant_id = v_target_tenant
  for update;

  if not found then
    raise exception 'Fornecedor não encontrado.' using errcode = 'P0001';
  end if;

  if v_supplier.archived_at is not null then
    raise exception 'Fornecedor arquivado não pode ser atualizado. Reative-o antes.' using errcode = 'P0001';
  end if;

  v_name := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'O nome do fornecedor deve ter entre 2 e 120 caracteres.' using errcode = '22023';
  end if;

  v_document := nullif(upper(regexp_replace(coalesce(p_document, ''), '[^0-9A-Za-z]', '', 'g')), '');
  if v_document is not null and not private.is_valid_br_document(v_document) then
    raise exception 'CPF ou CNPJ inválido.' using errcode = '22023';
  end if;

  v_phone := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
  if v_phone is not null and v_phone !~ '^[0-9]{10,11}$' then
    raise exception 'Telefone deve ter 10 ou 11 dígitos.' using errcode = '22023';
  end if;

  v_email := nullif(lower(btrim(coalesce(p_email, ''))), '');
  if v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'E-mail inválido.' using errcode = '22023';
  end if;

  v_notes := nullif(btrim(coalesce(p_notes, '')), '');
  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'Observação deve ter no máximo 500 caracteres.' using errcode = '22023';
  end if;

  -- Categoria padrao arquivada depois de definida continua aceita SE NAO
  -- MUDOU: so uma categoria nova (ou removida) passa pela checagem de ativa.
  if p_default_category_id is distinct from v_supplier.default_category_id
     and p_default_category_id is not null then
    select archived_at is null
      into v_category_active
    from public.financial_categories
    where id = p_default_category_id
      and tenant_id = v_target_tenant
      and nature = 'expense';

    if not found or not v_category_active then
      raise exception 'Categoria de despesa padrão informada não existe ou está arquivada.' using errcode = '22023';
    end if;
  end if;

  select id, name, archived_at
    into v_existing_id, v_existing_name, v_existing_archived_at
  from public.suppliers
  where tenant_id = v_target_tenant
    and lower(name) = lower(v_name)
    and id <> p_supplier_id;

  if found then
    raise exception 'Já existe um fornecedor com este nome.' using
      errcode = '23505',
      detail = jsonb_build_object(
        'existing_id', v_existing_id,
        'existing_name', v_existing_name,
        'archived', v_existing_archived_at is not null
      )::text;
  end if;

  if v_document is not null then
    select id, name, archived_at
      into v_existing_id, v_existing_name, v_existing_archived_at
    from public.suppliers
    where tenant_id = v_target_tenant
      and document = v_document
      and id <> p_supplier_id;

    if found then
      raise exception 'Já existe um fornecedor com este documento.' using
        errcode = '23505',
        detail = jsonb_build_object(
          'existing_id', v_existing_id,
          'existing_name', v_existing_name,
          'archived', v_existing_archived_at is not null
        )::text;
    end if;
  end if;

  begin
    update public.suppliers
    set name = v_name,
        document = v_document,
        phone = v_phone,
        email = v_email,
        notes = v_notes,
        default_category_id = p_default_category_id,
        updated_at = timezone('utc'::text, now()),
        updated_by = v_user_id
    where id = p_supplier_id
    returning * into v_supplier;
  exception when unique_violation then
    select id, name, archived_at
      into v_existing_id, v_existing_name, v_existing_archived_at
    from public.suppliers
    where tenant_id = v_target_tenant
      and lower(name) = lower(v_name)
      and id <> p_supplier_id;

    if found then
      raise exception 'Já existe um fornecedor com este nome.' using
        errcode = '23505',
        detail = jsonb_build_object(
          'existing_id', v_existing_id,
          'existing_name', v_existing_name,
          'archived', v_existing_archived_at is not null
        )::text;
    end if;

    select id, name, archived_at
      into v_existing_id, v_existing_name, v_existing_archived_at
    from public.suppliers
    where tenant_id = v_target_tenant
      and document = v_document
      and id <> p_supplier_id;

    raise exception 'Já existe um fornecedor com este documento.' using
      errcode = '23505',
      detail = jsonb_build_object(
        'existing_id', v_existing_id,
        'existing_name', v_existing_name,
        'archived', v_existing_archived_at is not null
      )::text;
  end;

  return v_supplier;
end;
$function$;

comment on function public.update_supplier(uuid, text, text, text, text, text, uuid, uuid) is
  'Ticket 06/035: atualiza Fornecedor ativo. Categoria padrão arquivada depois de definida continua aceita se não mudou. Conflito de nome ou documento recusado com o mesmo formato de create_supplier.';

revoke all on function public.update_supplier(uuid, text, text, text, text, text, uuid, uuid) from public, anon;
grant execute on function public.update_supplier(uuid, text, text, text, text, text, uuid, uuid) to authenticated;
grant execute on function public.update_supplier(uuid, text, text, text, text, text, uuid, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- archive_supplier
-- -----------------------------------------------------------------------------
create or replace function public.archive_supplier(
  p_supplier_id uuid,
  p_tenant_id uuid default null
)
returns public.suppliers
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_supplier public.suppliers%rowtype;
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
    raise exception 'Acesso negado para gerenciar o Plano de Contas.' using errcode = '42501';
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

  if p_supplier_id is null then
    raise exception 'Fornecedor é obrigatório.' using errcode = '22023';
  end if;

  select * into v_supplier
  from public.suppliers
  where id = p_supplier_id
    and tenant_id = v_target_tenant
  for update;

  if not found then
    raise exception 'Fornecedor não encontrado.' using errcode = 'P0001';
  end if;

  if v_supplier.archived_at is not null then
    raise exception 'Este fornecedor já está arquivado.' using errcode = 'P0001';
  end if;

  -- Arquivar nao exige motivo e nao altera nada que ja referencie o
  -- fornecedor: so o proprio carimbo muda.
  update public.suppliers
  set archived_at = timezone('utc'::text, now()),
      archived_by = v_user_id,
      updated_at = timezone('utc'::text, now()),
      updated_by = v_user_id
  where id = p_supplier_id
  returning * into v_supplier;

  return v_supplier;
end;
$function$;

comment on function public.archive_supplier(uuid, uuid) is
  'Ticket 06/035: arquiva Fornecedor. Reversível, sem motivo. Recusa arquivar o que já está arquivado.';

revoke all on function public.archive_supplier(uuid, uuid) from public, anon;
grant execute on function public.archive_supplier(uuid, uuid) to authenticated;
grant execute on function public.archive_supplier(uuid, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- reactivate_supplier
-- -----------------------------------------------------------------------------
create or replace function public.reactivate_supplier(
  p_supplier_id uuid,
  p_tenant_id uuid default null
)
returns public.suppliers
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_supplier public.suppliers%rowtype;
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
    raise exception 'Acesso negado para gerenciar o Plano de Contas.' using errcode = '42501';
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

  if p_supplier_id is null then
    raise exception 'Fornecedor é obrigatório.' using errcode = '22023';
  end if;

  select * into v_supplier
  from public.suppliers
  where id = p_supplier_id
    and tenant_id = v_target_tenant
  for update;

  if not found then
    raise exception 'Fornecedor não encontrado.' using errcode = 'P0001';
  end if;

  if v_supplier.archived_at is null then
    raise exception 'Este fornecedor já está ativo.' using errcode = 'P0001';
  end if;

  -- A unicidade de nome e documento vale tambem contra arquivado, entao
  -- reativar nunca colide.
  update public.suppliers
  set archived_at = null,
      archived_by = null,
      updated_at = timezone('utc'::text, now()),
      updated_by = v_user_id
  where id = p_supplier_id
  returning * into v_supplier;

  return v_supplier;
end;
$function$;

comment on function public.reactivate_supplier(uuid, uuid) is
  'Ticket 06/035: reativa Fornecedor arquivado. Nunca colide (unicidade vale também contra arquivado). Recusa reativar o que já está ativo.';

revoke all on function public.reactivate_supplier(uuid, uuid) from public, anon;
grant execute on function public.reactivate_supplier(uuid, uuid) to authenticated;
grant execute on function public.reactivate_supplier(uuid, uuid) to service_role;
