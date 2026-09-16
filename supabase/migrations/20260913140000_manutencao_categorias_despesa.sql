-- Ticket 04 da spec 035 (Plano de Contas): RPCs de escrita de Categoria de
-- Despesa -- criar, renomear, arquivar, reativar.
-- Spec: specs/035-plano-de-contas-categorias-e-fornecedores/spec.md, secoes
-- "Entrega 2 -- Categorias de Despesa" e "Escrita por RPC, leitura por
-- tabela".
--
-- Escopo estrito deste ticket: as quatro RPCs de Categoria de Despesa.
-- Fornecedores (criar, atualizar, arquivar, reativar) sao o ticket 06.
--
-- Resolucao de tenant e revalidacao de papel seguem exatamente o padrao ja
-- usado por public.register_commission_payout e
-- public.get_professional_commission_balance (migration
-- 20260912100000_abate_vale_na_quitacao_comissao.sql): parametro de tenant
-- opcional, recusado quando diverge do tenant do usuario e o usuario nao e
-- 'proprietario' (administrador do SaaS), ausente vale o tenant do usuario.
--
-- Conflito de nome: a checagem explicita cobre o caso comum com mensagem
-- clara; o INSERT/UPDATE tambem fica dentro de um bloco com
-- "exception when unique_violation" para que uma corrida contra a checagem
-- explicita (duas criacoes concorrentes do mesmo nome) caia no MESMO formato
-- de erro. As duas rotas levantam SQLSTATE 23505 com uma mensagem em
-- portugues e um "detail" em JSON (existing_id, existing_name, archived) que
-- o adaptador Supabase (src/modules/plano-contas/adapters/
-- SupabasePlanoContasAdapter.ts) le para montar PlanoContasConflictError.
-- Qualquer outro erro da RPC (papel, unidade, estado invalido) vira
-- PlanoContasValidationError com a propria mensagem em portugues da RPC.

create or replace function public.create_expense_category(
  p_name text,
  p_tenant_id uuid default null
)
returns public.financial_categories
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
  v_existing_id uuid;
  v_existing_name text;
  v_existing_archived_at timestamptz;
  v_category public.financial_categories%rowtype;
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
  if char_length(v_name) < 2 or char_length(v_name) > 60 then
    raise exception 'O nome da categoria deve ter entre 2 e 60 caracteres.' using errcode = '22023';
  end if;

  select id, name, archived_at
    into v_existing_id, v_existing_name, v_existing_archived_at
  from public.financial_categories
  where tenant_id = v_target_tenant
    and nature = 'expense'
    and lower(name) = lower(v_name);

  if found then
    raise exception 'Já existe uma categoria de despesa com este nome.' using
      errcode = '23505',
      detail = jsonb_build_object(
        'existing_id', v_existing_id,
        'existing_name', v_existing_name,
        'archived', v_existing_archived_at is not null
      )::text;
  end if;

  begin
    insert into public.financial_categories (tenant_id, nature, name, created_by)
    values (v_target_tenant, 'expense', v_name, v_user_id)
    returning * into v_category;
  exception when unique_violation then
    -- Corrida contra a checagem explicita acima: outra sessao criou o mesmo
    -- nome entre a checagem e este INSERT. Mesmo formato de erro.
    select id, name, archived_at
      into v_existing_id, v_existing_name, v_existing_archived_at
    from public.financial_categories
    where tenant_id = v_target_tenant
      and nature = 'expense'
      and lower(name) = lower(v_name);

    raise exception 'Já existe uma categoria de despesa com este nome.' using
      errcode = '23505',
      detail = jsonb_build_object(
        'existing_id', v_existing_id,
        'existing_name', v_existing_name,
        'archived', v_existing_archived_at is not null
      )::text;
  end;

  return v_category;
end;
$function$;

comment on function public.create_expense_category(text, uuid) is
  'Ticket 04/035: cria Categoria de Despesa. Nome normalizado e validado (2-60). Conflito de nome (inclusive contra arquivada) recusado com SQLSTATE 23505 e detail estruturado.';

revoke all on function public.create_expense_category(text, uuid) from public, anon;
grant execute on function public.create_expense_category(text, uuid) to authenticated;
grant execute on function public.create_expense_category(text, uuid) to service_role;

