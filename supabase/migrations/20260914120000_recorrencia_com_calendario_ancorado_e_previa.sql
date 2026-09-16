-- Ticket 11 da spec 036 (Contas a Pagar): tabela de Serie, calendario ancorado
-- calculado num unico lugar no servidor, previa e criacao de Recorrencia.
-- Spec: specs/036-contas-a-pagar/spec.md, secao "Entrega 3 -- Serie:
-- Parcelamento e Recorrencia".
--
-- As ocorrencias sao materializadas na criacao, sem motor de regra. O
-- calendario (private.compute_series_due_date) e compartilhado pela previa e
-- pela criacao, e sera reusado pelo Parcelamento no ticket 12/036.
--
-- Serie e tabela minima: tipo, periodicidade, ancora, valor informado na
-- criacao, autor e momento -- exatamente o que a spec lista. Descricao,
-- categoria, fornecedor, documento e observacao vivem só em cada ocorrencia
-- (public.payables), nunca duplicados na Serie.

create table if not exists public.payable_series (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  series_type text not null,
  periodicity text not null,
  anchor_date date not null,
  amount numeric(12,2) not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  created_by uuid references public.users(id) on delete set null,
  constraint payable_series_series_type_check check (series_type in ('installment', 'recurring')),
  constraint payable_series_periodicity_check check (periodicity in ('weekly', 'biweekly', 'monthly', 'yearly')),
  constraint payable_series_amount_check check (amount > 0)
);

comment on table public.payable_series is
  'Ticket 11/036: Serie (Parcelamento ou Recorrencia). So tipo, periodicidade, ancora, valor, autor e momento -- descricao/categoria/fornecedor vivem em cada ocorrencia (public.payables), nunca duplicados aqui.';
comment on column public.payable_series.anchor_date is
  'Vencimento da primeira ocorrencia (posicao 1). Todo deslocamento de calendario e calculado a partir dela, nunca da ocorrencia anterior.';
comment on column public.payable_series.amount is
  'Valor informado na criacao: por ocorrencia na Recorrencia, total da compra no Parcelamento (ticket 12/036).';

alter table public.payable_series
  add constraint payable_series_tenant_id_key unique (tenant_id, id);

create index if not exists idx_payable_series_created_by on public.payable_series (created_by);

revoke all on table public.payable_series from anon;
grant select on table public.payable_series to authenticated;
revoke insert, update, delete on table public.payable_series from authenticated;

alter table public.payable_series enable row level security;

drop policy if exists payable_series_select_policy on public.payable_series;
create policy payable_series_select_policy
  on public.payable_series for select to authenticated
  using (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) in ('gerente', 'proprietario')
    )
  );

-- Chave estrangeira das colunas de Serie da Conta a Pagar, criadas sempre
-- nulas no ticket 06/036. Posicao unica dentro da Serie.
alter table public.payables
  add constraint payables_series_fk
  foreign key (tenant_id, series_id)
  references public.payable_series (tenant_id, id);

create unique index if not exists idx_payables_series_position_unique
  on public.payables (series_id, series_position)
  where series_id is not null;

-- -----------------------------------------------------------------------------
-- private.compute_series_due_date: calendario ancorado, unico lugar no
-- servidor. A ocorrencia de posicao i vence na ancora deslocada (i-1)
-- periodos -- nunca a partir da ocorrencia anterior.
-- -----------------------------------------------------------------------------
create or replace function private.compute_series_due_date(
  p_anchor date,
  p_periodicity text,
  p_position integer
)
returns date
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_offset_months integer;
  v_total_months integer;
  v_target_year integer;
  v_target_month integer;
  v_last_day integer;
  v_day integer;
begin
  if p_periodicity = 'weekly' then
    return p_anchor + ((p_position - 1) * 7);
  elsif p_periodicity = 'biweekly' then
    return p_anchor + ((p_position - 1) * 14);
  elsif p_periodicity in ('monthly', 'yearly') then
    v_offset_months := case when p_periodicity = 'monthly' then (p_position - 1) else (p_position - 1) * 12 end;
    v_total_months := (extract(year from p_anchor)::integer * 12 + extract(month from p_anchor)::integer - 1) + v_offset_months;
    v_target_year := v_total_months / 12;
    v_target_month := (v_total_months % 12) + 1;
    v_last_day := extract(day from ((make_date(v_target_year, v_target_month, 1) + interval '1 month - 1 day')::date))::integer;
    v_day := least(extract(day from p_anchor)::integer, v_last_day);
    return make_date(v_target_year, v_target_month, v_day);
  else
    raise exception 'Periodicidade inválida.' using errcode = '22023';
  end if;
end;
$function$;

comment on function private.compute_series_due_date(date, text, integer) is
  'Ticket 11/036: calendario ancorado unico no servidor, compartilhado pela previa e pela criacao. Mensal/anual limitam ao ultimo dia do mes-alvo, sem nunca partir da ocorrencia anterior.';

revoke all on function private.compute_series_due_date(date, text, integer) from public, anon, authenticated;
grant execute on function private.compute_series_due_date(date, text, integer) to service_role;

