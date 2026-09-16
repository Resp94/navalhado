-- Ticket 08 da spec 036 (Contas a Pagar): edicao individual limitada pelo
-- estado e cancelamento terminal.
-- Spec: specs/036-contas-a-pagar/spec.md, secao "Entrega 2 -- Livro de Contas
-- a Pagar" (cancelamento e edicao individual).
--
-- Edicao por estado: aberta (tudo editavel); parcialmente paga (valor
-- travado); paga (valor e vencimento travados, viraram historico de um
-- pagamento concluido); cancelada (nada, recusado). Categoria e fornecedor
-- novos precisam estar ativos; manter os que ja estavam na conta e sempre
-- permitido, mesmo arquivados -- por isso a checagem de ativo so roda quando
-- o valor realmente muda.
--
-- Cancelamento so e aceito sem Baixa ativa (equivale ao estado aberto) e e
-- terminal: uma conta cancelada por engano e lancada de novo, nao reativada.

create or replace function public.update_payable(
  p_payable_id uuid,
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
  v_payable public.payables%rowtype;
  v_description text;
  v_amount numeric(12,2);
  v_document_number text;
  v_notes text;
  v_competence_date date;
  v_category_active boolean;
  v_supplier_active boolean;
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
    raise exception 'Acesso negado para editar Contas a Pagar.' using errcode = '42501';
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

  select * into v_payable
  from public.payables
  where id = p_payable_id
    and tenant_id = v_target_tenant
  for update;

  if not found then
    raise exception 'Conta a pagar não encontrada.' using errcode = 'P0001';
  end if;

  if v_payable.status = 'cancelled' then
    raise exception 'Conta cancelada não pode ser editada.' using errcode = 'P0001';
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

  if v_payable.status in ('partially_paid', 'paid') and v_amount is distinct from v_payable.amount then
    raise exception 'O valor não pode ser alterado numa conta parcialmente paga ou paga.' using errcode = 'P0001';
  end if;

  if v_payable.status = 'paid' and p_due_date is distinct from v_payable.due_date then
    raise exception 'O vencimento não pode ser alterado numa conta paga.' using errcode = 'P0001';
  end if;

  if p_category_id is null then
    raise exception 'Categoria de despesa é obrigatória.' using errcode = '22023';
  end if;

  if p_category_id is distinct from v_payable.category_id then
    select archived_at is null
      into v_category_active
    from public.financial_categories
    where id = p_category_id
      and tenant_id = v_target_tenant
      and nature = 'expense';

    if not found or not v_category_active then
      raise exception 'Categoria de despesa informada não existe ou está arquivada.' using errcode = '22023';
    end if;
  end if;

  if p_supplier_id is distinct from v_payable.supplier_id and p_supplier_id is not null then
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

  v_competence_date := coalesce(p_competence_date, v_payable.competence_date);

  update public.payables
  set description = v_description,
      category_id = p_category_id,
      supplier_id = p_supplier_id,
      amount = v_amount,
      due_date = p_due_date,
      competence_date = v_competence_date,
      document_number = v_document_number,
      notes = v_notes,
      updated_at = timezone('utc'::text, now()),
      updated_by = v_user_id
  where id = p_payable_id
  returning * into v_payable;

  return v_payable;
end;
$function$;

comment on function public.update_payable(uuid, text, uuid, numeric, date, uuid, date, text, text, uuid) is
  'Ticket 08/036: edita Conta a Pagar. Valor travado a partir de parcialmente paga; vencimento travado a partir de paga; cancelada recusa qualquer edição.';

revoke all on function public.update_payable(uuid, text, uuid, numeric, date, uuid, date, text, text, uuid) from public, anon;
grant execute on function public.update_payable(uuid, text, uuid, numeric, date, uuid, date, text, text, uuid) to authenticated;
grant execute on function public.update_payable(uuid, text, uuid, numeric, date, uuid, date, text, text, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- cancel_payable: terminal, so aceita sem Baixa ativa (equivale ao estado
-- aberto).
-- -----------------------------------------------------------------------------
create or replace function public.cancel_payable(
  p_payable_id uuid,
  p_reason text,
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
  v_reason text;
  v_payable public.payables%rowtype;
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
    raise exception 'Acesso negado para cancelar Contas a Pagar.' using errcode = '42501';
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

  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) < 5 then
    raise exception 'Informe um motivo com pelo menos cinco caracteres.' using errcode = '22023';
  end if;

  select * into v_payable
  from public.payables
  where id = p_payable_id
    and tenant_id = v_target_tenant
  for update;

  if not found then
    raise exception 'Conta a pagar não encontrada.' using errcode = 'P0001';
  end if;

  if v_payable.status = 'cancelled' then
    raise exception 'Esta conta já está cancelada.' using errcode = 'P0001';
  end if;

  if v_payable.status <> 'open' then
    raise exception 'Não é possível cancelar uma conta com Baixa ativa.' using errcode = 'P0001';
  end if;

  update public.payables
  set status = 'cancelled',
      cancelled_at = timezone('utc'::text, now()),
      cancelled_by = v_user_id,
      cancellation_reason = v_reason,
      updated_at = timezone('utc'::text, now()),
      updated_by = v_user_id
  where id = p_payable_id
  returning * into v_payable;

  return v_payable;
end;
$function$;

comment on function public.cancel_payable(uuid, text, uuid) is
  'Ticket 08/036: cancela Conta a Pagar sem Baixa ativa. Terminal -- uma conta cancelada por engano é lançada de novo, não reativada.';

revoke all on function public.cancel_payable(uuid, text, uuid) from public, anon;
grant execute on function public.cancel_payable(uuid, text, uuid) to authenticated;
grant execute on function public.cancel_payable(uuid, text, uuid) to service_role;
