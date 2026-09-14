-- Ticket 07 da spec 036 (Contas a Pagar): Baixa fora do caixa e Estorno de Baixa.
-- Spec: specs/036-contas-a-pagar/spec.md, secao "Entrega 2 -- Livro de Contas a
-- Pagar" (Baixa, Estorno de Baixa, ordem de lock, leitura de detalhe).
--
-- O contrato de Baixa nasce completo (parametros de origem e de Sessao de
-- Caixa ja existem), mas a origem gaveta e recusada com mensagem explicita
-- ate o ticket 15/036 (Entrega 4) -- mesmo arranjo da 034 com o credito de
-- gorjeta na quitacao, poupando a troca de assinatura depois.
--
-- Ordem de lock fixa: Conta a Pagar antes da Sessao de Caixa (nao usada ainda
-- nesta entrega, mas a ordem ja vale para nao formar ciclo com Quitacao de
-- Comissao/vale/fechamento quando o ticket 15 acrescentar a gaveta).

create table if not exists public.payable_settlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payable_id uuid not null,
  principal numeric(12,2) not null,
  interest_amount numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  paid_amount numeric(12,2) generated always as (principal + interest_amount - discount_amount) stored,
  payment_date date not null,
  payment_method text not null,
  source text not null default 'fora_do_caixa',
  cash_session_id uuid references public.cash_sessions(id),
  cash_movement_id uuid references public.cash_movements(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  created_by uuid references public.users(id) on delete set null,
  reversed_at timestamptz,
  reversed_by uuid references public.users(id) on delete set null,
  reversal_reason text,
  constraint payable_settlements_principal_check check (principal > 0),
  constraint payable_settlements_interest_check check (interest_amount >= 0),
  constraint payable_settlements_discount_check
    check (discount_amount >= 0 and discount_amount <= principal + interest_amount),
  constraint payable_settlements_payment_method_check check (
    payment_method in (
      'cash', 'pix', 'transfer', 'boleto', 'credit_card', 'debit_card', 'automatic_debit', 'other'
    )
  ),
  constraint payable_settlements_source_check check (source in ('gaveta', 'fora_do_caixa')),
  constraint payable_settlements_drawer_link_check check (
    (source = 'gaveta') = (cash_session_id is not null)
    and (source = 'gaveta') = (cash_movement_id is not null)
  ),
  constraint payable_settlements_reversal_trail_check check (
    (reversed_at is null) = (reversed_by is null)
    and (reversed_at is null) = (reversal_reason is null)
  )
);

comment on table public.payable_settlements is
  'Ticket 07/036: Baixa de Conta a Pagar, varias por conta. Origem gaveta recusada pela RPC ate o ticket 15/036 (Entrega 4), embora as colunas de vinculo com a gaveta ja existam.';
comment on column public.payable_settlements.paid_amount is
  'Coluna gerada (principal + juros - desconto): o dinheiro que efetivamente saiu. Fonte unica para o fluxo de caixa da spec 037.';

alter table public.payable_settlements
  add constraint payable_settlements_payable_fk
  foreign key (tenant_id, payable_id)
  references public.payables (tenant_id, id);

create index if not exists idx_payable_settlements_payable_id on public.payable_settlements (payable_id);
create index if not exists idx_payable_settlements_cash_session_id on public.payable_settlements (cash_session_id) where cash_session_id is not null;
create index if not exists idx_payable_settlements_cash_movement_id on public.payable_settlements (cash_movement_id) where cash_movement_id is not null;
create index if not exists idx_payable_settlements_created_by on public.payable_settlements (created_by);
create index if not exists idx_payable_settlements_reversed_by on public.payable_settlements (reversed_by);

create index if not exists idx_payable_settlements_tenant_payment_date_active
  on public.payable_settlements (tenant_id, payment_date)
  where reversed_at is null;

