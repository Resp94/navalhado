-- Ticket 14 da spec 036 (Contas a Pagar): aviso de fim proximo e extensao da
-- Recorrencia. Mitiga o limite de 60 ocorrencias por operacao do ticket
-- 11/036, ja que nao existe recorrencia sem fim.
-- Spec: specs/036-contas-a-pagar/spec.md, secao "Entrega 3 -- Serie:
-- Parcelamento e Recorrencia" (aviso e extensao da Recorrencia).
--
-- O aviso e por dias (ate 60 a partir do dia de negocio do tenant), nao por
-- quantidade de ocorrencias -- vale igual pra qualquer periodicidade. So a
-- ultima ocorrencia da Serie (maior series_position) importa: se ela esta
-- cancelada, nao ha aviso (o gestor ja encerrou deliberadamente). Parcelamento
-- nunca tem aviso nem extensao -- o total e o contrato.
--
-- A extensao gera novas posicoes a partir da MAIOR posicao ja existente na
-- Serie (contando canceladas, pra nunca colidir), pelo mesmo calendario
-- ancorado na data original (private.compute_series_due_date). Valor,
-- categoria, fornecedor e descricao vem da ultima ocorrencia NAO cancelada
-- -- um reajuste feito em "esta e as seguintes" (ticket 13/036) sobrevive a
-- extensao. Documento e observacao nao sao herdados (ficam em branco): a
-- spec so lista os quatro campos acima.

-- -----------------------------------------------------------------------------
-- get_payable: passa a devolver o aviso de fim proximo (ticket 14/036). Muda
-- o tipo de retorno (novas colunas), por isso e' drop + create de novo (mesma
-- excecao ja documentada no ticket 11/036).
-- -----------------------------------------------------------------------------
drop function if exists public.get_payable(uuid, uuid);

