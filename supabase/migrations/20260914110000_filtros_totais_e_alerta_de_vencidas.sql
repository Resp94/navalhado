-- Ticket 09 da spec 036 (Contas a Pagar): filtros completos na lista, totais
-- do filtro e alerta de vencidas.
-- Spec: specs/036-contas-a-pagar/spec.md, secao "Entrega 2 -- Livro de Contas
-- a Pagar" (leitura) e "Interface".
--
-- list_payables ganha filtro por Categoria de Despesa e Fornecedor, sempre
-- acrescentados ao final da lista de parametros (depois de p_tenant_id) para
-- que a assinatura existente continue identica e o CREATE OR REPLACE nao
-- exija derrubar e reconceder privilegios -- mesmo arranjo ja usado para o
-- contrato de Baixa nascer completo no ticket 07/036.
--
-- Totais do filtro obedecem a periodo, categoria e fornecedor e ignoram o
-- filtro de estado (senao o pago zeraria ao filtrar vencidas). O alerta
-- ignora o filtro de periodo (uma conta vencida no mes passado nao pode
-- sumir so porque o filtro esta no mes corrente). As duas leituras calculam
-- o dia de negocio no servidor, a partir do fuso do tenant, no mesmo padrao
-- de list_payables e get_payable.

create or replace function public.list_payables(
  p_due_date_from date default null,
  p_due_date_to date default null,
  p_status text default 'not_cancelled',
  p_page integer default 1,
  p_page_size integer default 20,
  p_tenant_id uuid default null,
  p_category_id uuid default null,
  p_supplier_id uuid default null
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
      and (p_category_id is null or p.category_id = p_category_id)
      and (p_supplier_id is null or p.supplier_id = p_supplier_id)
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

comment on function public.list_payables(date, date, text, integer, integer, uuid, uuid, uuid) is
  'Ticket 06+09/036: lista paginada de Contas a Pagar, com filtro de vencimento, estado, Categoria de Despesa e Fornecedor.';

revoke all on function public.list_payables(date, date, text, integer, integer, uuid, uuid, uuid) from public, anon;
grant execute on function public.list_payables(date, date, text, integer, integer, uuid, uuid, uuid) to authenticated;
grant execute on function public.list_payables(date, date, text, integer, integer, uuid, uuid, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- get_payables_totals: em aberto (destacando o vencido) e pago no periodo.
-- Obedece periodo, categoria e fornecedor; ignora o filtro de estado.
-- -----------------------------------------------------------------------------
create or replace function public.get_payables_totals(
  p_due_date_from date default null,
  p_due_date_to date default null,
  p_category_id uuid default null,
  p_supplier_id uuid default null,
  p_tenant_id uuid default null
)
returns table (
  open_balance numeric,
  overdue_balance numeric,
  paid_in_period numeric
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

  return query
  select
    coalesce((
      select sum(p.amount - p.paid_amount)
      from public.payables p
      where p.tenant_id = v_target_tenant
        and p.status <> 'cancelled'
        and (p_due_date_from is null or p.due_date >= p_due_date_from)
        and (p_due_date_to is null or p.due_date <= p_due_date_to)
        and (p_category_id is null or p.category_id = p_category_id)
        and (p_supplier_id is null or p.supplier_id = p_supplier_id)
    ), 0) as open_balance,
    coalesce((
      select sum(p.amount - p.paid_amount)
      from public.payables p
      where p.tenant_id = v_target_tenant
        and p.status in ('open', 'partially_paid')
        and p.due_date < v_today
        and (p_due_date_from is null or p.due_date >= p_due_date_from)
        and (p_due_date_to is null or p.due_date <= p_due_date_to)
        and (p_category_id is null or p.category_id = p_category_id)
        and (p_supplier_id is null or p.supplier_id = p_supplier_id)
    ), 0) as overdue_balance,
    coalesce((
      select sum(ps.paid_amount)
      from public.payable_settlements ps
      join public.payables p on p.id = ps.payable_id
      where ps.tenant_id = v_target_tenant
        and ps.reversed_at is null
        and (p_due_date_from is null or ps.payment_date >= p_due_date_from)
        and (p_due_date_to is null or ps.payment_date <= p_due_date_to)
        and (p_category_id is null or p.category_id = p_category_id)
        and (p_supplier_id is null or p.supplier_id = p_supplier_id)
    ), 0) as paid_in_period;
end;
$function$;

comment on function public.get_payables_totals(date, date, uuid, uuid, uuid) is
  'Ticket 09/036: totais do filtro (em aberto, vencido, pago no período). Obedece período, categoria e fornecedor; ignora o filtro de estado.';

revoke all on function public.get_payables_totals(date, date, uuid, uuid, uuid) from public, anon;
grant execute on function public.get_payables_totals(date, date, uuid, uuid, uuid) to authenticated;
grant execute on function public.get_payables_totals(date, date, uuid, uuid, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- get_payables_alert: quantidade e saldo das vencidas e das que vencem hoje,
-- sem filtro de periodo.
-- -----------------------------------------------------------------------------
create or replace function public.get_payables_alert(
  p_tenant_id uuid default null
)
returns table (
  overdue_count integer,
  overdue_balance numeric,
  due_today_count integer,
  due_today_balance numeric
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

  return query
  select
    coalesce((
      select count(*)::integer from public.payables p
      where p.tenant_id = v_target_tenant
        and p.status in ('open', 'partially_paid')
        and p.due_date < v_today
    ), 0),
    coalesce((
      select sum(p.amount - p.paid_amount) from public.payables p
      where p.tenant_id = v_target_tenant
        and p.status in ('open', 'partially_paid')
        and p.due_date < v_today
    ), 0),
    coalesce((
      select count(*)::integer from public.payables p
      where p.tenant_id = v_target_tenant
        and p.status in ('open', 'partially_paid')
        and p.due_date = v_today
    ), 0),
    coalesce((
      select sum(p.amount - p.paid_amount) from public.payables p
      where p.tenant_id = v_target_tenant
        and p.status in ('open', 'partially_paid')
        and p.due_date = v_today
    ), 0);
end;
$function$;

comment on function public.get_payables_alert(uuid) is
  'Ticket 09/036: quantidade e saldo das Contas a Pagar vencidas e das que vencem hoje, sem filtro de período.';

revoke all on function public.get_payables_alert(uuid) from public, anon;
grant execute on function public.get_payables_alert(uuid) to authenticated;
grant execute on function public.get_payables_alert(uuid) to service_role;
