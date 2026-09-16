-- Ticket 13 da spec 036 (Contas a Pagar): edicao e cancelamento em serie
-- ("esta e as seguintes em aberto"). "Apenas esta" continua usando
-- update_payable/cancel_payable do ticket 08/036 -- sem mudanca nessas RPCs.
-- Spec: specs/036-contas-a-pagar/spec.md, secao "Entrega 3 -- Serie:
-- Parcelamento e Recorrencia" (edicao e cancelamento em serie).
--
-- Contas ja pagas ou parcialmente pagas nunca sao alteradas em lote -- a
-- resposta devolve uma linha por ocorrencia atingida (posicao >= a
-- escolhida), com `ignored`/`ignore_reason` explicando o que nao mudou.
-- Vencimento, documento e competencia nao se editam em lote: so descricao,
-- Categoria de Despesa, Fornecedor, observacao e valor (este ultimo so na
-- Recorrencia -- Parcelamento recusa valor em lote, porque as parcelas tem
-- residuo calculado na criacao). A trava e sempre Serie primeiro, depois as
-- ocorrencias em ordem de posicao, so entao qualquer verificacao de estado.

create or replace function public.update_payable_series(
  p_payable_id uuid,
  p_description text,
  p_category_id uuid,
  p_supplier_id uuid default null,
  p_notes text default null,
  p_amount numeric default null,
  p_tenant_id uuid default null
)
returns table (
  id uuid,
  series_position integer,
  status text,
  ignored boolean,
  ignore_reason text
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
  v_anchor_series_id uuid;
  v_anchor_position integer;
  v_series_type text;
  v_description text;
  v_notes text;
  v_amount numeric(12,2);
  v_category_active boolean;
  v_supplier_active boolean;
  v_row record;
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

  select p.series_id, p.series_position
    into v_anchor_series_id, v_anchor_position
  from public.payables p
  where p.id = p_payable_id
    and p.tenant_id = v_target_tenant;

  if not found then
    raise exception 'Conta a pagar não encontrada.' using errcode = 'P0001';
  end if;

  if v_anchor_series_id is null then
    raise exception 'Esta conta não pertence a uma Série.' using errcode = '22023';
  end if;

  select series_type
    into v_series_type
  from public.payable_series ps
  where ps.id = v_anchor_series_id
    and ps.tenant_id = v_target_tenant
  for update;

  if not found then
    raise exception 'Série não encontrada.' using errcode = 'P0001';
  end if;

  v_description := regexp_replace(btrim(coalesce(p_description, '')), '\s+', ' ', 'g');
  if char_length(v_description) < 2 or char_length(v_description) > 200 then
    raise exception 'A descrição deve ter entre 2 e 200 caracteres.' using errcode = '22023';
  end if;

  if p_category_id is null then
    raise exception 'Categoria de despesa é obrigatória.' using errcode = '22023';
  end if;

  select fc.archived_at is null
    into v_category_active
  from public.financial_categories fc
  where fc.id = p_category_id
    and fc.tenant_id = v_target_tenant
    and fc.nature = 'expense';

  if not found or not v_category_active then
    raise exception 'Categoria de despesa informada não existe ou está arquivada.' using errcode = '22023';
  end if;

  if p_supplier_id is not null then
    select s.archived_at is null
      into v_supplier_active
    from public.suppliers s
    where s.id = p_supplier_id
      and s.tenant_id = v_target_tenant;

    if not found or not v_supplier_active then
      raise exception 'Fornecedor informado não existe ou está arquivado.' using errcode = '22023';
    end if;
  end if;

  v_notes := nullif(btrim(coalesce(p_notes, '')), '');
  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'Observação deve ter no máximo 500 caracteres.' using errcode = '22023';
  end if;

  if p_amount is not null then
    if v_series_type = 'installment' then
      raise exception 'Valor em lote não é aceito em Parcelamento.' using errcode = '22023';
    end if;
    v_amount := round(p_amount::numeric, 2);
    if v_amount <= 0 then
      raise exception 'O valor deve ser maior que zero.' using errcode = '22023';
    end if;
  end if;

  for v_row in
    select p.id, p.series_position, p.status
    from public.payables p
    where p.series_id = v_anchor_series_id
      and p.series_position >= v_anchor_position
    order by p.series_position
    for update
  loop
    if v_row.status = 'open' then
      update public.payables
      set description = v_description,
          category_id = p_category_id,
          supplier_id = p_supplier_id,
          notes = v_notes,
          amount = coalesce(v_amount, amount),
          updated_at = timezone('utc'::text, now()),
          updated_by = v_user_id
      where public.payables.id = v_row.id;

      id := v_row.id;
      series_position := v_row.series_position;
      status := 'open';
      ignored := false;
      ignore_reason := null;
    else
      id := v_row.id;
      series_position := v_row.series_position;
      status := v_row.status;
      ignored := true;
      ignore_reason := case v_row.status
        when 'partially_paid' then 'Conta parcialmente paga não é alterada em lote.'
        when 'paid' then 'Conta paga não é alterada em lote.'
        when 'cancelled' then 'Conta cancelada não é alterada em lote.'
        else 'Conta não está aberta.'
      end;
    end if;

    return next;
  end loop;
end;
$function$;

comment on function public.update_payable_series(uuid, text, uuid, uuid, text, numeric, uuid) is
  'Ticket 13/036: edita "esta e as seguintes em aberto" de uma Série. Ignora pagas/parcialmente pagas/canceladas, devolvendo o motivo por ocorrência. Valor em lote recusado em Parcelamento.';

revoke all on function public.update_payable_series(uuid, text, uuid, uuid, text, numeric, uuid) from public, anon;
grant execute on function public.update_payable_series(uuid, text, uuid, uuid, text, numeric, uuid) to authenticated;
grant execute on function public.update_payable_series(uuid, text, uuid, uuid, text, numeric, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- cancel_payable_series: mesma travessia, cancela "esta e as seguintes em
-- aberto". Mesmo motivo e autor gravados em cada ocorrência cancelada.
-- -----------------------------------------------------------------------------

create or replace function public.cancel_payable_series(
  p_payable_id uuid,
  p_reason text,
  p_tenant_id uuid default null
)
returns table (
  id uuid,
  series_position integer,
  status text,
  ignored boolean,
  ignore_reason text
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
  v_anchor_series_id uuid;
  v_anchor_position integer;
  v_reason text;
  v_row record;
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

  select p.series_id, p.series_position
    into v_anchor_series_id, v_anchor_position
  from public.payables p
  where p.id = p_payable_id
    and p.tenant_id = v_target_tenant;

  if not found then
    raise exception 'Conta a pagar não encontrada.' using errcode = 'P0001';
  end if;

  if v_anchor_series_id is null then
    raise exception 'Esta conta não pertence a uma Série.' using errcode = '22023';
  end if;

  perform 1
  from public.payable_series ps
  where ps.id = v_anchor_series_id
    and ps.tenant_id = v_target_tenant
  for update;

  if not found then
    raise exception 'Série não encontrada.' using errcode = 'P0001';
  end if;

  for v_row in
    select p.id, p.series_position, p.status
    from public.payables p
    where p.series_id = v_anchor_series_id
      and p.series_position >= v_anchor_position
    order by p.series_position
    for update
  loop
    if v_row.status = 'open' then
      update public.payables
      set status = 'cancelled',
          cancelled_at = timezone('utc'::text, now()),
          cancelled_by = v_user_id,
          cancellation_reason = v_reason,
          updated_at = timezone('utc'::text, now()),
          updated_by = v_user_id
      where public.payables.id = v_row.id;

      id := v_row.id;
      series_position := v_row.series_position;
      status := 'cancelled';
      ignored := false;
      ignore_reason := null;
    else
      id := v_row.id;
      series_position := v_row.series_position;
      status := v_row.status;
      ignored := true;
      ignore_reason := case v_row.status
        when 'partially_paid' then 'Conta parcialmente paga não é cancelada em lote.'
        when 'paid' then 'Conta paga não é cancelada em lote.'
        when 'cancelled' then 'Conta já estava cancelada.'
        else 'Conta não está aberta.'
      end;
    end if;

    return next;
  end loop;
end;
$function$;

comment on function public.cancel_payable_series(uuid, text, uuid) is
  'Ticket 13/036: cancela "esta e as seguintes em aberto" de uma Série, com o mesmo motivo e autor em cada ocorrência. Ignora pagas/parcialmente pagas/já canceladas.';

revoke all on function public.cancel_payable_series(uuid, text, uuid) from public, anon;
grant execute on function public.cancel_payable_series(uuid, text, uuid) to authenticated;
grant execute on function public.cancel_payable_series(uuid, text, uuid) to service_role;
