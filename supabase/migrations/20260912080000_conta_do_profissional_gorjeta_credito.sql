-- Ticket 04 da spec 034: Conta do Profissional, com gorjeta como credito.
-- ADR 019 registra o repasse de gorjeta como decisao distinta de comissionar gorjeta
-- (ADR 018 decidiu que gorjeta nao gera comissao). Esta migration NAO altera
-- create_commission_obligations_from_closed_comanda nem a base de calculo da
-- comissao: o credito de gorjeta nasce de um trigger proprio, separado do trigger
-- de obrigacoes de comissao. settle_comanda/settle_comanda_idempotent SAO
-- redefinidas (secao 5) apenas para receber a atribuicao da gorjeta como
-- parametro do proprio fechamento -- ver a secao 5 para o motivo.

-- -----------------------------------------------------------------------------
-- 1. Atribuicao de gorjeta persistida na Comanda
-- -----------------------------------------------------------------------------
alter table public.comandas
  add column if not exists tip_professional_id uuid references public.professionals(id) on delete restrict;

-- -----------------------------------------------------------------------------
-- 2. Tabela: professional_account_entries (Conta do Profissional)
-- -----------------------------------------------------------------------------
-- entry_type / direction como colunas discriminadoras separadas: cada formula de
-- saldo soma creditos e subtrai debitos por 'direction', sem precisar conhecer todo
-- 'entry_type' existente -- a mesma licao aplicada ao tipo novo de cash_movements
-- no ticket 03. Vale (debito) chega no ticket 05; aqui so gorjeta (credito) e usada.
create table if not exists public.professional_account_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete restrict,
  entry_type text not null,
  direction text not null,
  amount numeric(10,2) not null,
  settled_amount numeric(10,2) not null default 0,
  status text not null default 'open',
  reason text not null,
  comanda_id uuid references public.comandas(id) on delete restrict,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  reversed_at timestamptz,
  reversed_by uuid references public.users(id) on delete set null,
  reversal_reason text,
  constraint professional_account_entries_entry_type_check
    check (entry_type in ('vale', 'gorjeta')),
  constraint professional_account_entries_direction_check
    check (direction in ('credit', 'debit')),
  constraint professional_account_entries_amount_check check (amount > 0),
  constraint professional_account_entries_settled_amount_check
    check (settled_amount >= 0 and settled_amount <= amount),
  constraint professional_account_entries_status_check
    check (status in ('open', 'partially_paid', 'settled', 'reversed')),
  constraint professional_account_entries_status_balance_check check (
    status = 'reversed'
    or (status = 'open' and settled_amount = 0)
    or (status = 'partially_paid' and settled_amount > 0 and settled_amount < amount)
    or (status = 'settled' and settled_amount = amount)
  ),
  constraint professional_account_entries_reason_check
    check (length(btrim(reason)) >= 5)
);

create index if not exists idx_professional_account_entries_tenant_prof_status
  on public.professional_account_entries (tenant_id, professional_id, status);
create index if not exists idx_professional_account_entries_tenant_created_at
  on public.professional_account_entries (tenant_id, created_at);
create index if not exists idx_professional_account_entries_comanda
  on public.professional_account_entries (comanda_id)
  where comanda_id is not null;

-- Um credito de gorjeta em aberto por comanda: reabrir e fechar de novo gera um
-- lancamento novo sem colidir com o antigo, ja estornado (reversed_at is null exclui
-- os estornados do indice).
create unique index if not exists idx_professional_account_entries_tip_per_comanda
  on public.professional_account_entries (comanda_id)
  where entry_type = 'gorjeta' and reversed_at is null;

revoke all on table public.professional_account_entries from anon;
grant select on table public.professional_account_entries to authenticated;
-- Escrita exclusiva de funcoes security definer (trigger de gorjeta aqui; RPCs de
-- vale e de quitacao nos tickets seguintes), no mesmo padrao ja usado por
-- commission_obligations e commission_payout_allocations.
revoke insert, update, delete on table public.professional_account_entries from authenticated;

alter table public.professional_account_entries enable row level security;

-- Leitura: gestores veem qualquer profissional da unidade; o barbeiro ve so a
-- propria conta. Mesmo shape de commission_obligations_select_financial.
drop policy if exists professional_account_entries_select_financial on public.professional_account_entries;
create policy professional_account_entries_select_financial
  on public.professional_account_entries for select to authenticated
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