create or replace function public.rename_expense_category(
  p_category_id uuid,
  p_name text,
  p_tenant_id uuid default null
)
returns public.financial_categories
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
  v_category public.financial_categories%rowtype;
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

  if p_category_id is null then
    raise exception 'Categoria de despesa é obrigatória.' using errcode = '22023';
  end if;

  v_name := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  if char_length(v_name) < 2 or char_length(v_name) > 60 then
    raise exception 'O nome da categoria deve ter entre 2 e 60 caracteres.' using errcode = '22023';
  end if;

  -- Trava a linha antes de checar estado e conflito: mesma ordem de lock das
  -- demais escritas financeiras.
  select * into v_category
  from public.financial_categories
  where id = p_category_id
    and tenant_id = v_target_tenant
    and nature = 'expense'
  for update;

  if not found then
    raise exception 'Categoria de despesa não encontrada.' using errcode = 'P0001';
  end if;

  if v_category.archived_at is not null then
    raise exception 'Categoria arquivada não pode ser renomeada. Reative-a antes.' using errcode = 'P0001';
  end if;

  select id, name, archived_at
    into v_existing_id, v_existing_name, v_existing_archived_at
  from public.financial_categories
  where tenant_id = v_target_tenant
    and nature = 'expense'
    and lower(name) = lower(v_name)
    and id <> p_category_id;

  if found then
    raise exception 'Já existe uma categoria de despesa com este nome.' using
      errcode = '23505',
      detail = jsonb_build_object(
        'existing_id', v_existing_id,
        'existing_name', v_existing_name,
        'archived', v_existing_archived_at is not null
      )::text;
  end if;

  begin
    update public.financial_categories
    set name = v_name,
        updated_at = timezone('utc'::text, now()),
        updated_by = v_user_id
    where id = p_category_id
    returning * into v_category;
  exception when unique_violation then
    select id, name, archived_at
      into v_existing_id, v_existing_name, v_existing_archived_at
    from public.financial_categories
    where tenant_id = v_target_tenant
      and nature = 'expense'
      and lower(name) = lower(v_name)
      and id <> p_category_id;

    raise exception 'Já existe uma categoria de despesa com este nome.' using
      errcode = '23505',
      detail = jsonb_build_object(
        'existing_id', v_existing_id,
        'existing_name', v_existing_name,
        'archived', v_existing_archived_at is not null
      )::text;
  end;

  return v_category;
end;
$function$;

comment on function public.rename_expense_category(uuid, text, uuid) is
  'Ticket 04/035: renomeia Categoria de Despesa. Recusa categoria arquivada e nome em conflito (inclusive contra arquivada), com o mesmo formato de erro de create_expense_category.';

revoke all on function public.rename_expense_category(uuid, text, uuid) from public, anon;
grant execute on function public.rename_expense_category(uuid, text, uuid) to authenticated;
grant execute on function public.rename_expense_category(uuid, text, uuid) to service_role;

create or replace function public.archive_expense_category(
  p_category_id uuid,
  p_tenant_id uuid default null
)
returns public.financial_categories
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_category public.financial_categories%rowtype;
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

  if p_category_id is null then
    raise exception 'Categoria de despesa é obrigatória.' using errcode = '22023';
  end if;

  select * into v_category
  from public.financial_categories
  where id = p_category_id
    and tenant_id = v_target_tenant
    and nature = 'expense'
  for update;

  if not found then
    raise exception 'Categoria de despesa não encontrada.' using errcode = 'P0001';
  end if;

  if v_category.archived_at is not null then
    raise exception 'Esta categoria já está arquivada.' using errcode = 'P0001';
  end if;

  -- Arquivar nao exige motivo (categoria e cadastro, nao lancamento) e nao
  -- altera nada que ja referencie a categoria: so o proprio carimbo muda.
  update public.financial_categories
  set archived_at = timezone('utc'::text, now()),
      archived_by = v_user_id,
      updated_at = timezone('utc'::text, now()),
      updated_by = v_user_id
  where id = p_category_id
  returning * into v_category;

  return v_category;
end;
$function$;

comment on function public.archive_expense_category(uuid, uuid) is
  'Ticket 04/035: arquiva Categoria de Despesa. Reversivel, sem motivo. Recusa arquivar o que ja esta arquivado.';

revoke all on function public.archive_expense_category(uuid, uuid) from public, anon;
grant execute on function public.archive_expense_category(uuid, uuid) to authenticated;
grant execute on function public.archive_expense_category(uuid, uuid) to service_role;

create or replace function public.reactivate_expense_category(
  p_category_id uuid,
  p_tenant_id uuid default null
)
returns public.financial_categories
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_category public.financial_categories%rowtype;
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

  if p_category_id is null then
    raise exception 'Categoria de despesa é obrigatória.' using errcode = '22023';
  end if;

  select * into v_category
  from public.financial_categories
  where id = p_category_id
    and tenant_id = v_target_tenant
    and nature = 'expense'
  for update;

  if not found then
    raise exception 'Categoria de despesa não encontrada.' using errcode = 'P0001';
  end if;

  if v_category.archived_at is null then
    raise exception 'Esta categoria já está ativa.' using errcode = 'P0001';
  end if;

  -- A unicidade do indice vale tambem contra arquivada, entao reativar nunca
  -- colide: nao pode existir outra categoria com o mesmo nome.
  update public.financial_categories
  set archived_at = null,
      archived_by = null,
      updated_at = timezone('utc'::text, now()),
      updated_by = v_user_id
  where id = p_category_id
  returning * into v_category;

  return v_category;
end;
$function$;

comment on function public.reactivate_expense_category(uuid, uuid) is
  'Ticket 04/035: reativa Categoria de Despesa arquivada. Nunca colide (unicidade vale tambem contra arquivada). Recusa reativar o que ja esta ativo.';

revoke all on function public.reactivate_expense_category(uuid, uuid) from public, anon;
grant execute on function public.reactivate_expense_category(uuid, uuid) to authenticated;
grant execute on function public.reactivate_expense_category(uuid, uuid) to service_role;
