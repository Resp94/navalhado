-- Spec 040, ticket 03b: regras de liquidacao em funcoes privadas.
--
-- Extrai de settle_comanda o calculo do preco efetivo (catalogo) e a resolucao do
-- destinatario da gorjeta para private.resolve_comanda_item_prices e
-- private.resolve_comanda_tip_recipient, para as proximas mudancas dessas regras
-- nao precisarem copiar a funcao inteira. A assinatura de settle_comanda nao muda
-- (create or replace preserva grants).
--
-- Correcoes junto:
--  * o preco minimo 'starting_at' so vale para item de servico (um produto com
--    service_id sobrando no payload nao dispara mais a recusa);
--  * com gorjeta maior que zero e destinatario nulo, um unico profissional nos itens
--    recebe a gorjeta (como a tela ja fazia); dois ou mais continuam exigindo escolha;
--  * se a soma dos pagamentos nao bate porque o preco do catalogo mudou desde que a
--    tela carregou, a mensagem diz isso.

create or replace function private.resolve_comanda_item_prices(p_tenant_id uuid, p_itens jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_result jsonb;
  v_below_minimum boolean;
begin
  -- O catalogo manda. Item cujo produto ou servico nao e encontrado (ou esta
  -- inativo) segue com o preco enviado e e recusado adiante por settle_comanda.
  select
    jsonb_agg(
      case
        when entry.payload->>'item_type' = 'produto' and product.id is not null
          then entry.payload || jsonb_build_object('unit_price', product.price)
        when entry.payload->>'item_type' = 'servico' and service.id is not null and service.price_type = 'fixed'
          then entry.payload || jsonb_build_object('unit_price', service.price)
        else entry.payload
      end
      order by entry.item_order
    ),
    coalesce(bool_or(
      entry.payload->>'item_type' = 'servico'
      and service.id is not null
      and service.price_type = 'starting_at'
      and (entry.payload->>'unit_price')::numeric < service.price
    ), false)
    into v_result, v_below_minimum
  from jsonb_array_elements(p_itens) with ordinality as entry(payload, item_order)
  left join public.products product
    on entry.payload->>'item_type' = 'produto'
   and product.id = nullif(entry.payload->>'product_id', '')::uuid
   and product.tenant_id = p_tenant_id
   and product.is_active = true
  left join public.services service
    on entry.payload->>'item_type' = 'servico'
   and service.id = nullif(entry.payload->>'service_id', '')::uuid
   and service.tenant_id = p_tenant_id
   and coalesce(service.is_active, true) = true
   and service.deleted_at is null;

  if v_below_minimum then
    raise exception 'O valor do serviço não pode ser menor que o preço mínimo cadastrado.'
      using errcode = 'P0001', hint = 'service_price_below_minimum';
  end if;

  return v_result;
end;
$function$;

create or replace function private.resolve_comanda_tip_recipient(
  p_tenant_id uuid,
  p_itens jsonb,
  p_tip_amount numeric,
  p_tip_professional_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_item_professionals uuid[];
  v_recipient uuid := p_tip_professional_id;
begin
  select array_agg(distinct nullif(entry.payload->>'professional_id', '')::uuid)
    filter (where nullif(entry.payload->>'professional_id', '') is not null)
    into v_item_professionals
  from jsonb_array_elements(p_itens) as entry(payload);

  if v_recipient is null and coalesce(p_tip_amount, 0) > 0 then
    if coalesce(cardinality(v_item_professionals), 0) >= 2 then
      raise exception 'Informe o destinatário da gorjeta: mais de um profissional atendeu na comanda.' using errcode = 'P0001';
    end if;
    v_recipient := v_item_professionals[1];
  end if;

  if v_recipient is null then
    return null;
  end if;

  perform 1
  from public.professionals
  where id = v_recipient
    and tenant_id = p_tenant_id;

  if not found then
    raise exception 'O destinatário da gorjeta não pertence à unidade.' using errcode = 'P0001';
  end if;

  if not (v_recipient = any (coalesce(v_item_professionals, '{}'::uuid[]))) then
    raise exception 'O destinatário da gorjeta deve ser um profissional que atendeu na comanda.' using errcode = 'P0001';
  end if;

  return v_recipient;
end;
$function$;

revoke all on function private.resolve_comanda_item_prices(uuid, jsonb) from public, anon, authenticated;
revoke all on function private.resolve_comanda_tip_recipient(uuid, jsonb, numeric, uuid) from public, anon, authenticated;

create or replace function public.settle_comanda(p_comanda_id uuid DEFAULT NULL::uuid, p_tenant_id uuid DEFAULT NULL::uuid, p_appointment_id uuid DEFAULT NULL::uuid, p_customer_id uuid DEFAULT NULL::uuid, p_discount_amount numeric DEFAULT 0, p_tip_amount numeric DEFAULT 0, p_cash_session_id uuid DEFAULT NULL::uuid, p_itens jsonb DEFAULT '[]'::jsonb, p_pagamentos jsonb DEFAULT '[]'::jsonb, p_tip_professional_id uuid DEFAULT NULL::uuid, p_discount_percent numeric DEFAULT NULL::numeric)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
  v_sent_itens jsonb;
  v_prices_changed boolean;
  v_discount_type text := 'amount';
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

  if v_user_role <> 'proprietario' and v_user_tenant is distinct from p_tenant_id then
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

  -- Preco efetivo (catalogo) e destinatario da gorjeta: regras em funcoes privadas.
  v_sent_itens := p_itens;
  p_itens := private.resolve_comanda_item_prices(p_tenant_id, p_itens);
  v_prices_changed := p_itens is distinct from v_sent_itens;
  p_tip_professional_id := private.resolve_comanda_tip_recipient(
    p_tenant_id, p_itens, p_tip_amount, p_tip_professional_id
  );

  if p_pagamentos is not null and jsonb_typeof(p_pagamentos) = 'array' and jsonb_array_length(p_pagamentos) > 0 then
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
         or (
           payment.payment_method = 'cash'
           and payment.received_cash is not null
           and payment.received_cash < payment.amount
         )
    ) then
      raise exception 'Pagamento de comanda inválido.' using errcode = 'P0001';
    end if;
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

  if p_discount_percent is not null then
    if p_discount_percent < 0 or p_discount_percent > 100 then
      raise exception 'Percentual de desconto inválido.' using errcode = 'P0001';
    end if;
    v_discount_type := 'percent';
    v_discount := round(v_subtotal * p_discount_percent / 100, 2);
  else
    v_discount := round(coalesce(p_discount_amount, 0), 2);
  end if;
  v_tip := round(coalesce(p_tip_amount, 0), 2);
  if v_discount < 0 or v_tip < 0 or v_discount > v_subtotal then
    raise exception 'Desconto ou gorjeta inválidos.' using errcode = 'P0001';
  end if;

  v_total := round(v_subtotal - v_discount + v_tip, 2);
  if v_total < 0 then
    raise exception 'O total da comanda deve ser maior ou igual a zero.' using errcode = 'P0001';
  end if;

  if v_total = 0 then
    if p_pagamentos is not null and jsonb_typeof(p_pagamentos) = 'array' and jsonb_array_length(p_pagamentos) > 0 then
      raise exception 'Comanda de cortesia com total zero não deve informar forma de pagamento.' using errcode = 'P0001';
    end if;
  else
    if p_pagamentos is null or jsonb_typeof(p_pagamentos) <> 'array' or jsonb_array_length(p_pagamentos) = 0 then
      raise exception 'Pelo menos uma forma de pagamento deve ser informada.' using errcode = 'P0001';
    end if;
  end if;

  select coalesce(sum(payment.amount), 0)
    into v_payment_total
  from jsonb_to_recordset(p_pagamentos) as payment(
    payment_method text,
    amount numeric,
    received_cash numeric
  );

  if abs(v_payment_total - v_total) > 0.01 then
    if v_prices_changed then
      raise exception 'Os preços do catálogo mudaram desde que a comanda foi aberta. Recarregue os preços e tente novamente.'
        using errcode = 'P0001', hint = 'catalog_price_changed';
    end if;
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
    snapshot_commission_rule, snapshot_commission_base, snapshot_status
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
    'gross_amount',
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
      discount_type = v_discount_type,
      discount_percent = case when v_discount_type = 'percent' then p_discount_percent else null end,
      tip_amount = v_tip,
      tip_professional_id = p_tip_professional_id,
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
$function$;
