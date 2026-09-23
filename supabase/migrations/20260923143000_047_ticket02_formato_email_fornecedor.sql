-- Spec 047, ticket 02: formato rigido de e-mail em Fornecedor.
--
-- Troca a regex antiga e frouxa de suppliers_email_check e das RPCs de
-- Fornecedor (create_supplier, update_supplier) pela funcao unica
-- public.email_valido, criada no ticket 01 (migration 140000). Mensagens de
-- erro e codigos continuam os mesmos.

alter table public.suppliers
  drop constraint suppliers_email_check;

alter table public.suppliers
  add constraint suppliers_email_check
  check (email is null or public.email_valido(email))
  not valid;

alter table public.suppliers
  validate constraint suppliers_email_check;

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
set search_path to ''
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
  if v_email is not null and not public.email_valido(v_email) then
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
set search_path to ''
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
  if v_email is not null and not public.email_valido(v_email) then
    raise exception 'E-mail inválido.' using errcode = '22023';
  end if;

  v_notes := nullif(btrim(coalesce(p_notes, '')), '');
  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'Observação deve ter no máximo 500 caracteres.' using errcode = '22023';
  end if;

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
