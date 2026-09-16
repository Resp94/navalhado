-- Correção do Ticket 05: prioriza o estado fechado antes de validar novo payload.
create or replace function public.settle_comanda(
  p_comanda_id uuid default null,
  p_tenant_id uuid default null,
  p_appointment_id uuid default null,
  p_customer_id uuid default null,
  p_discount_amount numeric default 0,
  p_tip_amount numeric default 0,
  p_cash_session_id uuid default null,
  p_itens jsonb default '[]'::jsonb,
  p_pagamentos jsonb default '[]'::jsonb
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
  v_comanda public.comandas%rowtype;
  v_appointment public.appointments%rowtype;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_tip numeric := 0;
  v_total numeric := 0;
  v_payment_total numeric := 0;
  v_product record;
  v_item public.comanda_itens%rowtype;
  v_result jsonb;
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
    raise exception 'Acesso negado. Apenas gerentes e proprietários podem finalizar comandas.' using errcode = '42501';
  end if;

  if p_tenant_id is null then
    raise exception 'Unidade não informada.' using errcode = '22023';
  end if;

  if v_user_role <> 'proprietario' and v_user_tenant <> p_tenant_id then
    raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
  end if;

  if p_comanda_id is not null then
    select *
      into v_comanda
    from public.comandas
    where id = p_comanda_id
      and tenant_id = p_tenant_id
    for update;

    if not found or v_comanda.status not in ('aberta', 'open') then
      raise exception 'A comanda não está aberta ou não existe.' using errcode = 'P0001';
    end if;
  end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'A comanda deve conter pelo menos um item.' using errcode = 'P0001';
  end if;

  if p_pagamentos is null or jsonb_typeof(p_pagamentos) <> 'array' or jsonb_array_length(p_pagamentos) = 0 then
    raise exception 'Pelo menos uma forma de pagamento deve ser informada.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_itens) as item(
      item_type text,
      service_id uuid,
      product_id uuid,
      quantity integer,
      unit_price numeric
    )
    where item.item_type not in ('servico', 'produto')
       or item.quantity is null
       or item.quantity <= 0
       or item.unit_price is null
       or item.unit_price < 0
       or (item.item_type = 'servico' and item.service_id is null)
       or (item.item_type = 'produto' and item.product_id is null)
  ) then
    raise exception 'Item de comanda inválido.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_pagamentos) as payment(
      payment_method text,
      amount numeric,
      received_cash numeric
    )
    where payment.payment_method not in ('pix', 'credit_card', 'debit_card', 'cash', 'other')
       or payment.amount is null
       or payment.amount <= 0
  ) then
    raise exception 'Pagamento de comanda inválido.' using errcode = 'P0001';
  end if;

  select coalesce(sum(item.quantity * item.unit_price), 0)
    into v_subtotal
  from jsonb_to_recordset(p_itens) as item(
    item_type text,
    service_id uuid,
    product_id uuid,
    quantity integer,
    unit_price numeric
  );

  v_discount := coalesce(p_discount_amount, 0);
  v_tip := coalesce(p_tip_amount, 0);
  if v_discount < 0 or v_tip < 0 or v_discount > v_subtotal then
    raise exception 'Desconto ou gorjeta inválidos.' using errcode = 'P0001';
  end if;

  v_total := round(v_subtotal - v_discount + v_tip, 2);
  if v_total <= 0 then
    raise exception 'O total da comanda deve ser maior que zero.' using errcode = 'P0001';
  end if;

  select coalesce(sum(payment.amount), 0)
    into v_payment_total
  from jsonb_to_recordset(p_pagamentos) as payment(
    payment_method text,
    amount numeric,
    received_cash numeric
  );

  if abs(v_payment_total - v_total) > 0.01 then
    raise exception 'A soma dos pagamentos deve ser igual ao total da comanda.' using errcode = 'P0001';
  end if;

  if p_cash_session_id is not null then
    perform 1
    from public.cash_sessions
    where id = p_cash_session_id
      and tenant_id = p_tenant_id
      and status = 'open'
    for update;

    if not found then
      raise exception 'A sessão de caixa não está aberta ou não pertence à unidade.' using errcode = 'P0001';
    end if;
  end if;

  if p_comanda_id is null then
    insert into public.comandas (
      tenant_id,
      appointment_id,
      customer_id,
      status,
      total_amount,
      discount_amount,
      tip_amount
    ) values (
      p_tenant_id,
      p_appointment_id,
      p_customer_id,
      'aberta',
      0,
      0,
      0
    )
    returning * into v_comanda;
  else
    select *
      into v_comanda
    from public.comandas
    where id = p_comanda_id
      and tenant_id = p_tenant_id
    for update;

    if not found or v_comanda.status not in ('aberta', 'open') then
      raise exception 'A comanda não está aberta ou não existe.' using errcode = 'P0001';
    end if;

    if p_appointment_id is not null and v_comanda.appointment_id is distinct from p_appointment_id then
      raise exception 'O agendamento informado não pertence à comanda.' using errcode = 'P0001';
    end if;
  end if;

  if p_customer_id is not null and v_comanda.customer_id is distinct from p_customer_id then
    raise exception 'O cliente informado não pertence à comanda.' using errcode = 'P0001';
  end if;

  if v_comanda.appointment_id is not null then
    select *
      into v_appointment
    from public.appointments
    where id = v_comanda.appointment_id
      and tenant_id = p_tenant_id
    for update;

    if not found then
      raise exception 'Agendamento da comanda não encontrado.' using errcode = 'P0001';
    end if;

    if v_appointment.status in ('no_show', 'canceled') then
      raise exception 'Não é possível liquidar uma comanda vinculada a um atendimento cancelado ou não comparecido.' using errcode = 'P0001';
    end if;
  end if;

  if p_customer_id is not null then
    perform 1
    from public.customers
    where id = p_customer_id
      and tenant_id = p_tenant_id;
    if not found then
      raise exception 'Cliente não pertence à unidade informada.' using errcode = 'P0001';
    end if;
  end if;

  for v_product in
    select item.product_id, sum(item.quantity)::integer as required_quantity
    from jsonb_to_recordset(p_itens) as item(
      item_type text,
      service_id uuid,
      product_id uuid,
      quantity integer,
      unit_price numeric
    )
    where item.item_type = 'produto'
    group by item.product_id
    order by item.product_id
  loop
    perform 1
    from public.products
    where id = v_product.product_id
      and tenant_id = p_tenant_id
      and is_active = true
    for update;

    if not found then
      raise exception 'Produto não encontrado ou inativo.' using errcode = 'P0001';
    end if;

    if (select stock_quantity from public.products where id = v_product.product_id) < v_product.required_quantity then
      raise exception 'Estoque insuficiente para o produto.' using errcode = 'P0001';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_to_recordset(p_itens) as item(
      item_type text,
      service_id uuid,
      product_id uuid,
      quantity integer,
      unit_price numeric
    )
    where item.item_type = 'servico'
      and not exists (
        select 1
        from public.services s
        where s.id = item.service_id
          and s.tenant_id = p_tenant_id
          and coalesce(s.is_active, true) = true
          and s.deleted_at is null
      )
  ) then
    raise exception 'Serviço não encontrado ou inativo.' using errcode = 'P0001';
  end if;

  delete from public.comanda_itens
  where comanda_id = v_comanda.id;

  insert into public.comanda_itens (
    comanda_id,
    tenant_id,
    item_type,
    service_id,
    product_id,
    professional_id,
    quantity,
    unit_price,
    total_price
  )
  select
    v_comanda.id,
    p_tenant_id,
    item.item_type,
    item.service_id,
    item.product_id,
    item.professional_id,
    item.quantity,
    item.unit_price,
    round(item.quantity * item.unit_price, 2)
  from jsonb_to_recordset(p_itens) as item(
    item_type text,
    service_id uuid,
    product_id uuid,
    professional_id uuid,
    quantity integer,
    unit_price numeric
  );

  for v_item in
    select *
    from public.comanda_itens
    where comanda_id = v_comanda.id
      and item_type = 'produto'
    order by product_id, id
  loop
    update public.products
    set stock_quantity = stock_quantity - v_item.quantity
    where id = v_item.product_id
      and tenant_id = p_tenant_id;

    insert into public.product_movements (
      tenant_id,
      product_id,
      movement_type,
      quantity,
      unit_cost,
      reason,
      comanda_id,
      created_by
    )
    select
      p_tenant_id,
      v_item.product_id,
      'exit_sale_comanda',
      v_item.quantity,
      p.cost_price,
      'Venda da comanda',
      v_comanda.id,
      v_user_id
    from public.products p
    where p.id = v_item.product_id;
  end loop;

  insert into public.comanda_pagamentos (
    comanda_id,
    tenant_id,
    cash_session_id,
    payment_method,
    amount,
    change_amount
  )
  select
    v_comanda.id,
    p_tenant_id,
    p_cash_session_id,
    payment.payment_method,
    payment.amount,
    case
      when payment.payment_method = 'cash'
       and coalesce(payment.received_cash, 0) > payment.amount
        then round(payment.received_cash - payment.amount, 2)
      else 0
    end
  from jsonb_to_recordset(p_pagamentos) as payment(
    payment_method text,
    amount numeric,
    received_cash numeric
  );

  update public.comandas
  set status = 'fechada',
      total_amount = v_total,
      discount_amount = v_discount,
      tip_amount = v_tip,
      closed_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
  where id = v_comanda.id
  returning * into v_comanda;

  if v_comanda.appointment_id is not null then
    update public.appointments
    set status = 'completed',
        payment_status = 'paid',
        updated_at = timezone('utc'::text, now())
    where id = v_comanda.appointment_id
      and tenant_id = p_tenant_id;
  end if;

  select to_jsonb(v_comanda) || jsonb_build_object(
    'itens', coalesce((
      select jsonb_agg(to_jsonb(ci) order by ci.created_at, ci.id)
      from public.comanda_itens ci
      where ci.comanda_id = v_comanda.id
    ), '[]'::jsonb),
    'pagamentos', coalesce((
      select jsonb_agg(to_jsonb(cp) order by cp.paid_at, cp.id)
      from public.comanda_pagamentos cp
      where cp.comanda_id = v_comanda.id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.settle_comanda(uuid, uuid, uuid, uuid, numeric, numeric, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.settle_comanda(uuid, uuid, uuid, uuid, numeric, numeric, uuid, jsonb, jsonb) to authenticated;