revoke all on table public.payable_settlements from anon;
grant select on table public.payable_settlements to authenticated;
revoke insert, update, delete on table public.payable_settlements from authenticated;

alter table public.payable_settlements enable row level security;

drop policy if exists payable_settlements_select_policy on public.payable_settlements;
create policy payable_settlements_select_policy
  on public.payable_settlements for select to authenticated
  using (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) in ('gerente', 'proprietario')
    )
  );

-- -----------------------------------------------------------------------------
-- settle_payable: registra uma Baixa (parcial ou total) fora do caixa.
-- -----------------------------------------------------------------------------
create or replace function public.settle_payable(
  p_payable_id uuid,
  p_principal numeric,
  p_payment_date date,
  p_payment_method text,
  p_interest_amount numeric default 0,
  p_discount_amount numeric default 0,
  p_source text default 'fora_do_caixa',
  p_cash_session_id uuid default null,
  p_tenant_id uuid default null
)
returns public.payable_settlements
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
  v_payable public.payables%rowtype;
  v_source text;
  v_payment_method text;
  v_principal numeric(12,2);
  v_interest numeric(12,2);
  v_discount numeric(12,2);
  v_paid_amount numeric(12,2);
  v_remaining numeric(12,2);
  v_new_paid_amount numeric(12,2);
  v_new_status text;
  v_settlement public.payable_settlements%rowtype;
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
    raise exception 'Acesso negado para dar Baixa em Contas a Pagar.' using errcode = '42501';
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

  -- Ordem de lock fixa: Conta a Pagar antes da Sessão de Caixa.
  select * into v_payable
  from public.payables
  where id = p_payable_id
    and tenant_id = v_target_tenant
  for update;

  if not found then
    raise exception 'Conta a pagar não encontrada.' using errcode = 'P0001';
  end if;

  if v_payable.status not in ('open', 'partially_paid') then
    raise exception 'Só é possível dar Baixa numa conta em aberto ou parcialmente paga.' using errcode = 'P0001';
  end if;

  v_source := lower(btrim(coalesce(p_source, 'fora_do_caixa')));
  if v_source not in ('gaveta', 'fora_do_caixa') then
    raise exception 'Origem do dinheiro inválida.' using errcode = '22023';
  end if;
  if v_source = 'gaveta' then
    raise exception 'Baixa pela gaveta ainda não está disponível.' using errcode = '22023';
  end if;
  if p_cash_session_id is not null then
    raise exception 'Sessão de caixa só pode ser informada para Baixa pela gaveta.' using errcode = '22023';
  end if;

  v_payment_method := lower(btrim(coalesce(p_payment_method, '')));
  if v_payment_method not in (
    'cash', 'pix', 'transfer', 'boleto', 'credit_card', 'debit_card', 'automatic_debit', 'other'
  ) then
    raise exception 'Forma de pagamento inválida.' using errcode = '22023';
  end if;

  if p_principal is null then
    raise exception 'Principal é obrigatório.' using errcode = '22023';
  end if;
  v_principal := round(p_principal::numeric, 2);
  if v_principal <= 0 then
    raise exception 'O principal deve ser maior que zero.' using errcode = '22023';
  end if;

  v_remaining := round(v_payable.amount - v_payable.paid_amount, 2);
  if v_principal > v_remaining then
    raise exception 'O principal não pode exceder o saldo restante da conta.' using errcode = '22023';
  end if;

  v_interest := round(coalesce(p_interest_amount, 0)::numeric, 2);
  if v_interest < 0 then
    raise exception 'Juros e multa não podem ser negativos.' using errcode = '22023';
  end if;

  v_discount := round(coalesce(p_discount_amount, 0)::numeric, 2);
  if v_discount < 0 then
    raise exception 'O desconto não pode ser negativo.' using errcode = '22023';
  end if;
  if v_discount > v_principal + v_interest then
    raise exception 'O desconto não pode exceder o principal mais os juros.' using errcode = '22023';
  end if;

  select coalesce(t.timezone, 'America/Sao_Paulo')
    into v_timezone
  from public.tenants t
  where t.id = v_target_tenant;

  v_today := (now() at time zone v_timezone)::date;

  if p_payment_date is null then
    raise exception 'Data do pagamento é obrigatória.' using errcode = '22023';
  end if;
  if p_payment_date > v_today then
    raise exception 'A data do pagamento não pode estar no futuro.' using errcode = '22023';
  end if;

  v_paid_amount := v_principal + v_interest - v_discount;
  -- Valor pago zero só é aceito fora do caixa (abatimento concedido pelo fornecedor).

  insert into public.payable_settlements (
    tenant_id, payable_id, principal, interest_amount, discount_amount,
    payment_date, payment_method, source, created_by
  ) values (
    v_target_tenant, p_payable_id, v_principal, v_interest, v_discount,
    p_payment_date, v_payment_method, v_source, v_user_id
  ) returning * into v_settlement;

  v_new_paid_amount := round(v_payable.paid_amount + v_principal, 2);
  v_new_status := case
    when v_new_paid_amount >= v_payable.amount then 'paid'
    when v_new_paid_amount > 0 then 'partially_paid'
    else 'open'
  end;

  update public.payables
  set paid_amount = v_new_paid_amount,
      status = v_new_status,
      updated_at = timezone('utc'::text, now()),
      updated_by = v_user_id
  where id = p_payable_id;

  return v_settlement;
