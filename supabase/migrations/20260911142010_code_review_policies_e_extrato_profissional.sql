-- Reaplica as policies financeiras usando os helpers privados de autenticação.
drop policy if exists cash_sessions_select_active on public.cash_sessions;
create policy cash_sessions_select_active on public.cash_sessions
for select to authenticated
using ((select private.is_saas_admin()) or tenant_id = (select private.get_auth_tenant_id()));

drop policy if exists cash_sessions_insert_active_manager on public.cash_sessions;
create policy cash_sessions_insert_active_manager on public.cash_sessions
for insert to authenticated
with check (
  (select private.is_saas_admin())
  or (
    tenant_id = (select private.get_auth_tenant_id())
    and (select private.get_auth_role()) in ('gerente', 'proprietario')
  )
);

drop policy if exists cash_sessions_update_open_manager on public.cash_sessions;
create policy cash_sessions_update_open_manager on public.cash_sessions
for update to authenticated
using (
  status = 'open'
  and ((select private.is_saas_admin()) or (
    tenant_id = (select private.get_auth_tenant_id())
    and (select private.get_auth_role()) in ('gerente', 'proprietario')
  ))
)
with check (
  status = 'open'
  and ((select private.is_saas_admin()) or (
    tenant_id = (select private.get_auth_tenant_id())
    and (select private.get_auth_role()) in ('gerente', 'proprietario')
  ))
);

drop policy if exists comandas_select_active on public.comandas;
create policy comandas_select_active on public.comandas
for select to authenticated
using ((select private.is_saas_admin()) or tenant_id = (select private.get_auth_tenant_id()));

drop policy if exists comandas_insert_active_operator on public.comandas;
create policy comandas_insert_active_operator on public.comandas
for insert to authenticated
with check (
  (select private.is_saas_admin())
  or (
    tenant_id = (select private.get_auth_tenant_id())
    and (select private.get_auth_role()) in ('barbeiro', 'gerente', 'proprietario')
  )
);

drop policy if exists comandas_update_open_operator on public.comandas;
create policy comandas_update_open_operator on public.comandas
for update to authenticated
using (
  status in ('aberta', 'open')
  and ((select private.is_saas_admin()) or (
    tenant_id = (select private.get_auth_tenant_id())
    and (select private.get_auth_role()) in ('barbeiro', 'gerente', 'proprietario')
  ))
)
with check (
  status in ('aberta', 'open', 'cancelada')
  and ((select private.is_saas_admin()) or (
    tenant_id = (select private.get_auth_tenant_id())
    and (select private.get_auth_role()) in ('barbeiro', 'gerente', 'proprietario')
  ))
);

drop policy if exists comandas_delete_open_manager on public.comandas;
create policy comandas_delete_open_manager on public.comandas
for delete to authenticated
using (
  status in ('aberta', 'open')
  and ((select private.is_saas_admin()) or (
    tenant_id = (select private.get_auth_tenant_id())
    and (select private.get_auth_role()) in ('gerente', 'proprietario')
  ))
);

drop policy if exists comanda_itens_select_active on public.comanda_itens;
create policy comanda_itens_select_active on public.comanda_itens
for select to authenticated
using ((select private.is_saas_admin()) or tenant_id = (select private.get_auth_tenant_id()));

drop policy if exists comanda_itens_insert_open_operator on public.comanda_itens;
create policy comanda_itens_insert_open_operator on public.comanda_itens
for insert to authenticated
with check (
  (select private.is_saas_admin())
  or (
    tenant_id = (select private.get_auth_tenant_id())
    and (select private.get_auth_role()) in ('barbeiro', 'gerente', 'proprietario')
    and exists (
      select 1 from public.comandas c
      where c.id = comanda_itens.comanda_id
        and c.tenant_id = comanda_itens.tenant_id
        and c.status in ('aberta', 'open')
    )
  )
);

drop policy if exists comanda_itens_update_open_operator on public.comanda_itens;
create policy comanda_itens_update_open_operator on public.comanda_itens
for update to authenticated
using (
  (select private.is_saas_admin())
  or (
    tenant_id = (select private.get_auth_tenant_id())
    and (select private.get_auth_role()) in ('barbeiro', 'gerente', 'proprietario')
    and exists (
      select 1 from public.comandas c
      where c.id = comanda_itens.comanda_id
        and c.tenant_id = comanda_itens.tenant_id
        and c.status in ('aberta', 'open')
    )
  )
)
with check (
  (select private.is_saas_admin())
  or (
    tenant_id = (select private.get_auth_tenant_id())
    and (select private.get_auth_role()) in ('barbeiro', 'gerente', 'proprietario')
    and exists (
      select 1 from public.comandas c
      where c.id = comanda_itens.comanda_id
        and c.tenant_id = comanda_itens.tenant_id
        and c.status in ('aberta', 'open')
    )
  )
);

drop policy if exists comanda_itens_delete_open_manager on public.comanda_itens;
create policy comanda_itens_delete_open_manager on public.comanda_itens
for delete to authenticated
using (
  (select private.is_saas_admin())
  or (
    tenant_id = (select private.get_auth_tenant_id())
    and (select private.get_auth_role()) in ('gerente', 'proprietario')
    and exists (
      select 1 from public.comandas c
      where c.id = comanda_itens.comanda_id
        and c.tenant_id = comanda_itens.tenant_id
        and c.status in ('aberta', 'open')
    )
  )
);

drop policy if exists comanda_pagamentos_select_active on public.comanda_pagamentos;
create policy comanda_pagamentos_select_active on public.comanda_pagamentos
for select to authenticated
using ((select private.is_saas_admin()) or tenant_id = (select private.get_auth_tenant_id()));

