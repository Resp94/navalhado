-- Ticket 08: preserva o contexto financeiro de cada item no fechamento.
-- Todos os campos são opcionais para manter os registros legados compatíveis.
alter table public.comanda_itens
  add column if not exists snapshot_quantity integer,
  add column if not exists snapshot_unit_price numeric,
  add column if not exists snapshot_gross_amount numeric,
  add column if not exists snapshot_discount_amount numeric,
  add column if not exists snapshot_net_amount numeric,
  add column if not exists snapshot_unit_cost numeric,
  add column if not exists snapshot_commission_percentage numeric,
  add column if not exists snapshot_commission_amount numeric,
  add column if not exists snapshot_commission_rule text,
  add column if not exists snapshot_status text,
  add column if not exists snapshot_reverted_at timestamptz,
  add column if not exists snapshot_reverted_by uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'comanda_itens_snapshot_quantity_check'
      and conrelid = 'public.comanda_itens'::regclass
  ) then
    alter table public.comanda_itens
      add constraint comanda_itens_snapshot_quantity_check
      check (snapshot_quantity is null or snapshot_quantity > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'comanda_itens_snapshot_amounts_check'
      and conrelid = 'public.comanda_itens'::regclass
  ) then
    alter table public.comanda_itens
      add constraint comanda_itens_snapshot_amounts_check
      check (
        (snapshot_unit_price is null or snapshot_unit_price >= 0)
        and (snapshot_gross_amount is null or snapshot_gross_amount >= 0)
        and (snapshot_discount_amount is null or snapshot_discount_amount >= 0)
        and (snapshot_net_amount is null or snapshot_net_amount >= 0)
        and (snapshot_unit_cost is null or snapshot_unit_cost >= 0)
        and (snapshot_commission_amount is null or snapshot_commission_amount >= 0)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'comanda_itens_snapshot_commission_percentage_check'
      and conrelid = 'public.comanda_itens'::regclass
  ) then
    alter table public.comanda_itens
      add constraint comanda_itens_snapshot_commission_percentage_check
      check (
        snapshot_commission_percentage is null
        or snapshot_commission_percentage between 0 and 100
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'comanda_itens_snapshot_rule_check'
      and conrelid = 'public.comanda_itens'::regclass
  ) then
    alter table public.comanda_itens
      add constraint comanda_itens_snapshot_rule_check
      check (
        snapshot_commission_rule is null
        or snapshot_commission_rule in (
          'professional_service', 'service', 'professional', 'product', 'none'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'comanda_itens_snapshot_status_check'
      and conrelid = 'public.comanda_itens'::regclass
  ) then
    alter table public.comanda_itens
      add constraint comanda_itens_snapshot_status_check
      check (snapshot_status is null or snapshot_status in ('confirmed', 'reverted'));
  end if;
end;
$$;

create index if not exists idx_comanda_itens_snapshot_status
  on public.comanda_itens (comanda_id, snapshot_status);

-- O fechamento continua atômico e agora grava os valores antes de qualquer
-- alteração cadastral futura. O rateio do desconto usa centavos e entrega o
-- residual ao primeiro item na ordem do payload.
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

  select coalesce(sum(round(item.quantity * item.unit_price, 2)), 0)
    into v_subtotal
  from jsonb_to_recordset(p_itens) as item(
    item_type text,
    service_id uuid,
    product_id uuid,
    quantity integer,
    unit_price numeric
  );

  v_discount := round(coalesce(p_discount_amount, 0), 2);
  v_tip := round(coalesce(p_tip_amount, 0), 2);
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
      tenant_id, appointment_id, customer_id, status,
      total_amount, discount_amount, tip_amount
    ) values (
      p_tenant_id, p_appointment_id, p_customer_id, 'aberta', 0, 0, 0
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
    comanda_id, tenant_id, item_type, service_id, product_id, professional_id,
    quantity, unit_price, total_price,
    snapshot_quantity, snapshot_unit_price, snapshot_gross_amount,
    snapshot_discount_amount, snapshot_net_amount, snapshot_unit_cost,
    snapshot_commission_percentage, snapshot_commission_amount,
    snapshot_commission_rule, snapshot_status
  )
  with raw_items as (
    select
      entry.item_order::integer as item_order,
      entry.payload->>'item_type' as item_type,
      nullif(entry.payload->>'service_id', '')::uuid as service_id,
      nullif(entry.payload->>'product_id', '')::uuid as product_id,
      nullif(entry.payload->>'professional_id', '')::uuid as professional_id,
      (entry.payload->>'quantity')::integer as quantity,
      (entry.payload->>'unit_price')::numeric as unit_price
    from jsonb_array_elements(p_itens) with ordinality as entry(payload, item_order)
  ), gross_items as (
    select
      raw_items.*,
      round(raw_items.quantity * raw_items.unit_price, 2) as gross_amount,
      sum(round(raw_items.quantity * raw_items.unit_price, 2)) over () as gross_total
    from raw_items
  ), rounded_allocations as (
    select
      gross_items.*,
      coalesce(round(v_discount * gross_items.gross_amount / nullif(gross_items.gross_total, 0), 2), 0) as rounded_discount
    from gross_items
  ), allocated_items as (
    select
      rounded_allocations.*,
      case
        when rounded_allocations.item_order = min(rounded_allocations.item_order) over ()
          then round(
            rounded_allocations.rounded_discount
            + (v_discount - sum(rounded_allocations.rounded_discount) over ()),
            2
          )
        else rounded_allocations.rounded_discount
      end as allocated_discount
    from rounded_allocations
  )
  select
    v_comanda.id,
    p_tenant_id,
    allocated.item_type,
    allocated.service_id,
    allocated.product_id,
    allocated.professional_id,
    allocated.quantity,
    allocated.unit_price,
    allocated.gross_amount,
    allocated.quantity,
    allocated.unit_price,
    allocated.gross_amount,
    allocated.allocated_discount,
    round(allocated.gross_amount - allocated.allocated_discount, 2),
    case when allocated.item_type = 'produto' then product.cost_price else null end,
    case
      when allocated.professional_id is null or professional.id is null then 0
      when allocated.item_type = 'produto' then coalesce(product.commission_percentage, 0)
      else coalesce(
        professional_service.custom_commission_percentage,
        service.commission_percentage,
        professional.commission_percentage,
        0
      )
    end,
    case
      when allocated.professional_id is null or professional.id is null then 0
      when allocated.item_type = 'produto' then round(allocated.gross_amount * coalesce(product.commission_percentage, 0) / 100, 2)
      else round(
        allocated.gross_amount * coalesce(
          professional_service.custom_commission_percentage,
          service.commission_percentage,
          professional.commission_percentage,
          0
        ) / 100,
        2
      )
    end,
    case
      when allocated.professional_id is null or professional.id is null then 'none'
      when allocated.item_type = 'produto' then 'product'
      when professional_service.custom_commission_percentage is not null then 'professional_service'
      when service.commission_percentage is not null then 'service'
      when professional.commission_percentage is not null then 'professional'
      else 'none'
    end,
    'confirmed'
  from allocated_items allocated
  left join public.products product
    on product.id = allocated.product_id
   and product.tenant_id = p_tenant_id
  left join public.services service
    on service.id = allocated.service_id
   and service.tenant_id = p_tenant_id
  left join public.professionals professional
    on professional.id = allocated.professional_id
   and professional.tenant_id = p_tenant_id
   and professional.is_active = true
   and professional.deleted_at is null
  left join public.professional_services professional_service
    on professional_service.service_id = allocated.service_id
   and professional_service.professional_id = allocated.professional_id
   and professional_service.tenant_id = p_tenant_id;

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
      tenant_id, product_id, movement_type, quantity, unit_cost,
      reason, comanda_id, created_by
    )
    select
      p_tenant_id, v_item.product_id, 'exit_sale_comanda', v_item.quantity,
      p.cost_price, 'Venda da comanda', v_comanda.id, v_user_id
    from public.products p
    where p.id = v_item.product_id;
  end loop;

  insert into public.comanda_pagamentos (
    comanda_id, tenant_id, cash_session_id, payment_method, amount, change_amount
  )
  select
    v_comanda.id, p_tenant_id, p_cash_session_id, payment.payment_method,
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
    set status = 'completed', payment_status = 'paid', updated_at = timezone('utc'::text, now())
    where id = v_comanda.appointment_id and tenant_id = p_tenant_id;
  end if;

  select to_jsonb(v_comanda) || jsonb_build_object(
    'itens', coalesce((
      select jsonb_agg(to_jsonb(ci) order by ci.created_at, ci.id)
      from public.comanda_itens ci where ci.comanda_id = v_comanda.id
    ), '[]'::jsonb),
    'pagamentos', coalesce((
      select jsonb_agg(to_jsonb(cp) order by cp.paid_at, cp.id)
      from public.comanda_pagamentos cp where cp.comanda_id = v_comanda.id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.settle_comanda(uuid, uuid, uuid, uuid, numeric, numeric, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.settle_comanda(uuid, uuid, uuid, uuid, numeric, numeric, uuid, jsonb, jsonb) to authenticated;

-- Uma reabertura não apaga o histórico do item, mas o tira do estado ativo.
create or replace function public.reopen_comanda(
  p_comanda_id uuid,
  p_tenant_id uuid
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
  v_movement record;
  v_result jsonb;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Usuário não autenticado.' using errcode = '42501';
  end if;

  select role, tenant_id into v_user_role, v_user_tenant
  from public.users where id = v_user_id and is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado. Apenas gerentes e proprietários podem reabrir comandas.' using errcode = '42501';
  end if;
  if p_comanda_id is null or p_tenant_id is null then
    raise exception 'Comanda e unidade são obrigatórias.' using errcode = '22023';
  end if;
  if v_user_role <> 'proprietario' and v_user_tenant <> p_tenant_id then
    raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
  end if;

  select * into v_comanda
  from public.comandas
  where id = p_comanda_id and tenant_id = p_tenant_id
  for update;
  if not found or v_comanda.status <> 'fechada' then
    raise exception 'A comanda não está fechada ou não existe.' using errcode = 'P0001';
  end if;

  if v_comanda.appointment_id is not null then
    select * into v_appointment
    from public.appointments
    where id = v_comanda.appointment_id and tenant_id = p_tenant_id
    for update;
    if not found then
      raise exception 'Agendamento da comanda não encontrado.' using errcode = 'P0001';
    end if;
    if v_appointment.status <> 'completed' or v_appointment.payment_status <> 'paid' then
      raise exception 'O agendamento já possui outro estado e não pode ser revertido com segurança.' using errcode = 'P0001';
    end if;
  end if;

  if exists (
    select 1
    from (
      select ci.product_id, sum(ci.quantity)::integer as quantity
      from public.comanda_itens ci
      where ci.comanda_id = v_comanda.id and ci.item_type = 'produto' and ci.product_id is not null
      group by ci.product_id
    ) items
    full join (
      select pm.product_id, sum(pm.quantity)::integer as quantity
      from public.product_movements pm
      where pm.comanda_id = v_comanda.id and pm.tenant_id = p_tenant_id
        and pm.movement_type = 'exit_sale_comanda'
      group by pm.product_id
    ) movements using (product_id)
    where coalesce(items.quantity, 0) <> coalesce(movements.quantity, 0)
  ) then
    raise exception 'Os movimentos de estoque da comanda não são compatíveis com o estorno.' using errcode = 'P0001';
  end if;

  for v_movement in
    select pm.* from public.product_movements pm
    where pm.comanda_id = v_comanda.id and pm.tenant_id = p_tenant_id
      and pm.movement_type = 'exit_sale_comanda'
    order by pm.product_id, pm.id for update
  loop
    perform 1 from public.products
    where id = v_movement.product_id and tenant_id = p_tenant_id for update;
    if not found then
      raise exception 'Produto do movimento de estoque não encontrado.' using errcode = 'P0001';
    end if;
    update public.products set stock_quantity = stock_quantity + v_movement.quantity
    where id = v_movement.product_id and tenant_id = p_tenant_id;
    insert into public.product_movements (
      tenant_id, product_id, movement_type, quantity, unit_cost,
      reason, comanda_id, created_by
    ) values (
      p_tenant_id, v_movement.product_id, 'entry_manual', v_movement.quantity,
      v_movement.unit_cost, 'Estorno da reabertura da comanda', v_comanda.id, v_user_id
    );
  end loop;

  delete from public.comanda_pagamentos
  where comanda_id = v_comanda.id and tenant_id = p_tenant_id;

  update public.comanda_itens
  set snapshot_status = 'reverted',
      snapshot_reverted_at = timezone('utc'::text, now()),
      snapshot_reverted_by = v_user_id
  where comanda_id = v_comanda.id and snapshot_status = 'confirmed';

  update public.comandas
  set status = 'aberta', closed_at = null, updated_at = timezone('utc'::text, now())
  where id = v_comanda.id and tenant_id = p_tenant_id
  returning * into v_comanda;

  if v_comanda.appointment_id is not null then
    update public.appointments
    set status = 'confirmed', payment_status = 'pending', updated_at = timezone('utc'::text, now())
    where id = v_comanda.appointment_id and tenant_id = p_tenant_id;
  end if;

  select to_jsonb(v_comanda) || jsonb_build_object(
    'itens', coalesce((
      select jsonb_agg(to_jsonb(ci) order by ci.created_at, ci.id)
      from public.comanda_itens ci where ci.comanda_id = v_comanda.id
    ), '[]'::jsonb),
    'pagamentos', coalesce((
      select jsonb_agg(to_jsonb(cp) order by cp.paid_at, cp.id)
      from public.comanda_pagamentos cp where cp.comanda_id = v_comanda.id
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.reopen_comanda(uuid, uuid) from public, anon;
grant execute on function public.reopen_comanda(uuid, uuid) to authenticated;