-- -----------------------------------------------------------------------------
-- preview_payable_series: previa de datas e valores, mesmo calculo da
-- criacao. Recorrencia (ticket 11) e Parcelamento (ticket 12) num so
-- contrato, para a assinatura ja nascer completa.
-- -----------------------------------------------------------------------------
create or replace function public.preview_payable_series(
  p_series_type text,
  p_periodicity text,
  p_anchor_date date,
  p_occurrences integer,
  p_amount numeric,
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
  v_amount numeric(12,2);
  v_share numeric(12,2);
  v_last_share numeric(12,2);
  v_min_occurrences integer;
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

  if p_series_type not in ('installment', 'recurring') then
    raise exception 'Tipo de Série inválido.' using errcode = '22023';
  end if;
  if p_periodicity not in ('weekly', 'biweekly', 'monthly', 'yearly') then
    raise exception 'Periodicidade inválida.' using errcode = '22023';
  end if;
  if p_anchor_date is null then
    raise exception 'Data âncora é obrigatória.' using errcode = '22023';
  end if;

  v_min_occurrences := case when p_series_type = 'installment' then 2 else 1 end;
  if p_occurrences is null or p_occurrences < v_min_occurrences or p_occurrences > 60 then
    if p_series_type = 'installment' then
      raise exception 'A quantidade deve estar entre 2 e 60.' using errcode = '22023';
    else
      raise exception 'A quantidade deve estar entre 1 e 60.' using errcode = '22023';
    end if;
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'O valor deve ser maior que zero.' using errcode = '22023';
  end if;
  v_amount := round(p_amount::numeric, 2);

  if p_series_type = 'installment' then
    v_share := trunc(v_amount / p_occurrences, 2);
    v_last_share := v_amount - (v_share * (p_occurrences - 1));
  else
    v_share := v_amount;
    v_last_share := v_amount;
  end if;

  return query
  select
    i,
    private.compute_series_due_date(p_anchor_date, p_periodicity, i),
    case when i = p_occurrences then v_last_share else v_share end
  from generate_series(1, p_occurrences) as i
  order by i;
end;
$function$;

comment on function public.preview_payable_series(text, text, date, integer, numeric, uuid) is
  'Ticket 11/036: previa de datas e valores da Serie, mesmo calculo usado na criacao (private.compute_series_due_date).';

revoke all on function public.preview_payable_series(text, text, date, integer, numeric, uuid) from public, anon;
grant execute on function public.preview_payable_series(text, text, date, integer, numeric, uuid) to authenticated;
grant execute on function public.preview_payable_series(text, text, date, integer, numeric, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- create_recurring_payable_series: gera de 1 a 60 ocorrencias com o mesmo
-- valor, cada uma com o proprio vencimento como competencia.
-- -----------------------------------------------------------------------------
create or replace function public.create_recurring_payable_series(
  p_description text,
  p_category_id uuid,
  p_periodicity text,
  p_anchor_date date,
  p_occurrences integer,
  p_amount numeric,
  p_supplier_id uuid default null,
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
  v_document_number text;
  v_notes text;
  v_category_active boolean;
  v_supplier_active boolean;
  v_series_id uuid;
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
  if p_occurrences is null or p_occurrences < 1 or p_occurrences > 60 then
    raise exception 'A quantidade deve estar entre 1 e 60.' using errcode = '22023';
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

  insert into public.payable_series (tenant_id, series_type, periodicity, anchor_date, amount, created_by)
  values (v_target_tenant, 'recurring', p_periodicity, p_anchor_date, v_amount, v_user_id)
  returning id into v_series_id;

  for i in 1..p_occurrences loop
    v_due_date := private.compute_series_due_date(p_anchor_date, p_periodicity, i);
    insert into public.payables (
      tenant_id, description, category_id, supplier_id, amount, due_date, competence_date,
      document_number, notes, series_id, series_position, created_by
    ) values (
      v_target_tenant, v_description, p_category_id, p_supplier_id, v_amount, v_due_date, v_due_date,
      v_document_number, v_notes, v_series_id, i, v_user_id
    );
  end loop;

  return query
  select * from public.payables where series_id = v_series_id order by series_position;
end;
$function$;

comment on function public.create_recurring_payable_series(text, uuid, text, date, integer, numeric, uuid, text, text, uuid) is
  'Ticket 11/036: cria uma Recorrência (1 a 60 ocorrências, mesmo valor, cada uma com o próprio vencimento como competência).';

revoke all on function public.create_recurring_payable_series(text, uuid, text, date, integer, numeric, uuid, text, text, uuid) from public, anon;
grant execute on function public.create_recurring_payable_series(text, uuid, text, date, integer, numeric, uuid, text, text, uuid) to authenticated;
grant execute on function public.create_recurring_payable_series(text, uuid, text, date, integer, numeric, uuid, text, text, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- get_payable: passa a devolver o resumo da Serie (ticket 11/036). Muda o
-- tipo de retorno (novas colunas), por isso e' drop + create, nao so
-- create or replace.
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
  'Ticket 07+11/036: detalhe de uma Conta a Pagar, com autoria e o resumo da Série (tipo, periodicidade, total de ocorrências) quando a conta pertence a uma.';

revoke all on function public.get_payable(uuid, uuid) from public, anon;
grant execute on function public.get_payable(uuid, uuid) to authenticated;
grant execute on function public.get_payable(uuid, uuid) to service_role;