-- -----------------------------------------------------------------------------
-- 3. Trigger proprio de credito de gorjeta (separado do trigger de comissao)
-- -----------------------------------------------------------------------------
create or replace function public.create_professional_account_tip_entry_from_closed_comanda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status = 'fechada' and old.status is distinct from new.status
     and new.tip_amount > 0 and new.tip_professional_id is not null then
    insert into public.professional_account_entries (
      tenant_id, professional_id, entry_type, direction, amount, settled_amount,
      status, reason, comanda_id, created_by
    ) values (
      new.tenant_id, new.tip_professional_id, 'gorjeta', 'credit', new.tip_amount, 0,
      'open', 'Gorjeta da comanda', new.id, (select auth.uid())
    )
    on conflict (comanda_id) where (entry_type = 'gorjeta' and reversed_at is null)
    do nothing;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_create_professional_account_tip_entry on public.comandas;
create trigger trg_create_professional_account_tip_entry
after update of status on public.comandas
for each row
when (new.status = 'fechada' and old.status is distinct from new.status)
execute function public.create_professional_account_tip_entry_from_closed_comanda();

revoke all on function public.create_professional_account_tip_entry_from_closed_comanda() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. reopen_comanda: bloqueia reabertura com gorjeta ja quitada e estorna o
--    credito em aberto, no mesmo padrao ja aplicado a commission_obligations.
-- -----------------------------------------------------------------------------
create or replace function public.reopen_comanda(p_comanda_id uuid, p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_comanda public.comandas%rowtype;
  v_appointment public.appointments%rowtype;
  v_movement record;
  v_result jsonb;
  v_reversal_at timestamptz := timezone('utc'::text, now());
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  select role, tenant_id into v_user_role, v_user_tenant
  from public.users where id = v_user_id and is_active = true;
  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado para reabrir comandas.' using errcode = '42501';
  end if;
  if p_comanda_id is null or p_tenant_id is null then
    raise exception 'Comanda e unidade sao obrigatorias.' using errcode = '22023';
  end if;
  if v_user_role <> 'proprietario' and v_user_tenant <> p_tenant_id then
    raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
  end if;

  select * into v_comanda
  from public.comandas
  where id = p_comanda_id and tenant_id = p_tenant_id
  for update;
  if not found or v_comanda.status <> 'fechada' then
    raise exception '%', 'A comanda n' || chr(227) || 'o est' || chr(225) || ' fechada ou n' || chr(227) || 'o existe.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.commission_obligations o
    where o.comanda_id = v_comanda.id
      and o.tenant_id = p_tenant_id
      and (o.settled_amount > 0 or o.status = 'paid')
  ) then
    raise exception 'A comanda possui comissao ja quitada; estorne a quitacao antes de reabrir.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.professional_account_entries pae
    where pae.comanda_id = v_comanda.id
      and pae.tenant_id = p_tenant_id
      and pae.entry_type = 'gorjeta'
      and (pae.settled_amount > 0 or pae.status = 'settled')
  ) then
    raise exception 'A comanda possui gorjeta ja quitada; estorne a quitacao antes de reabrir.' using errcode = 'P0001';
  end if;

  update public.commission_obligations
  set status = 'reversed',
      reversed_at = timezone('utc'::text, now()),
      reversed_by = v_user_id,
      reversal_reason = 'Reabertura da comanda'
  where comanda_id = v_comanda.id
    and tenant_id = p_tenant_id
    and status = 'open'
    and settled_amount = 0;

  update public.professional_account_entries
  set status = 'reversed',
      reversed_at = timezone('utc'::text, now()),
      reversed_by = v_user_id,
      reversal_reason = 'Reabertura da comanda'
  where comanda_id = v_comanda.id
    and tenant_id = p_tenant_id
    and entry_type = 'gorjeta'
    and status = 'open'
    and settled_amount = 0;

  if v_comanda.appointment_id is not null then
    select * into v_appointment
    from public.appointments
    where id = v_comanda.appointment_id and tenant_id = p_tenant_id
    for update;
    if not found then
      raise exception 'Agendamento da comanda nao encontrado.' using errcode = 'P0001';
    end if;
    if v_appointment.status <> 'completed' or v_appointment.payment_status <> 'paid' then
      raise exception 'O agendamento ja possui outro estado e nao pode ser revertido com seguranca.' using errcode = 'P0001';
    end if;
  end if;

  if exists (
    select 1
    from public.comanda_pagamentos cp
    join public.cash_sessions cs on cs.id = cp.cash_session_id
    where cp.comanda_id = v_comanda.id
      and cp.tenant_id = p_tenant_id
      and cs.tenant_id = p_tenant_id
      and cs.status = 'closed'
  ) then
    raise exception 'A comanda pertence a uma sessao de caixa fechada; estorne o caixa antes de reabrir.' using errcode = 'P0001';
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
        and pm.reversed_at is null
      group by pm.product_id
    ) movements using (product_id)
    where coalesce(items.quantity, 0) <> coalesce(movements.quantity, 0)
  ) then
    raise exception '%', 'Os movimentos de estoque da comanda n' || chr(227) || 'o s' || chr(227) || 'o compat' || chr(237) || 'veis com o estorno.' using errcode = 'P0001';
  end if;

  for v_movement in
    select pm.* from public.product_movements pm
    where pm.comanda_id = v_comanda.id and pm.tenant_id = p_tenant_id
      and pm.movement_type = 'exit_sale_comanda'
      and pm.reversed_at is null
    order by pm.product_id, pm.id for update
  loop
    perform 1 from public.products
    where id = v_movement.product_id and tenant_id = p_tenant_id for update;
    if not found then
      raise exception 'Produto do movimento de estoque nao encontrado.' using errcode = 'P0001';
    end if;
    update public.products set stock_quantity = stock_quantity + v_movement.quantity
    where id = v_movement.product_id and tenant_id = p_tenant_id;
    insert into public.product_movements (
      tenant_id, product_id, movement_type, quantity, unit_cost,
      reason, comanda_id, created_by, reverses_movement_id
    ) values (
      p_tenant_id, v_movement.product_id, 'entry_reversal', v_movement.quantity,
      v_movement.unit_cost, 'Estorno da reabertura da comanda', v_comanda.id, v_user_id, v_movement.id
    );
    update public.product_movements
    set reversed_at = v_reversal_at,
        reversed_by = v_user_id,
        reversal_reason = 'Reabertura da comanda'
    where id = v_movement.id;
  end loop;

  insert into public.comanda_payment_reversals (
    tenant_id, comanda_id, original_payment_id, cash_session_id,
    payment_method, amount, change_amount, paid_at, reversed_by, reason
  )
  select
    cp.tenant_id, cp.comanda_id, cp.id, cp.cash_session_id,
    cp.payment_method, cp.amount, cp.change_amount, cp.paid_at,
    v_user_id, 'Reabertura da comanda'
  from public.comanda_pagamentos cp
  where cp.comanda_id = v_comanda.id and cp.tenant_id = p_tenant_id
  on conflict (original_payment_id) do nothing;

  delete from public.comanda_pagamentos
  where comanda_id = v_comanda.id and tenant_id = p_tenant_id;

  update public.comanda_itens
  set snapshot_status = 'reverted',
      snapshot_reverted_at = timezone('utc'::text, now()),
      snapshot_reverted_by = v_user_id
  where comanda_id = v_comanda.id and snapshot_status is distinct from 'reverted';

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
    'itens', coalesce((select jsonb_agg(to_jsonb(ci) order by ci.created_at, ci.id) from public.comanda_itens ci where ci.comanda_id = v_comanda.id), '[]'::jsonb),
    'pagamentos', coalesce((select jsonb_agg(to_jsonb(cp) order by cp.paid_at, cp.id) from public.comanda_pagamentos cp where cp.comanda_id = v_comanda.id), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;

-- -----------------------------------------------------------------------------
-- 5. settle_comanda / settle_comanda_idempotent: atribuicao da gorjeta gravada
--    no MESMO fechamento, nao por escrita separada antes de fechar.
-- -----------------------------------------------------------------------------
-- Correcao de projeto: uma escrita direta na Comanda ainda aberta, antes de
-- fechar, so funciona quando a linha ja existe -- mas o fluxo mais comum
-- (checkout de um agendamento novo a partir da Agenda) so cria a Comanda
-- DENTRO de settle_comanda_idempotent, via coalesce(p_comanda_id, p_operation_id).
-- Por isso a atribuicao precisa ser parametro do proprio fechamento.
--
-- Acrescentar parametro exige DROP explicito antes do CREATE: 'create or
-- replace function' so substitui no lugar quando a lista de tipos de
-- parametro e identica: um parametro novo, mesmo com default, e uma
-- assinatura diferente aos olhos do Postgres. Sem o drop, as duas
-- assinaturas coexistiriam e o PostgREST (que resolve por nome via RPC)
-- ficaria sujeito a ambiguidade -- o mesmo raciocinio que levou o
-- repositorio a remover o overload legado de register_commission_payout.
drop function if exists public.settle_comanda(uuid, uuid, uuid, uuid, numeric, numeric, uuid, jsonb, jsonb);
drop function if exists public.settle_comanda_idempotent(uuid, uuid, uuid, uuid, uuid, numeric, numeric, uuid, jsonb, jsonb);

create function public.settle_comanda(
  p_comanda_id uuid default null,
  p_tenant_id uuid default null,
  p_appointment_id uuid default null,
  p_customer_id uuid default null,
  p_discount_amount numeric default 0,
  p_tip_amount numeric default 0,
  p_cash_session_id uuid default null,
  p_itens jsonb default '[]'::jsonb,
  p_pagamentos jsonb default '[]'::jsonb,
  p_tip_professional_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function2$
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

  v_discount := round(coalesce(p_discount_amount, 0), 2);
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
$function2$;

revoke all on function public.settle_comanda(uuid, uuid, uuid, uuid, numeric, numeric, uuid, jsonb, jsonb, uuid) from public, anon;
grant execute on function public.settle_comanda(uuid, uuid, uuid, uuid, numeric, numeric, uuid, jsonb, jsonb, uuid) to authenticated;

create function public.settle_comanda_idempotent(
  p_operation_id uuid,
  p_comanda_id uuid default null,
  p_tenant_id uuid default null,
  p_appointment_id uuid default null,
  p_customer_id uuid default null,
  p_discount_amount numeric default 0,
  p_tip_amount numeric default 0,
  p_cash_session_id uuid default null,
  p_itens jsonb default '[]'::jsonb,
  p_pagamentos jsonb default '[]'::jsonb,
  p_tip_professional_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function3$
declare
  v_comanda_id uuid := coalesce(p_comanda_id, p_operation_id);
  v_tenant_id uuid := p_tenant_id;
  v_result jsonb;
begin
  if p_operation_id is null then
    raise exception 'Identificador da operacao e obrigatorio.' using errcode = '22023';
  end if;

  if p_tenant_id is null then
    raise exception 'Unidade nao informada.' using errcode = '22023';
  end if;

  insert into public.comandas (
    id, tenant_id, appointment_id, customer_id, status,
    total_amount, discount_amount, tip_amount
  ) values (
    v_comanda_id, v_tenant_id, p_appointment_id, p_customer_id, 'aberta', 0, 0, 0
  ) on conflict (id) do nothing;

  insert into public.comanda_settlement_requests (operation_id, tenant_id, comanda_id)
  values (p_operation_id, v_tenant_id, v_comanda_id)
  on conflict (operation_id) do nothing;

  select result into v_result
  from public.comanda_settlement_requests
  where operation_id = p_operation_id
    and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Operacao nao pertence a unidade informada.' using errcode = '42501';
  end if;
  if v_result is not null then
    return v_result;
  end if;

  v_result := public.settle_comanda(
    p_comanda_id => v_comanda_id,
    p_tenant_id => p_tenant_id,
    p_appointment_id => p_appointment_id,
    p_customer_id => p_customer_id,
    p_discount_amount => p_discount_amount,
    p_tip_amount => p_tip_amount,
    p_cash_session_id => p_cash_session_id,
    p_itens => p_itens,
    p_pagamentos => p_pagamentos,
    p_tip_professional_id => p_tip_professional_id
  );

  update public.comanda_settlement_requests
  set result = v_result
  where operation_id = p_operation_id and tenant_id = v_tenant_id;
  return v_result;
end;
$function3$;

revoke all on function public.settle_comanda_idempotent(uuid, uuid, uuid, uuid, uuid, numeric, numeric, uuid, jsonb, jsonb, uuid) from public, anon;
grant execute on function public.settle_comanda_idempotent(uuid, uuid, uuid, uuid, uuid, numeric, numeric, uuid, jsonb, jsonb, uuid) to authenticated;