create function public.get_payable(
  p_payable_id uuid,
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
  series_type text,
  series_periodicity text,
  series_occurrences_count integer,
  series_ending_soon boolean,
  series_last_due_date date,
  created_at timestamptz,
  created_by uuid,
  created_by_name text,
  updated_at timestamptz,
  updated_by uuid,
  updated_by_name text,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancelled_by_name text,
  cancellation_reason text
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
    p.id, p.description, p.category_id, fc.name, fc.archived_at is not null,
    p.supplier_id, s.name, s.archived_at is not null,
    p.amount, p.paid_amount, (p.amount - p.paid_amount),
    p.status,
    case
      when p.status in ('open', 'partially_paid') and p.due_date < v_today then 'overdue'
      else p.status
    end,
    case
      when p.status not in ('open', 'partially_paid') then null
      when p.due_date < v_today then 'overdue'
      when p.due_date = v_today then 'due_today'
      when p.due_date <= v_today + 7 then 'due_soon'
      else null
    end,
    p.due_date, p.competence_date, p.document_number, p.notes,
    p.series_id, p.series_position,
    ps.series_type, ps.periodicity,
    (select count(*)::integer from public.payables sp where sp.series_id = p.series_id),
    (
      select ps.series_type = 'recurring'
        and last_p.status <> 'cancelled'
        and last_p.due_date <= v_today + 60
      from public.payables last_p
      where last_p.series_id = p.series_id
      order by last_p.series_position desc
      limit 1
    ),
    (
      select last_p.due_date
      from public.payables last_p
      where last_p.series_id = p.series_id
      order by last_p.series_position desc
      limit 1
    ),
    p.created_at, p.created_by, cu.name,
    p.updated_at, p.updated_by, uu.name,
    p.cancelled_at, p.cancelled_by, xu.name,
    p.cancellation_reason
  from public.payables p
  join public.financial_categories fc on fc.tenant_id = p.tenant_id and fc.id = p.category_id
  left join public.suppliers s on s.tenant_id = p.tenant_id and s.id = p.supplier_id
  left join public.payable_series ps on ps.tenant_id = p.tenant_id and ps.id = p.series_id
  left join public.users cu on cu.id = p.created_by
  left join public.users uu on uu.id = p.updated_by
  left join public.users xu on xu.id = p.cancelled_by
  where p.id = p_payable_id
    and p.tenant_id = v_target_tenant;

  if not found then
    raise exception 'Conta a pagar não encontrada.' using errcode = 'P0001';
  end if;
end;
$function$;

comment on function public.get_payable(uuid, uuid) is
  'Ticket 07+11+14/036: detalhe de uma Conta a Pagar, com autoria, o resumo da Série e o aviso de fim próximo (Recorrência cuja última ocorrência não está cancelada vence em até 60 dias).';

revoke all on function public.get_payable(uuid, uuid) from public, anon;
grant execute on function public.get_payable(uuid, uuid) to authenticated;
grant execute on function public.get_payable(uuid, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- preview_extend_recurring_payable_series: mesmo calculo de
-- extend_recurring_payable_series, sem gravar nada.
-- -----------------------------------------------------------------------------
create or replace function public.preview_extend_recurring_payable_series(
  p_series_id uuid,
  p_occurrences integer,
  p_tenant_id uuid default null
)
returns table (
  series_position integer,
  due_date date,
  amount numeric
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
  v_series public.payable_series%rowtype;
  v_last_amount numeric(12,2);
  v_max_position integer;
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

  select * into v_series
  from public.payable_series
  where id = p_series_id
    and tenant_id = v_target_tenant;

  if not found then
    raise exception 'Série não encontrada.' using errcode = 'P0001';
  end if;

  if v_series.series_type <> 'recurring' then
    raise exception 'Parcelamento não pode ser estendido.' using errcode = '22023';
  end if;

  if p_occurrences is null or p_occurrences < 1 or p_occurrences > 60 then
    raise exception 'A quantidade deve estar entre 1 e 60.' using errcode = '22023';
  end if;

  select sp.amount
    into v_last_amount
  from public.payables sp
  where sp.series_id = p_series_id
    and sp.status <> 'cancelled'
  order by sp.series_position desc
  limit 1;

  if not found then
    raise exception 'Não há ocorrência ativa nesta Série para basear a extensão.' using errcode = '22023';
  end if;

  select max(sp.series_position)
    into v_max_position
  from public.payables sp
  where sp.series_id = p_series_id;

  return query
  select
    v_max_position + i,
    private.compute_series_due_date(v_series.anchor_date, v_series.periodicity, v_max_position + i),
    v_last_amount
  from generate_series(1, p_occurrences) as i;
end;
$function$;

comment on function public.preview_extend_recurring_payable_series(uuid, integer, uuid) is
  'Ticket 14/036: prévia das novas ocorrências de uma extensão de Recorrência, mesmo cálculo de extend_recurring_payable_series, sem gravar nada.';

revoke all on function public.preview_extend_recurring_payable_series(uuid, integer, uuid) from public, anon;
grant execute on function public.preview_extend_recurring_payable_series(uuid, integer, uuid) to authenticated;
grant execute on function public.preview_extend_recurring_payable_series(uuid, integer, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- extend_recurring_payable_series: gera de 1 a 60 ocorrencias novas a partir
-- da maior posicao ja existente (contando canceladas), herdando valor,
-- categoria, fornecedor e descricao da ultima ocorrencia NAO cancelada.
-- -----------------------------------------------------------------------------
create or replace function public.extend_recurring_payable_series(
  p_series_id uuid,
  p_occurrences integer,
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
  v_series public.payable_series%rowtype;
  v_last public.payables%rowtype;
  v_max_position integer;
  v_due_date date;
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

  select * into v_series
  from public.payable_series
  where id = p_series_id
    and tenant_id = v_target_tenant
  for update;

  if not found then
    raise exception 'Série não encontrada.' using errcode = 'P0001';
  end if;

  if v_series.series_type <> 'recurring' then
    raise exception 'Parcelamento não pode ser estendido.' using errcode = '22023';
  end if;

  if p_occurrences is null or p_occurrences < 1 or p_occurrences > 60 then
    raise exception 'A quantidade deve estar entre 1 e 60.' using errcode = '22023';
  end if;

  -- Trava todas as ocorrências da Série antes de qualquer leitura de estado,
  -- mesma ordem series -> ocorrências do ticket 13/036.
  perform 1 from public.payables sp where sp.series_id = p_series_id for update;

  select * into v_last
  from public.payables sp
  where sp.series_id = p_series_id
    and sp.status <> 'cancelled'
  order by sp.series_position desc
  limit 1;

  if not found then
    raise exception 'Não há ocorrência ativa nesta Série para basear a extensão.' using errcode = '22023';
  end if;

  select max(sp.series_position)
    into v_max_position
  from public.payables sp
  where sp.series_id = p_series_id;

  for i in 1..p_occurrences loop
    v_due_date := private.compute_series_due_date(v_series.anchor_date, v_series.periodicity, v_max_position + i);
    insert into public.payables (
      tenant_id, description, category_id, supplier_id, amount, due_date, competence_date,
      series_id, series_position, created_by
    ) values (
      v_target_tenant, v_last.description, v_last.category_id, v_last.supplier_id, v_last.amount,
      v_due_date, v_due_date, p_series_id, v_max_position + i, v_user_id
    );
  end loop;

  return query
  select * from public.payables
  where series_id = p_series_id
    and series_position > v_max_position
  order by series_position;
end;
$function$;

comment on function public.extend_recurring_payable_series(uuid, integer, uuid) is
  'Ticket 14/036: estende uma Recorrência com 1 a 60 ocorrências novas, a partir da maior posição já existente, herdando valor/categoria/fornecedor/descrição da última ocorrência não cancelada. Parcelamento recusado.';

revoke all on function public.extend_recurring_payable_series(uuid, integer, uuid) from public, anon;
grant execute on function public.extend_recurring_payable_series(uuid, integer, uuid) to authenticated;
grant execute on function public.extend_recurring_payable_series(uuid, integer, uuid) to service_role;