end;
$function$;

comment on function public.settle_payable(uuid, numeric, date, text, numeric, numeric, text, uuid, uuid) is
  'Ticket 07/036: Baixa de Conta a Pagar fora do caixa. Origem gaveta recusada com mensagem explícita até o ticket 15/036.';

revoke all on function public.settle_payable(uuid, numeric, date, text, numeric, numeric, text, uuid, uuid) from public, anon;
grant execute on function public.settle_payable(uuid, numeric, date, text, numeric, numeric, text, uuid, uuid) to authenticated;
grant execute on function public.settle_payable(uuid, numeric, date, text, numeric, numeric, text, uuid, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- reverse_payable_settlement: estorna uma Baixa, devolvendo o principal ao
-- saldo da conta. Nada e apagado.
-- -----------------------------------------------------------------------------
create or replace function public.reverse_payable_settlement(
  p_settlement_id uuid,
  p_reason text,
  p_tenant_id uuid default null
)
returns public.payable_settlements
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
  v_payable_id uuid;
  v_payable public.payables%rowtype;
  v_settlement public.payable_settlements%rowtype;
  v_new_paid_amount numeric(12,2);
  v_new_status text;
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
    raise exception 'Acesso negado para estornar Baixa.' using errcode = '42501';
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

  select payable_id into v_payable_id
  from public.payable_settlements
  where id = p_settlement_id
    and tenant_id = v_target_tenant;

  if not found then
    raise exception 'Baixa não encontrada.' using errcode = 'P0001';
  end if;

  -- Ordem de lock fixa: Conta a Pagar antes da Baixa.
  select * into v_payable
  from public.payables
  where id = v_payable_id
    and tenant_id = v_target_tenant
  for update;

  if not found then
    raise exception 'Conta a pagar não encontrada.' using errcode = 'P0001';
  end if;

  select * into v_settlement
  from public.payable_settlements
  where id = p_settlement_id
    and tenant_id = v_target_tenant
  for update;

  if v_settlement.reversed_at is not null then
    raise exception 'Esta Baixa já foi estornada.' using errcode = 'P0001';
  end if;

  update public.payable_settlements
  set reversed_at = timezone('utc'::text, now()),
      reversed_by = v_user_id,
      reversal_reason = v_reason
  where id = p_settlement_id
  returning * into v_settlement;

  v_new_paid_amount := round(v_payable.paid_amount - v_settlement.principal, 2);
  if v_new_paid_amount < 0 then
    v_new_paid_amount := 0;
  end if;
  v_new_status := case
    when v_new_paid_amount <= 0 then 'open'
    when v_new_paid_amount < v_payable.amount then 'partially_paid'
    else 'paid'
  end;

  update public.payables
  set paid_amount = v_new_paid_amount,
      status = v_new_status,
      updated_at = timezone('utc'::text, now()),
      updated_by = v_user_id
  where id = v_payable_id;

  return v_settlement;
end;
$function$;

comment on function public.reverse_payable_settlement(uuid, text, uuid) is
  'Ticket 07/036: estorna uma Baixa de Conta a Pagar, devolvendo o principal ao saldo. Nada é apagado.';

revoke all on function public.reverse_payable_settlement(uuid, text, uuid) from public, anon;
grant execute on function public.reverse_payable_settlement(uuid, text, uuid) to authenticated;
grant execute on function public.reverse_payable_settlement(uuid, text, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- get_payable: detalhe de uma unica Conta a Pagar, mesma forma de linha de
-- list_payables (situacao derivada, faixa de destaque, saldo restante).
-- -----------------------------------------------------------------------------
create or replace function public.get_payable(
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
    p.created_at, p.created_by, cu.name,
    p.updated_at, p.updated_by, uu.name,
    p.cancelled_at, p.cancelled_by, xu.name,
    p.cancellation_reason
  from public.payables p
  join public.financial_categories fc on fc.tenant_id = p.tenant_id and fc.id = p.category_id
  left join public.suppliers s on s.tenant_id = p.tenant_id and s.id = p.supplier_id
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
  'Ticket 07/036: detalhe de uma Conta a Pagar, mesma forma de linha de list_payables, com nomes de autor.';

revoke all on function public.get_payable(uuid, uuid) from public, anon;
grant execute on function public.get_payable(uuid, uuid) to authenticated;
grant execute on function public.get_payable(uuid, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- list_payable_settlements: Baixas de uma Conta a Pagar, com autor e trilha
-- de estorno.
-- -----------------------------------------------------------------------------
create or replace function public.list_payable_settlements(
  p_payable_id uuid,
  p_tenant_id uuid default null
)
returns table (
  id uuid,
  principal numeric,
  interest_amount numeric,
  discount_amount numeric,
  paid_amount numeric,
  payment_date date,
  payment_method text,
  source text,
  created_at timestamptz,
  created_by uuid,
  created_by_name text,
  reversed_at timestamptz,
  reversed_by uuid,
  reversed_by_name text,
  reversal_reason text
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
  v_payable_tenant uuid;
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

  select p.tenant_id into v_payable_tenant
  from public.payables p
  where p.id = p_payable_id;

  if not found or v_payable_tenant is distinct from v_target_tenant then
    raise exception 'Conta a pagar não encontrada.' using errcode = 'P0001';
  end if;

  return query
  select
    ps.id, ps.principal, ps.interest_amount, ps.discount_amount, ps.paid_amount,
    ps.payment_date, ps.payment_method, ps.source,
    ps.created_at, ps.created_by, cu.name,
    ps.reversed_at, ps.reversed_by, ru.name, ps.reversal_reason
  from public.payable_settlements ps
  left join public.users cu on cu.id = ps.created_by
  left join public.users ru on ru.id = ps.reversed_by
  where ps.payable_id = p_payable_id
    and ps.tenant_id = v_target_tenant
  order by ps.created_at asc, ps.id asc;
end;
$function$;

comment on function public.list_payable_settlements(uuid, uuid) is
  'Ticket 07/036: lista as Baixas de uma Conta a Pagar, com autor e trilha de estorno.';

revoke all on function public.list_payable_settlements(uuid, uuid) from public, anon;
grant execute on function public.list_payable_settlements(uuid, uuid) to authenticated;
grant execute on function public.list_payable_settlements(uuid, uuid) to service_role;
