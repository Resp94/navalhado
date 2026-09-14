-- Ticket 12 da spec 036 (Contas a Pagar): Parcelamento, reusando o calendario
-- e a previa do ticket 11/036 (private.compute_series_due_date e
-- preview_payable_series ja aceitavam p_series_type = 'installment' desde
-- entao, sem exigir troca de assinatura agora).
-- Spec: specs/036-contas-a-pagar/spec.md, secao "Entrega 3 -- Serie:
-- Parcelamento e Recorrencia" (Parcelamento).
--
-- Todas as parcelas recebem o total dividido pela quantidade, truncado em
-- centavos, e a ultima recebe o residuo -- a soma e exatamente o total.
-- Uma unica competencia, informada na criacao (padrao: vencimento da
-- primeira parcela), replicada em todas as parcelas -- uma compra parcelada
-- e uma despesa so. A descricao e gravada sem sufixo "i/N": a numeracao e
-- derivada da posicao e da quantidade na leitura, nunca gravada, para editar
-- a descricao da Serie nao exigir reescrever numeracao.

create or replace function public.create_installment_payable_series(
  p_description text,
  p_category_id uuid,
  p_periodicity text,
  p_anchor_date date,
  p_occurrences integer,
  p_amount numeric,
  p_supplier_id uuid default null,
  p_competence_date date default null,
  p_document_number text default null,
  p_notes text default null,
  p_tenant_id uuid default null
)
returns setof public.payables
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
  v_share numeric(12,2);
  v_last_share numeric(12,2);
  v_competence_date date;
  v_document_number text;
  v_notes text;
  v_category_active boolean;
  v_supplier_active boolean;
  v_series_id uuid;
  v_due_date date;
  v_installment_amount numeric(12,2);
  i integer;
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

  if p_periodicity not in ('weekly', 'biweekly', 'monthly', 'yearly') then
    raise exception 'Periodicidade inválida.' using errcode = '22023';
  end if;
  if p_anchor_date is null then
    raise exception 'Data âncora é obrigatória.' using errcode = '22023';
  end if;
  if p_occurrences is null or p_occurrences < 2 or p_occurrences > 60 then
    raise exception 'A quantidade deve estar entre 2 e 60.' using errcode = '22023';
  end if;

  if p_amount is null then
    raise exception 'Valor é obrigatório.' using errcode = '22023';
  end if;
  v_amount := round(p_amount::numeric, 2);
  if v_amount <= 0 then
    raise exception 'O valor deve ser maior que zero.' using errcode = '22023';
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

  v_competence_date := coalesce(p_competence_date, p_anchor_date);

  v_share := trunc(v_amount / p_occurrences, 2);
  v_last_share := v_amount - (v_share * (p_occurrences - 1));

  insert into public.payable_series (tenant_id, series_type, periodicity, anchor_date, amount, created_by)
  values (v_target_tenant, 'installment', p_periodicity, p_anchor_date, v_amount, v_user_id)
  returning id into v_series_id;

  for i in 1..p_occurrences loop
    v_due_date := private.compute_series_due_date(p_anchor_date, p_periodicity, i);
    v_installment_amount := case when i = p_occurrences then v_last_share else v_share end;
    insert into public.payables (
      tenant_id, description, category_id, supplier_id, amount, due_date, competence_date,
      document_number, notes, series_id, series_position, created_by
    ) values (
      v_target_tenant, v_description, p_category_id, p_supplier_id, v_installment_amount, v_due_date,
      v_competence_date, v_document_number, v_notes, v_series_id, i, v_user_id
    );
  end loop;

  return query
  select * from public.payables where series_id = v_series_id order by series_position;
end;
$function$;

comment on function public.create_installment_payable_series(text, uuid, text, date, integer, numeric, uuid, date, text, text, uuid) is
  'Ticket 12/036: cria um Parcelamento (2 a 60 parcelas, total dividido truncado em centavos, resíduo na última). Competência única, replicada em todas as parcelas. Descrição gravada sem sufixo "i/N".';

revoke all on function public.create_installment_payable_series(text, uuid, text, date, integer, numeric, uuid, date, text, text, uuid) from public, anon;
grant execute on function public.create_installment_payable_series(text, uuid, text, date, integer, numeric, uuid, date, text, text, uuid) to authenticated;
grant execute on function public.create_installment_payable_series(text, uuid, text, date, integer, numeric, uuid, date, text, text, uuid) to service_role;