drop policy if exists commission_obligations_select_financial on public.commission_obligations;
create policy commission_obligations_select_financial
on public.commission_obligations for select to authenticated
using (
  (select private.is_saas_admin())
  or (
    tenant_id = (select private.get_auth_tenant_id())
    and (
      (select private.get_auth_role()) in ('gerente', 'proprietario')
      or (
        (select private.get_auth_role()) = 'barbeiro'
        and (select private.is_own_professional(professional_id))
      )
    )
  )
);

drop policy if exists commission_payout_allocations_select_financial on public.commission_payout_allocations;
create policy commission_payout_allocations_select_financial
on public.commission_payout_allocations for select to authenticated
using (
  (select private.is_saas_admin())
  or exists (
    select 1
    from public.commission_payouts cp
    where cp.id = commission_payout_allocations.payout_id
      and cp.tenant_id = (select private.get_auth_tenant_id())
      and (
        (select private.get_auth_role()) in ('gerente', 'proprietario')
        or (
          (select private.get_auth_role()) = 'barbeiro'
          and (select private.is_own_professional(cp.professional_id))
        )
      )
  )
);

drop policy if exists cash_session_adjustments_select_financial on public.cash_session_adjustments;
create policy cash_session_adjustments_select_financial
on public.cash_session_adjustments for select to authenticated
using (
  (select private.is_saas_admin())
  or (
    tenant_id = (select private.get_auth_tenant_id())
    and (select private.get_auth_role()) in ('gerente', 'proprietario')
  )
);

-- O profissional pode consultar somente o próprio extrato; gestores mantêm a consulta ampla.
create or replace function public.get_professional_commission_balance(
  p_professional_id uuid,
  p_start_date timestamptz default null,
  p_end_date timestamptz default null,
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_open_ledger numeric := 0;
  v_generated_ledger numeric := 0;
  v_legacy_generated numeric := 0;
  v_legacy_generated_period numeric := 0;
  v_legacy_paid numeric := 0;
  v_paid_period numeric := 0;
  v_start timestamptz := coalesce(p_start_date, '-infinity'::timestamptz);
  v_end timestamptz := coalesce(p_end_date, 'infinity'::timestamptz);
begin
  select role, tenant_id into v_user_role, v_user_tenant
  from public.users where id = v_user_id and is_active = true;
  if v_user_role is null then
    raise exception 'Acesso negado para consultar comissoes.' using errcode = '42501';
  end if;

  if v_user_role = 'barbeiro' then
    select p.tenant_id into v_target_tenant
    from public.professionals p
    where p.id = p_professional_id
      and p.user_id = v_user_id
      and p.is_active = true
      and p.deleted_at is null;
    if not found or (p_tenant_id is not null and v_target_tenant <> p_tenant_id) then
      raise exception 'Acesso negado para este extrato.' using errcode = '42501';
    end if;
  elsif v_user_role in ('gerente', 'proprietario') then
    if p_tenant_id is not null then
      if v_user_role <> 'proprietario' and v_user_tenant <> p_tenant_id then
        raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
      end if;
      v_target_tenant := p_tenant_id;
    else
      v_target_tenant := v_user_tenant;
    end if;
  else
    raise exception 'Acesso negado para consultar comissoes.' using errcode = '42501';
  end if;
  if v_target_tenant is null then
    raise exception 'Unidade nao informada.' using errcode = '22023';
  end if;

  select coalesce(sum(greatest(0, o.amount - o.settled_amount)), 0)
    into v_open_ledger
  from public.commission_obligations o
  where o.tenant_id = v_target_tenant
    and o.professional_id = p_professional_id
    and o.status in ('open', 'partially_paid');

  select coalesce(sum(o.amount), 0)
    into v_generated_ledger
  from public.commission_obligations o
  where o.tenant_id = v_target_tenant
    and o.professional_id = p_professional_id
    and o.status <> 'reversed'
    and o.created_at >= v_start and o.created_at <= v_end;

  with legacy_items as (
    select ci.total_price, c.closed_at,
      case
        when ci.snapshot_status in ('confirmed', 'estimated')
         and ci.snapshot_commission_amount is not null
          then ci.snapshot_commission_amount
        else 0
      end as commission_amount
    from public.comanda_itens ci
    join public.comandas c on c.id = ci.comanda_id
    where c.tenant_id = v_target_tenant
      and c.status in ('fechada', 'closed')
      and ci.professional_id = p_professional_id
      and not exists (select 1 from public.commission_obligations o where o.comanda_item_id = ci.id)
  )
  select coalesce(sum(commission_amount), 0),
         coalesce(sum(commission_amount) filter (where closed_at >= v_start and closed_at <= v_end), 0)
    into v_legacy_generated, v_legacy_generated_period
  from legacy_items;

  select coalesce(sum(
    case
      when exists (select 1 from public.commission_payout_allocations a where a.payout_id = cp.id)
        then coalesce(cp.legacy_allocated_amount, 0)
      else cp.amount
    end
  ), 0) into v_legacy_paid
  from public.commission_payouts cp
  where cp.tenant_id = v_target_tenant
    and cp.professional_id = p_professional_id;

  select coalesce(sum(cp.amount), 0) into v_paid_period
  from public.commission_payouts cp
  where cp.tenant_id = v_target_tenant
    and cp.professional_id = p_professional_id
    and cp.paid_at >= v_start and cp.paid_at <= v_end;

  return jsonb_build_object(
    'current_open_balance', v_open_ledger + greatest(0, v_legacy_generated - v_legacy_paid),
    'generated_commission', v_generated_ledger + v_legacy_generated_period,
    'paid_commission', v_paid_period
  );
end;
$$;

revoke all on function public.get_professional_commission_balance(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.get_professional_commission_balance(uuid, timestamptz, timestamptz, uuid) to authenticated;
