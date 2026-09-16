-- Ticket 13: ajustes sao eventos imutaveis e nao alteram a fotografia original.
create table if not exists public.cash_session_adjustments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cash_session_id uuid not null references public.cash_sessions(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  reason text not null,
  original_expected_amount numeric(10,2) not null,
  original_closing_amount numeric(10,2) not null,
  original_difference_amount numeric(10,2) not null,
  adjustment_amount numeric(10,2) not null check (adjustment_amount <> 0),
  adjusted_expected_amount numeric(10,2) not null,
  adjusted_closing_amount numeric(10,2) not null,
  adjusted_difference_amount numeric(10,2) not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint cash_session_adjustments_reason_check check (length(btrim(reason)) >= 5)
);

create index if not exists idx_cash_session_adjustments_tenant on public.cash_session_adjustments (tenant_id, created_at desc);
create index if not exists idx_cash_session_adjustments_session on public.cash_session_adjustments (cash_session_id, created_at desc);

alter table public.cash_session_adjustments enable row level security;
drop policy if exists cash_session_adjustments_select_financial on public.cash_session_adjustments;
create policy cash_session_adjustments_select_financial
on public.cash_session_adjustments for select to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.is_active = true
      and u.role in ('gerente', 'proprietario')
      and (u.role = 'proprietario' or u.tenant_id = cash_session_adjustments.tenant_id)
  )
);

revoke all on table public.cash_session_adjustments from public, anon, authenticated;
grant select on table public.cash_session_adjustments to authenticated;

create or replace function public.register_cash_session_adjustment(
  p_session_id uuid,
  p_tenant_id uuid,
  p_adjustment_amount numeric,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_user_role text;
  v_user_tenant uuid;
  v_session public.cash_sessions%rowtype;
  v_adjustment_id uuid;
  v_adjusted_expected numeric;
  v_adjusted_closing numeric;
  v_adjusted_difference numeric;
begin
  select role, tenant_id into v_user_role, v_user_tenant
  from public.users where id = v_user_id and is_active = true;
  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado para ajustar o caixa.' using errcode = '42501';
  end if;
  if p_tenant_id is null or p_session_id is null or p_adjustment_amount is null or p_adjustment_amount = 0 then
    raise exception 'Sessao, unidade e ajuste valido sao obrigatorios.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Informe uma justificativa com pelo menos cinco caracteres.' using errcode = '22023';
  end if;
  if v_user_role <> 'proprietario' and v_user_tenant <> p_tenant_id then
    raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
  end if;

  select * into v_session from public.cash_sessions
  where id = p_session_id and tenant_id = p_tenant_id for update;
  if not found or v_session.status <> 'closed' then
    raise exception 'A sessao de caixa precisa estar fechada.' using errcode = 'P0001';
  end if;
  if v_session.expected_amount is null or v_session.closing_amount is null or v_session.difference_amount is null then
    raise exception 'A sessao nao possui fotografia financeira completa.' using errcode = 'P0001';
  end if;

  v_adjusted_expected := v_session.expected_amount;
  v_adjusted_closing := round(v_session.closing_amount + p_adjustment_amount, 2);
  v_adjusted_difference := round(v_adjusted_closing - v_adjusted_expected, 2);

  insert into public.cash_session_adjustments (
    tenant_id, cash_session_id, created_by, reason,
    original_expected_amount, original_closing_amount, original_difference_amount,
    adjustment_amount, adjusted_expected_amount, adjusted_closing_amount, adjusted_difference_amount
  ) values (
    p_tenant_id, p_session_id, v_user_id, btrim(p_reason),
    v_session.expected_amount, v_session.closing_amount, v_session.difference_amount,
    round(p_adjustment_amount, 2), v_adjusted_expected, v_adjusted_closing, v_adjusted_difference
  ) returning id into v_adjustment_id;

  return jsonb_build_object(
    'success', true,
    'adjustment_id', v_adjustment_id,
    'cash_session_id', p_session_id,
    'original_expected_amount', v_session.expected_amount,
    'original_closing_amount', v_session.closing_amount,
    'original_difference_amount', v_session.difference_amount,
    'adjusted_closing_amount', v_adjusted_closing,
    'adjusted_difference_amount', v_adjusted_difference
  );
end;
$$;

revoke all on function public.register_cash_session_adjustment(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.register_cash_session_adjustment(uuid, uuid, numeric, text) to authenticated;

