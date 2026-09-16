-- Protege a quitação de comissões e preserva a assinatura consumida pela tela.
create or replace function public.register_commission_payout(
  p_professional_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_notes text default null,
  p_paid_at timestamp with time zone default timezone('utc'::text, now()),
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_professional_tenant uuid;
  v_professional_active boolean;
  v_professional_deleted_at timestamptz;
  v_payment_method text;
  v_total_commission numeric := 0;
  v_paid_commission numeric := 0;
  v_pending_commission numeric := 0;
  v_payout_id uuid;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Usuário não autenticado.' using errcode = '42501';
  end if;

  select role, tenant_id
    into v_user_role, v_user_tenant
  from public.users
  where id = v_user_id
    and is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado. Apenas gerentes e proprietários podem registrar pagamentos de comissão.' using errcode = '42501';
  end if;

  if p_tenant_id is not null then
    if v_user_role <> 'proprietario' and v_user_tenant <> p_tenant_id then
      raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
    end if;
    v_target_tenant := p_tenant_id;
  else
    v_target_tenant := v_user_tenant;
  end if;

  if v_target_tenant is null then
    raise exception 'Unidade não informada.' using errcode = '22023';
  end if;

  v_payment_method := lower(btrim(coalesce(p_payment_method, '')));
  if v_payment_method not in ('pix', 'cash', 'credit_card', 'debit_card', 'transfer', 'other') then
    raise exception 'Método de pagamento inválido.' using errcode = 'P0001';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount = 'NaN'::numeric then
    raise exception 'O valor do pagamento deve ser maior que zero.' using errcode = '22023';
  end if;

  select tenant_id, is_active, deleted_at
    into v_professional_tenant, v_professional_active, v_professional_deleted_at
  from public.professionals
  where id = p_professional_id
  for update;

  if not found or v_professional_tenant <> v_target_tenant or not coalesce(v_professional_active, false) or v_professional_deleted_at is not null then
    raise exception 'Profissional não encontrado ou inativo.' using errcode = 'P0001';
  end if;

  with target_comandas as (
    select c.id
    from public.comandas c
    where c.tenant_id = v_target_tenant
      and c.status in ('fechada', 'closed')
  ),
  item_commissions as (
    select round(
      ci.total_price * coalesce(
        case
          when ci.item_type in ('servico', 'service') or ci.service_id is not null then
            coalesce(ps.custom_commission_percentage, s.commission_percentage, prof.commission_percentage, 0)
          when ci.item_type in ('produto', 'product') or ci.product_id is not null then
            coalesce(prod.commission_percentage, 0)
          else 0
        end,
        0
      ) / 100,
      2
    ) as commission_amount
    from public.comanda_itens ci
    join target_comandas tc on tc.id = ci.comanda_id
    left join public.professionals prof on prof.id = ci.professional_id
    left join public.services s on s.id = ci.service_id
    left join public.professional_services ps
      on ps.service_id = ci.service_id
      and ps.professional_id = ci.professional_id
      and ps.tenant_id = ci.tenant_id
    left join public.products prod on prod.id = ci.product_id
    where ci.professional_id = p_professional_id
  )
  select coalesce(sum(commission_amount), 0)
    into v_total_commission
  from item_commissions;

  select coalesce(sum(amount), 0)
    into v_paid_commission
  from public.commission_payouts
  where tenant_id = v_target_tenant
    and professional_id = p_professional_id;

  v_pending_commission := greatest(0, v_total_commission - v_paid_commission);
  if p_amount > v_pending_commission then
    raise exception 'O valor informado excede o saldo pendente de comissão.' using errcode = 'P0001';
  end if;

  insert into public.commission_payouts (
    tenant_id,
    professional_id,
    amount,
    payment_method,
    notes,
    paid_at,
    created_by
  ) values (
    v_target_tenant,
    p_professional_id,
    p_amount,
    v_payment_method,
    p_notes,
    coalesce(p_paid_at, timezone('utc'::text, now())),
    v_user_id
  )
  returning id into v_payout_id;

  return jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'amount', p_amount,
    'professional_id', p_professional_id
  );
end;
$$;

revoke all on function public.register_commission_payout(uuid, numeric, text, text, timestamptz, uuid) from public, anon;
grant execute on function public.register_commission_payout(uuid, numeric, text, text, timestamptz, uuid) to authenticated;
