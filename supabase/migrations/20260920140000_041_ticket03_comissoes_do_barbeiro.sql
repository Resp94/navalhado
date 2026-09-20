-- Spec 041, ticket 03: Minhas Comissoes do barbeiro pelo valor gravado.
--
-- 1. get_professional_commission_items: extrato por item das comissoes geradas no periodo, pela
--    mesma fonte e pelo mesmo recorte do saldo (obrigacoes nao estornadas por created_at + itens
--    legados sem obrigacao por closed_at), de modo que a soma dos itens bate com
--    get_professional_commission_balance.generated_commission. O barbeiro so enxerga o proprio
--    profissional; gerente e proprietario seguem as regras de unidade do saldo.
-- 2. O saldo e o extrato da conta passam a recusar o barbeiro cujo cadastro de profissional e de
--    outra barbearia (vinculo cruzado): a unidade do usuario tem de ser a do profissional.
-- 3. O barbeiro so le os Itens de Comanda dele: o snapshot de comissao dos colegas deixa de ser
--    legivel por ele. Gerente, proprietario e admin SaaS nao mudam.

create or replace function public.get_professional_commission_balance(
  p_professional_id uuid,
  p_start_date timestamptz default null,
  p_end_date timestamptz default null,
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
  v_advances_open_amount numeric := 0;
  v_credits_open_amount numeric := 0;
  v_suggested_net_amount numeric := 0;
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
      and p.tenant_id = v_user_tenant
      and p.is_active = true
      and p.deleted_at is null;
    if not found or (p_tenant_id is not null and v_target_tenant is distinct from p_tenant_id) then
      raise exception 'Acesso negado para este extrato.' using errcode = '42501';
    end if;
  elsif v_user_role in ('gerente', 'proprietario') then
    if p_tenant_id is not null then
      if v_user_role <> 'proprietario' and v_user_tenant is distinct from p_tenant_id then
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
    and cp.professional_id = p_professional_id
    and cp.reversed_at is null;

  select coalesce(sum(cp.amount), 0) into v_paid_period
  from public.commission_payouts cp
  where cp.tenant_id = v_target_tenant
    and cp.professional_id = p_professional_id
    and cp.reversed_at is null
    and cp.paid_at >= v_start and cp.paid_at <= v_end;

  select
    coalesce(sum(e.amount - e.settled_amount) filter (where e.entry_type = 'vale'), 0),
    coalesce(sum(e.amount - e.settled_amount) filter (where e.entry_type = 'gorjeta'), 0)
    into v_advances_open_amount, v_credits_open_amount
  from public.professional_account_entries e
  where e.tenant_id = v_target_tenant
    and e.professional_id = p_professional_id
    and e.status in ('open', 'partially_paid');

  v_suggested_net_amount := round(
    greatest(0, (v_open_ledger + greatest(0, v_legacy_generated - v_legacy_paid)) + v_credits_open_amount - v_advances_open_amount),
    2
  );

  return jsonb_build_object(
    'current_open_balance', v_open_ledger + greatest(0, v_legacy_generated - v_legacy_paid),
    'generated_commission', v_generated_ledger + v_legacy_generated_period,
    'paid_commission', v_paid_period,
    'advances_open_amount', round(v_advances_open_amount, 2),
    'credits_open_amount', round(v_credits_open_amount, 2),
    'suggested_net_amount', v_suggested_net_amount
  );
end;
$function$;

create or replace function public.get_professional_account_statement(
  p_professional_id uuid,
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_entries jsonb;
  v_balance jsonb;
begin
  select role, tenant_id into v_user_role, v_user_tenant
  from public.users where id = v_user_id and is_active = true;
  if v_user_role is null then
    raise exception 'Acesso negado para consultar o extrato.' using errcode = '42501';
  end if;

  if v_user_role = 'barbeiro' then
    select p.tenant_id into v_target_tenant
    from public.professionals p
    where p.id = p_professional_id
      and p.user_id = v_user_id
      and p.tenant_id = v_user_tenant
      and p.is_active = true
      and p.deleted_at is null;
    if not found or (p_tenant_id is not null and v_target_tenant is distinct from p_tenant_id) then
      raise exception 'Acesso negado para este extrato.' using errcode = '42501';
    end if;
  elsif v_user_role in ('gerente', 'proprietario') then
    if p_tenant_id is not null then
      if v_user_role <> 'proprietario' and v_user_tenant is distinct from p_tenant_id then
        raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
      end if;
      v_target_tenant := p_tenant_id;
    else
      v_target_tenant := v_user_tenant;
    end if;
  else
    raise exception 'Acesso negado para consultar o extrato.' using errcode = '42501';
  end if;

  if v_target_tenant is null then
    raise exception 'Unidade nao informada.' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(entry order by entry_created_at desc, entry_id desc), '[]'::jsonb)
    into v_entries
  from (
    select
      e.id as entry_id,
      e.created_at as entry_created_at,
      jsonb_build_object(
        'kind', e.entry_type,
        'id', e.id,
        'amount', e.amount,
        'settled_amount', e.settled_amount,
        'direction', e.direction,
        'reason', e.reason,
        'status', e.status,
        'comanda_id', e.comanda_id,
        'created_at', e.created_at,
        'created_by', e.created_by,
        'reversed_at', e.reversed_at,
        'reversed_by', e.reversed_by,
        'reversal_reason', e.reversal_reason
      ) as entry
    from public.professional_account_entries e
    where e.tenant_id = v_target_tenant
      and e.professional_id = p_professional_id

    union all

    select
      p.id as entry_id,
      p.paid_at as entry_created_at,
      jsonb_build_object(
        'kind', 'quitacao',
        'id', p.id,
        'amount', p.amount,
        'advance_amount', p.advance_amount,
        'credit_amount', p.credit_amount,
        'direction', 'debit',
        'reason', p.notes,
        'status', case when p.reversed_at is not null then 'reversed' else 'paid' end,
        'payment_method', p.payment_method,
        'created_at', p.paid_at,
        'created_by', p.created_by,
        'reversed_at', p.reversed_at,
        'reversed_by', p.reversed_by,
        'reversal_reason', p.reversal_reason
      ) as entry
    from public.commission_payouts p
    where p.tenant_id = v_target_tenant
      and p.professional_id = p_professional_id
  ) unified;

  v_balance := public.get_professional_commission_balance(p_professional_id, null, null, v_target_tenant);

  return jsonb_build_object(
    'entries', v_entries,
    'current_balance', v_balance
  );
end;
$function$;

create or replace function public.get_professional_commission_items(
  p_professional_id uuid,
  p_start_date timestamptz default null,
  p_end_date timestamptz default null,
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_items jsonb;
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
      and p.tenant_id = v_user_tenant
      and p.is_active = true
      and p.deleted_at is null;
    if not found or (p_tenant_id is not null and v_target_tenant is distinct from p_tenant_id) then
      raise exception 'Acesso negado para este extrato.' using errcode = '42501';
    end if;
  elsif v_user_role in ('gerente', 'proprietario') then
    if p_tenant_id is not null then
      if v_user_role <> 'proprietario' and v_user_tenant is distinct from p_tenant_id then
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

  -- Mesmo recorte do saldo: obrigacao nao estornada pela data em que nasceu, e item legado (sem
  -- obrigacao) pela data de fechamento da Comanda, so quando o snapshot esta confirmado ou estimado.
  select coalesce(jsonb_agg(item order by accrued_at desc, item_id desc), '[]'::jsonb)
    into v_items
  from (
    select
      src.item_id,
      src.accrued_at,
      jsonb_build_object(
        'item_id', src.item_id,
        'comanda_id', src.comanda_id,
        'accrued_at', src.accrued_at,
        'customer_name', cu.name,
        'item_type', ci.item_type,
        'item_name', coalesce(s.name, pr.name, src.label, 'Item'),
        'net_amount', coalesce(ci.snapshot_net_amount, ci.total_price),
        'commission_percentage', ci.snapshot_commission_percentage,
        'commission_amount', src.commission_amount
      ) as item
    from (
      select
        o.comanda_item_id as item_id,
        o.comanda_id,
        o.created_at as accrued_at,
        o.amount as commission_amount,
        o.origin_item_label as label
      from public.commission_obligations o
      where o.tenant_id = v_target_tenant
        and o.professional_id = p_professional_id
        and o.status <> 'reversed'
        and o.created_at >= v_start and o.created_at <= v_end

      union all

      select
        li.id as item_id,
        li.comanda_id,
        lc.closed_at as accrued_at,
        li.snapshot_commission_amount as commission_amount,
        null::text as label
      from public.comanda_itens li
      join public.comandas lc on lc.id = li.comanda_id
      where lc.tenant_id = v_target_tenant
        and lc.status in ('fechada', 'closed')
        and li.professional_id = p_professional_id
        and not exists (select 1 from public.commission_obligations o where o.comanda_item_id = li.id)
        and li.snapshot_status in ('confirmed', 'estimated')
        and li.snapshot_commission_amount is not null
        and lc.closed_at >= v_start and lc.closed_at <= v_end
    ) src
    left join public.comanda_itens ci on ci.id = src.item_id
    left join public.comandas c on c.id = src.comanda_id
    left join public.customers cu on cu.id = c.customer_id
    left join public.services s on s.id = ci.service_id
    left join public.products pr on pr.id = ci.product_id
  ) rows_;

  return v_items;
end;
$function$;

revoke all on function public.get_professional_commission_items(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.get_professional_commission_items(uuid, timestamptz, timestamptz, uuid) to authenticated;

alter policy comanda_itens_select_active on public.comanda_itens
  using (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (
        (select private.get_auth_role()) is distinct from 'barbeiro'
        or (professional_id is not null and (select private.is_own_professional(professional_id)))
      )
    )
  );
