-- Ticket 05 (spec 033): reabertura de Sessao de Caixa encerrada por engano.
-- A fotografia do fechamento anterior e preservada em tabela de auditoria
-- antes de a sessao voltar a 'open'; a transicao de estado continua sendo
-- exclusiva da funcao definidora (nao ha escrita direta do cliente).

create table if not exists public.cash_session_reopenings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cash_session_id uuid not null references public.cash_sessions(id) on delete cascade,
  reopened_by uuid references public.users(id) on delete set null,
  reopened_at timestamptz not null default timezone('utc'::text, now()),
  reason text not null check (length(btrim(reason)) >= 5),
  original_closing_amount numeric,
  original_expected_amount numeric,
  original_difference_amount numeric,
  original_cash_received_amount numeric,
  original_pix_received_amount numeric,
  original_card_received_amount numeric,
  original_other_received_amount numeric,
  original_payment_count integer,
  original_supplies_amount numeric,
  original_withdrawals_amount numeric,
  original_calculation_version text,
  original_closed_by uuid,
  original_closed_at timestamptz,
  original_notes text
);

create index if not exists idx_cash_session_reopenings_session
  on public.cash_session_reopenings (cash_session_id, reopened_at desc);
create index if not exists idx_cash_session_reopenings_tenant
  on public.cash_session_reopenings (tenant_id, reopened_at desc);

alter table public.cash_session_reopenings enable row level security;

drop policy if exists cash_session_reopenings_select_financial on public.cash_session_reopenings;
create policy cash_session_reopenings_select_financial
  on public.cash_session_reopenings
  for select
  to authenticated
  using (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) = any (array['gerente', 'proprietario'])
    )
  );

-- Nenhuma escrita direta: apenas a funcao SECURITY DEFINER grava esta tabela.
revoke all on public.cash_session_reopenings from public, anon, authenticated;
grant select on public.cash_session_reopenings to authenticated;

create or replace function public.reopen_cash_session(
  p_session_id uuid,
  p_tenant_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_session public.cash_sessions%rowtype;
  v_result jsonb;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  select role, tenant_id
    into v_user_role, v_user_tenant
  from public.users
  where id = v_user_id
    and is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado para reabrir o caixa.' using errcode = '42501';
  end if;

  if p_session_id is null or p_tenant_id is null then
    raise exception 'Sessao e unidade sao obrigatorias.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Informe uma justificativa com pelo menos cinco caracteres.' using errcode = '22023';
  end if;
  if v_user_role <> 'proprietario' and v_user_tenant <> p_tenant_id then
    raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
  end if;

  select * into v_session
  from public.cash_sessions
  where id = p_session_id and tenant_id = p_tenant_id
  for update;

  if not found or v_session.status <> 'closed' then
    raise exception 'A sessao de caixa nao esta fechada ou nao existe.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.cash_sessions
    where tenant_id = p_tenant_id and status = 'open'
  ) then
    raise exception 'Ja existe uma sessao de caixa aberta para esta unidade.' using errcode = 'P0001';
  end if;

  insert into public.cash_session_reopenings (
    tenant_id, cash_session_id, reopened_by, reason,
    original_closing_amount, original_expected_amount, original_difference_amount,
    original_cash_received_amount, original_pix_received_amount, original_card_received_amount,
    original_other_received_amount, original_payment_count, original_supplies_amount,
    original_withdrawals_amount, original_calculation_version, original_closed_by,
    original_closed_at, original_notes
  ) values (
    p_tenant_id, p_session_id, v_user_id, btrim(p_reason),
    v_session.closing_amount, v_session.expected_amount, v_session.difference_amount,
    v_session.cash_received_amount, v_session.pix_received_amount, v_session.card_received_amount,
    v_session.other_received_amount, v_session.payment_count, v_session.supplies_amount,
    v_session.withdrawals_amount, v_session.calculation_version, v_session.closed_by,
    v_session.closed_at, v_session.notes
  );

  update public.cash_sessions
  set status = 'open',
      closing_amount = null,
      expected_amount = null,
      difference_amount = null,
      cash_received_amount = null,
      pix_received_amount = null,
      card_received_amount = null,
      other_received_amount = null,
      payment_count = null,
      supplies_amount = null,
      withdrawals_amount = null,
      calculation_version = null,
      closed_by = null,
      closed_at = null,
      notes = null
  where id = p_session_id and tenant_id = p_tenant_id
  returning * into v_session;

  select to_jsonb(v_session) into v_result;
  return v_result;
end;
$function$;

revoke all on function public.reopen_cash_session(uuid, uuid, text) from public;
revoke all on function public.reopen_cash_session(uuid, uuid, text) from anon;
grant execute on function public.reopen_cash_session(uuid, uuid, text) to authenticated;
grant execute on function public.reopen_cash_session(uuid, uuid, text) to service_role;
