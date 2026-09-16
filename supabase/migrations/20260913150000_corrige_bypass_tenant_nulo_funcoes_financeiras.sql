-- Corrige bypass de isolamento de tenant quando public.users.tenant_id e NULL.
--
-- Falha: as RPCs financeiras abaixo (SECURITY DEFINER) usam
--   "v_user_role <> 'proprietario' and v_user_tenant <> p_tenant_id"
-- para bloquear um gerente/barbeiro de agir fora da propria unidade. Em SQL,
-- "NULL <> qualquer_coisa" avalia para NULL, nao para true -- e "if NULL then"
-- e tratado como falso pelo plpgsql. Como public.users.tenant_id e uma coluna
-- nullable, um usuario com role 'gerente' (ou 'barbeiro', em duas funcoes)
-- cadastrado sem tenant_id atravessa essa guarda para QUALQUER tenant
-- informado no parametro da chamada, obtendo leitura e escrita completas
-- sobre caixa, comissoes, vales e comandas de unidades alheias.
--
-- Correcao: troca a comparacao de tenant por "is distinct from", que trata
-- NULL corretamente (NULL is distinct from <qualquer coisa nao nula> = true),
-- replicando o padrao ja usado em get_cash_session_expected_amount e
-- get_projected_cash_flow. Nenhuma outra logica das funcoes e alterada:
-- SECURITY DEFINER, search_path = '' e os grants/revokes existentes sao
-- preservados (CREATE OR REPLACE FUNCTION nao afeta privilegios ja concedidos).
--
-- Encontrado por auditoria de seguranca em 2026-09-13 (SELECT em
-- pg_get_functiondef de todas as funcoes SECURITY DEFINER de public/private
-- contendo comparacoes de tenant). Reproduzido pelo teste pgTAP
-- supabase/tests/database/28_bloqueia_gerente_tenant_nulo.test.sql.

create or replace function public.adjust_product_stock(p_product_id uuid, p_movement_type text, p_quantity integer, p_unit_cost numeric, p_reason text DEFAULT NULL::text, p_comanda_id uuid DEFAULT NULL::uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_tenant_id uuid;
  v_current_stock integer;
  v_new_stock integer;
  v_delta integer;
  v_persisted_quantity integer;
  v_user_role text;
  v_user_tenant uuid;
begin
  select role, tenant_id
    into v_user_role, v_user_tenant
  from public.users
  where id = (select auth.uid())
    and is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado: apenas gerentes e proprietários podem movimentar estoque.';
  end if;

  select tenant_id, stock_quantity
    into v_tenant_id, v_current_stock
  from public.products
  where id = p_product_id
  for update;

  if v_tenant_id is null then
    raise exception 'Produto não encontrado.';
  end if;

  if v_user_role <> 'proprietario' and v_user_tenant is distinct from v_tenant_id then
    raise exception 'Acesso negado para este tenant.';
  end if;

  if p_movement_type in ('entry_manual', 'entry_purchase') then
    if p_quantity is null or p_quantity <= 0 then
      raise exception 'Quantidade de entrada deve ser maior que zero.';
    end if;
    v_delta := p_quantity;
    v_new_stock := v_current_stock + p_quantity;
  elsif p_movement_type in ('exit_manual', 'exit_sale_comanda', 'exit_internal_use') then
    if p_quantity is null or p_quantity <= 0 then
      raise exception 'Quantidade de saída deve ser maior que zero.';
    end if;
    if v_current_stock < p_quantity then
      raise exception 'Estoque insuficiente para a saída solicitada.';
    end if;
    v_delta := -p_quantity;
    v_new_stock := v_current_stock - p_quantity;
  elsif p_movement_type = 'adjustment' then
    if p_quantity is null or p_quantity < 0 then
      raise exception 'Ajuste de estoque não pode ser negativo.';
    end if;
    v_delta := p_quantity - v_current_stock;
    if v_delta = 0 then
      raise exception 'O ajuste informado não altera o estoque.';
    end if;
    v_new_stock := p_quantity;
  else
    raise exception 'Tipo de movimentação inválido: %', p_movement_type;
  end if;

  v_persisted_quantity := abs(v_delta);

  update public.products
  set stock_quantity = v_new_stock,
      cost_price = coalesce(p_unit_cost, cost_price)
  where id = p_product_id;

  insert into public.product_movements (
    tenant_id,
    product_id,
    comanda_id,
    movement_type,
    quantity,
    unit_cost,
    reason,
    created_by
  ) values (
    v_tenant_id,
    p_product_id,
    p_comanda_id,
    p_movement_type,
    v_persisted_quantity,
    coalesce(p_unit_cost, 0),
    p_reason,
    (select auth.uid())
  );

  return jsonb_build_object(
    'product_id', p_product_id,
    'previous_stock', v_current_stock,
    'new_stock', v_new_stock,
    'delta', v_delta
  );
end;
$function$;

create or replace function public.backfill_financial_history(p_tenant_id uuid DEFAULT NULL::uuid, p_batch_size integer DEFAULT 500)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_updated integer := 0;
  v_unavailable integer := 0;
  v_limit integer := greatest(1, least(coalesce(p_batch_size, 500), 5000));
begin
  select role, tenant_id into v_role, v_user_tenant
  from public.users where id = v_user_id and is_active = true;
  if v_role is null or v_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado para backfill financeiro.' using errcode = '42501';
  end if;
  if p_tenant_id is not null then
    if v_role <> 'proprietario' and v_user_tenant is distinct from p_tenant_id then
      raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
    end if;
    v_target_tenant := p_tenant_id;
  else
    v_target_tenant := v_user_tenant;
  end if;

  with candidates as (
    select ci.id
    from public.comanda_itens ci
    join public.comandas c on c.id = ci.comanda_id
    where c.status = 'fechada'
      and ci.snapshot_status is null
      and (v_target_tenant is null or ci.tenant_id = v_target_tenant)
      and ci.quantity is not null and ci.quantity > 0
      and ci.unit_price is not null and ci.unit_price >= 0
      and ci.total_price is not null and ci.total_price >= 0
      and c.discount_amount = 0
      and (ci.item_type in ('servico', 'service', 'produto', 'product'))
      and (ci.service_id is not null or ci.product_id is not null)
    order by ci.created_at, ci.id
    limit v_limit
  ), updated_rows as (
    update public.comanda_itens ci
    set snapshot_quantity = ci.quantity,
        snapshot_unit_price = ci.unit_price,
        snapshot_gross_amount = ci.total_price,
        snapshot_discount_amount = 0,
        snapshot_net_amount = ci.total_price,
        snapshot_unit_cost = case when ci.product_id is not null then coalesce((select p.cost_price from public.products p where p.id = ci.product_id and p.tenant_id = ci.tenant_id), 0) else null end,
        snapshot_commission_percentage = case
          when ci.service_id is not null then coalesce(
            (select ps.custom_commission_percentage from public.professional_services ps where ps.service_id = ci.service_id and ps.professional_id = ci.professional_id and ps.tenant_id = ci.tenant_id),
            (select s.commission_percentage from public.services s where s.id = ci.service_id and s.tenant_id = ci.tenant_id),
            (select p.commission_percentage from public.professionals p where p.id = ci.professional_id and p.tenant_id = ci.tenant_id), 0)
          when ci.product_id is not null then coalesce((select p.commission_percentage from public.products p where p.id = ci.product_id and p.tenant_id = ci.tenant_id), 0)
          else 0
        end,
        snapshot_commission_amount = round(ci.total_price * case
          when ci.service_id is not null then coalesce(
            (select ps.custom_commission_percentage from public.professional_services ps where ps.service_id = ci.service_id and ps.professional_id = ci.professional_id and ps.tenant_id = ci.tenant_id),
            (select s.commission_percentage from public.services s where s.id = ci.service_id and s.tenant_id = ci.tenant_id),
            (select p.commission_percentage from public.professionals p where p.id = ci.professional_id and p.tenant_id = ci.tenant_id), 0)
          when ci.product_id is not null then coalesce((select p.commission_percentage from public.products p where p.id = ci.product_id and p.tenant_id = ci.tenant_id), 0)
          else 0
        end / 100, 2),
        snapshot_commission_rule = case
          when ci.service_id is not null
           and ci.professional_id is not null
           and (select ps.custom_commission_percentage
                from public.professional_services ps
                where ps.service_id = ci.service_id
                  and ps.professional_id = ci.professional_id
                  and ps.tenant_id = ci.tenant_id) is not null
            then 'professional_service'
          when ci.service_id is not null
           and (select s.commission_percentage
                from public.services s
                where s.id = ci.service_id
                  and s.tenant_id = ci.tenant_id) is not null
            then 'service'
          when ci.service_id is not null
           and ci.professional_id is not null
           and (select p.commission_percentage
                from public.professionals p
                where p.id = ci.professional_id
                  and p.tenant_id = ci.tenant_id) is not null
            then 'professional'
          when ci.product_id is not null then 'product'
          else 'none'
        end,
        snapshot_status = 'estimated',
        snapshot_data_quality = 'estimated'
    where ci.id in (select id from candidates)
    returning ci.id
  )
  select count(*) into v_updated from updated_rows;

  select count(*) into v_unavailable
  from public.comanda_itens ci
  join public.comandas c on c.id = ci.comanda_id
  where c.status = 'fechada'
    and ci.snapshot_status is null
    and (v_target_tenant is null or ci.tenant_id = v_target_tenant);

  return jsonb_build_object(
    'tenant_id', v_target_tenant,
    'batch_size', v_limit,
    'estimated_updated', v_updated,
    'unavailable_remaining', v_unavailable
  );
end;
$function$;

create or replace function public.cancel_comanda_appointment(p_comanda_id uuid DEFAULT NULL::uuid, p_appointment_id uuid DEFAULT NULL::uuid, p_tenant_id uuid DEFAULT NULL::uuid)
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
  v_comanda public.comandas%rowtype;
  v_appointment public.appointments%rowtype;
begin
  if v_user_id is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  select u.role, u.tenant_id
    into v_user_role, v_user_tenant
  from public.users u
  where u.id = v_user_id
    and u.is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado para cancelar atendimento.' using errcode = '42501';
  end if;

  v_target_tenant := coalesce(p_tenant_id, v_user_tenant);
  if v_target_tenant is null then
    raise exception 'Unidade nao informada.' using errcode = '22023';
  end if;
  if v_user_role <> 'proprietario' and v_user_tenant is distinct from v_target_tenant then
    raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
  end if;
  if p_comanda_id is null and p_appointment_id is null then
    raise exception 'Comanda ou agendamento deve ser informado.' using errcode = '22023';
  end if;

  if p_comanda_id is not null then
    select * into v_comanda
    from public.comandas
    where id = p_comanda_id
      and tenant_id = v_target_tenant
    for update;

    if not found or v_comanda.status not in ('aberta', 'open') then
      raise exception 'A comanda nao existe ou nao esta aberta.' using errcode = 'P0001';
    end if;
    if p_appointment_id is not null
       and v_comanda.appointment_id is distinct from p_appointment_id then
      raise exception 'Comanda e agendamento nao pertencem ao mesmo atendimento.' using errcode = '22023';
    end if;
  end if;

  if p_appointment_id is not null then
    select * into v_appointment
    from public.appointments
    where id = p_appointment_id
      and tenant_id = v_target_tenant
    for update;

    if not found then
      raise exception 'Agendamento nao encontrado.' using errcode = 'P0001';
    end if;
  end if;

  if p_comanda_id is not null then
    update public.comandas
    set status = 'cancelada',
        closed_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    where id = p_comanda_id
      and tenant_id = v_target_tenant;
  end if;

  if p_appointment_id is not null then
    update public.appointments
    set status = 'canceled',
        updated_at = timezone('utc'::text, now())
    where id = p_appointment_id
      and tenant_id = v_target_tenant;
  end if;

  return jsonb_build_object(
    'tenant_id', v_target_tenant,
    'comanda_id', p_comanda_id,
    'appointment_id', p_appointment_id,
    'status', 'canceled'
  );
end;
$function$;

create or replace function public.close_cash_session(p_session_id uuid, p_tenant_id uuid, p_closing_amount numeric, p_notes text DEFAULT NULL::text)
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
  v_cash_received numeric := 0;
  v_pix_received numeric := 0;
  v_card_received numeric := 0;
  v_other_received numeric := 0;
  v_payment_count integer := 0;
  v_supplies numeric := 0;
  v_withdrawals numeric := 0;
  v_commission_payouts numeric := 0;
  v_professional_advances numeric := 0;
  v_expected numeric := 0;
  v_difference numeric := 0;
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
    raise exception 'Acesso negado. Apenas gerentes e proprietários podem fechar o caixa.' using errcode = '42501';
  end if;
  if p_session_id is null or p_tenant_id is null then
    raise exception 'Sessão e unidade são obrigatórias.' using errcode = '22023';
  end if;
  if p_closing_amount is null or p_closing_amount < 0 then
    raise exception 'O valor de fechamento não pode ser negativo.' using errcode = '22023';
  end if;
  if v_user_role <> 'proprietario' and v_user_tenant is distinct from p_tenant_id then
    raise exception 'Acesso negado para a unidade solicitada.' using errcode = '42501';
  end if;

  select * into v_session
  from public.cash_sessions
  where id = p_session_id and tenant_id = p_tenant_id
  for update;
  if not found or v_session.status <> 'open' then
    raise exception 'A sessão de caixa não está aberta ou não existe.' using errcode = 'P0001';
  end if;

  select
    coalesce(sum(cp.amount) filter (where cp.payment_method = 'cash'), 0),
    coalesce(sum(cp.amount) filter (where cp.payment_method = 'pix'), 0),
    coalesce(sum(cp.amount) filter (where cp.payment_method in ('credit_card', 'debit_card')), 0),
    coalesce(sum(cp.amount) filter (where cp.payment_method = 'other'), 0),
    count(*)
  into v_cash_received, v_pix_received, v_card_received, v_other_received, v_payment_count
  from public.comanda_pagamentos cp
  where cp.cash_session_id = p_session_id and cp.tenant_id = p_tenant_id;

  select
    coalesce(sum(cm.amount) filter (where cm.type = 'suprimento'), 0),
    coalesce(sum(cm.amount) filter (where cm.type = 'sangria'), 0),
    coalesce(sum(cm.amount) filter (where cm.type = 'repasse_comissao' and cm.reversed_at is null), 0),
    coalesce(sum(cm.amount) filter (where cm.type = 'vale_profissional' and cm.reversed_at is null), 0)
  into v_supplies, v_withdrawals, v_commission_payouts, v_professional_advances
  from public.cash_movements cm
  where cm.cash_session_id = p_session_id and cm.tenant_id = p_tenant_id;

  v_expected := round(
    v_session.initial_amount + v_cash_received + v_supplies - v_withdrawals
      - v_commission_payouts - v_professional_advances,
    2
  );
  v_difference := round(p_closing_amount - v_expected, 2);

  update public.cash_sessions
  set closed_by = v_user_id,
      closing_amount = round(p_closing_amount, 2),
      expected_amount = v_expected,
      difference_amount = v_difference,
      cash_received_amount = round(v_cash_received, 2),
      pix_received_amount = round(v_pix_received, 2),
      card_received_amount = round(v_card_received, 2),
      other_received_amount = round(v_other_received, 2),
      payment_count = v_payment_count,
      supplies_amount = round(v_supplies, 2),
      withdrawals_amount = round(v_withdrawals, 2),
      calculation_version = 'cash_expected_v3',
      status = 'closed',
      closed_at = timezone('utc'::text, now()),
      notes = p_notes
  where id = p_session_id and tenant_id = p_tenant_id
  returning * into v_session;

  select to_jsonb(v_session) || jsonb_build_object(
    'cash_received', v_cash_received,
    'pix_received', v_pix_received,
    'card_received', v_card_received,
    'other_received', v_other_received,
    'payment_count', v_payment_count,
    'supplies', v_supplies,
    'withdrawals', v_withdrawals,
    'commission_payouts', v_commission_payouts,
    'professional_advances', v_professional_advances
  ) into v_result;
  return v_result;
end;
$function$;

create or replace function public.get_cash_session_statement(p_session_id uuid, p_tenant_id uuid)
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
  v_adjustments jsonb;
  v_adjusted_difference numeric;
  v_movements jsonb;
  v_reopenings jsonb;
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
    raise exception 'Acesso negado. Apenas gerentes e proprietários podem consultar o extrato do caixa.' using errcode = '42501';
  end if;

  if p_session_id is null or p_tenant_id is null then
    raise exception 'Sessão e unidade são obrigatórias.' using errcode = '22023';
  end if;

  if v_user_role <> 'proprietario' and v_user_tenant is distinct from p_tenant_id then
    raise exception 'Acesso negado para a unidade solicitada.' using errcode = '42501';
  end if;

  select * into v_session
  from public.cash_sessions
  where id = p_session_id and tenant_id = p_tenant_id;

  if not found then
    raise exception 'A sessão de caixa não existe.' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'created_by', a.created_by,
      'reason', a.reason,
      'adjustment_amount', a.adjustment_amount,
      'original_expected_amount', a.original_expected_amount,
      'original_closing_amount', a.original_closing_amount,
      'original_difference_amount', a.original_difference_amount,
      'adjusted_expected_amount', a.adjusted_expected_amount,
      'adjusted_closing_amount', a.adjusted_closing_amount,
      'adjusted_difference_amount', a.adjusted_difference_amount,
      'created_at', a.created_at
    )
    order by a.created_at
  ), '[]'::jsonb),
  coalesce(sum(a.adjustment_amount), 0)
  into v_adjustments, v_adjusted_difference
  from public.cash_session_adjustments a
  where a.cash_session_id = p_session_id and a.tenant_id = p_tenant_id;

  v_adjusted_difference := coalesce(v_session.difference_amount, 0) + v_adjusted_difference;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'type', m.type,
      'amount', m.amount,
      'reason', m.reason,
      'performed_by', m.performed_by,
      'payout_id', m.payout_id,
      'created_at', m.created_at,
      'reversed_at', m.reversed_at,
      'reversed_by', m.reversed_by,
      'reversal_reason', m.reversal_reason
    )
    order by m.created_at
  ), '[]'::jsonb)
  into v_movements
  from public.cash_movements m
  where m.cash_session_id = p_session_id and m.tenant_id = p_tenant_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'reopened_by', r.reopened_by,
      'reopened_at', r.reopened_at,
      'reason', r.reason,
      'original_closing_amount', r.original_closing_amount,
      'original_expected_amount', r.original_expected_amount,
      'original_difference_amount', r.original_difference_amount,
      'original_closed_by', r.original_closed_by,
      'original_closed_at', r.original_closed_at
    )
    order by r.reopened_at
  ), '[]'::jsonb)
  into v_reopenings
  from public.cash_session_reopenings r
  where r.cash_session_id = p_session_id and r.tenant_id = p_tenant_id;

  v_result := jsonb_build_object(
    'session', to_jsonb(v_session),
    'adjustments', v_adjustments,
    'adjusted_difference_amount', v_adjusted_difference,
    'movements', v_movements,
    'reopenings', v_reopenings
  );

  return v_result;
end;
$function$;

create or replace function public.get_daily_financial_summary(p_start_date date, p_end_date date, p_time_zone text, p_tenant_id uuid DEFAULT NULL::uuid, p_cash_session_id uuid DEFAULT NULL::uuid)
 returns json
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user_id uuid;
  v_user_tenant_id uuid;
  v_user_role text;
  v_target_tenant_id uuid;
  v_tenant_time_zone text;
  v_result json;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Usuário não autenticado.' using errcode = '42501';
  end if;

  select tenant_id, role
    into v_user_tenant_id, v_user_role
  from public.users
  where id = v_user_id
    and is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado. Apenas gerentes e proprietários podem acessar o resumo financeiro.' using errcode = '42501';
  end if;

  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
    raise exception 'O período financeiro diário é inválido.' using errcode = '22023';
  end if;

  if p_tenant_id is not null then
    if v_user_role <> 'proprietario' and v_user_tenant_id is distinct from p_tenant_id then
      raise exception 'Acesso negado para a unidade solicitada.' using errcode = '42501';
    end if;
    v_target_tenant_id := p_tenant_id;
  else
    v_target_tenant_id := v_user_tenant_id;
  end if;

  select timezone
    into v_tenant_time_zone
  from public.tenants
  where id = v_target_tenant_id;

  if v_tenant_time_zone is null or btrim(v_tenant_time_zone) = '' then
    raise exception 'O fuso horário da barbearia é obrigatório.' using errcode = '22023';
  end if;

  if p_time_zone is null or btrim(p_time_zone) = '' or p_time_zone <> v_tenant_time_zone then
    raise exception 'O fuso horário informado não corresponde ao configurado na barbearia.' using errcode = '22023';
  end if;

  perform now() at time zone v_tenant_time_zone;

  with days as (
    select generate_series(p_start_date, p_end_date, interval '1 day')::date as local_date
  ),
  closed_comandas as (
    select
      (c.closed_at at time zone v_tenant_time_zone)::date as local_date,
      coalesce(sum(c.total_amount), 0.00) as realized_revenue,
      count(*)::integer as closed_comandas_count
    from public.comandas c
    where c.tenant_id = v_target_tenant_id
      and c.status in ('fechada', 'closed')
      and c.closed_at >= (p_start_date::timestamp at time zone v_tenant_time_zone)
      and c.closed_at < ((p_end_date + 1)::timestamp at time zone v_tenant_time_zone)
    group by (c.closed_at at time zone v_tenant_time_zone)::date
  ),
  payments as (
    select
      (cp.paid_at at time zone v_tenant_time_zone)::date as local_date,
      coalesce(sum(cp.amount), 0.00) as received_total,
      coalesce(sum(cp.amount) filter (where cp.payment_method = 'cash'), 0.00) as dinheiro,
      coalesce(sum(cp.amount) filter (where cp.payment_method = 'pix'), 0.00) as pix,
      coalesce(sum(cp.amount) filter (where cp.payment_method in ('credit_card', 'debit_card')), 0.00) as cartao,
      coalesce(sum(cp.amount) filter (where cp.payment_method = 'other'), 0.00) as outros,
      count(*)::integer as payment_count
    from public.comanda_pagamentos cp
    join public.comandas c
      on c.id = cp.comanda_id
     and c.tenant_id = cp.tenant_id
    where cp.tenant_id = v_target_tenant_id
      and c.status in ('fechada', 'closed')
      and cp.paid_at >= (p_start_date::timestamp at time zone v_tenant_time_zone)
      and cp.paid_at < ((p_end_date + 1)::timestamp at time zone v_tenant_time_zone)
      and (p_cash_session_id is null or cp.cash_session_id = p_cash_session_id)
    group by (cp.paid_at at time zone v_tenant_time_zone)::date
  )
  select coalesce(
    json_agg(
      json_build_object(
        'date', d.local_date,
        'realized_revenue', coalesce(cc.realized_revenue, 0.00),
        'received_total', coalesce(p.received_total, 0.00),
        'by_method', json_build_object(
          'dinheiro', coalesce(p.dinheiro, 0.00),
          'pix', coalesce(p.pix, 0.00),
          'cartao', coalesce(p.cartao, 0.00),
          'outros', coalesce(p.outros, 0.00)
        ),
        'closed_comandas_count', coalesce(cc.closed_comandas_count, 0),
        'payment_count', coalesce(p.payment_count, 0)
      )
      order by d.local_date
    ),
    '[]'::json
  )
  into v_result
  from days d
  left join closed_comandas cc on cc.local_date = d.local_date
  left join payments p on p.local_date = d.local_date;

  return v_result;
end;
$function$;

create or replace function public.get_professional_account_statement(p_professional_id uuid, p_tenant_id uuid DEFAULT NULL::uuid)
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

create or replace function public.get_professional_commission_balance(p_professional_id uuid, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_tenant_id uuid DEFAULT NULL::uuid)
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

create or replace function public.get_tenant_current_commission_balance(p_tenant_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_user_role text;
  v_user_tenant uuid;
  v_open_obligations numeric := 0;
  v_legacy_generated numeric := 0;
  v_legacy_paid numeric := 0;
begin
  select role, tenant_id into v_user_role, v_user_tenant
  from public.users where id = v_user_id and is_active = true;
  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado para consultar comissoes.' using errcode = '42501';
  end if;
  if p_tenant_id is null
     or (v_user_role <> 'proprietario' and v_user_tenant is distinct from p_tenant_id) then
    raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
  end if;

  select coalesce(sum(greatest(0, o.amount - o.settled_amount)), 0)
    into v_open_obligations
  from public.commission_obligations o
  where o.tenant_id = p_tenant_id
    and o.status in ('open', 'partially_paid');

  with legacy_items as (
    select
      case
        when ci.snapshot_status in ('confirmed', 'estimated')
         and ci.snapshot_commission_amount is not null
          then ci.snapshot_commission_amount
        when ci.snapshot_status in ('unavailable', 'reverted') then 0
        when ci.item_type in ('servico', 'service') or ci.service_id is not null then
          round(ci.total_price * coalesce(ps.custom_commission_percentage, s.commission_percentage, prof.commission_percentage, 0) / 100, 2)
        when ci.item_type in ('produto', 'product') or ci.product_id is not null then
          round(ci.total_price * coalesce(prod.commission_percentage, 0) / 100, 2)
        else 0
      end as commission_amount
    from public.comanda_itens ci
    join public.comandas c on c.id = ci.comanda_id
    left join public.professionals prof on prof.id = ci.professional_id
    left join public.services s on s.id = ci.service_id
    left join public.professional_services ps on ps.service_id = ci.service_id and ps.professional_id = ci.professional_id and ps.tenant_id = ci.tenant_id
    left join public.products prod on prod.id = ci.product_id
    where c.tenant_id = p_tenant_id
      and c.status in ('fechada', 'closed')
      and ci.professional_id is not null
      and not exists (select 1 from public.commission_obligations o where o.comanda_item_id = ci.id)
  )
  select coalesce(sum(commission_amount), 0) into v_legacy_generated from legacy_items;

  select coalesce(sum(
    case
      when exists (select 1 from public.commission_payout_allocations a where a.payout_id = cp.id)
        then coalesce(cp.legacy_allocated_amount, 0)
      else cp.amount
    end
  ), 0) into v_legacy_paid
  from public.commission_payouts cp
  where cp.tenant_id = p_tenant_id;

  return jsonb_build_object('current_open_balance', v_open_obligations + greatest(0, v_legacy_generated - v_legacy_paid));
end;
$function$;

create or replace function public.get_tenant_financial_metrics(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_tenant_id uuid DEFAULT NULL::uuid)
 returns json
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user_id uuid;
  v_user_tenant_id uuid;
  v_user_role text;
  v_target_tenant_id uuid;
  v_total_revenue numeric := 0.00;
  v_services_revenue numeric := 0.00;
  v_products_revenue numeric := 0.00;
  v_products_count integer := 0;
  v_products_cost numeric := 0.00;
  v_total_commission numeric := 0.00;
  v_paid_commission numeric := 0.00;
  v_pending_commission numeric := 0.00;
  v_net_revenue numeric := 0.00;
  v_discounts_total numeric := 0.00;
  v_tips_total numeric := 0.00;
  v_operational_revenue numeric := 0.00;
  v_snapshot_comandas_count integer := 0;
  v_estimated_comandas_count integer := 0;
  v_legacy_comandas_count integer := 0;
  v_historical_data_quality text := 'unavailable';
  v_revenue_by_method json;
  v_commissions_by_professional json;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  select tenant_id, role into v_user_tenant_id, v_user_role
  from public.users where id = v_user_id and is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado. Apenas gerentes e proprietarios podem acessar metricas financeiras.' using errcode = '42501';
  end if;

  if p_tenant_id is not null then
    if v_user_role <> 'proprietario' and v_user_tenant_id is distinct from p_tenant_id then
      raise exception 'Acesso negado para a unidade solicitada.' using errcode = '42501';
    end if;
    v_target_tenant_id := p_tenant_id;
  else
    v_target_tenant_id := v_user_tenant_id;
  end if;

  if v_target_tenant_id is null then
    raise exception 'Unidade (tenant_id) nao informada.' using errcode = '22023';
  end if;

  -- O total continua sendo o total fechado da comanda, incluindo gorjeta,
  -- enquanto os indicadores de itens passam a usar o liquido snapshotado.
  select
    coalesce(sum(c.total_amount), 0.00),
    coalesce(sum(c.discount_amount), 0.00),
    coalesce(sum(c.tip_amount), 0.00)
  into v_total_revenue, v_discounts_total, v_tips_total
  from public.comandas c
  where c.tenant_id = v_target_tenant_id
    and c.status in ('fechada', 'closed')
    and c.closed_at >= p_start_date
    and c.closed_at <= p_end_date;

  with target_comandas as (
    select c.id
    from public.comandas c
    where c.tenant_id = v_target_tenant_id
      and c.status in ('fechada', 'closed')
      and c.closed_at >= p_start_date
      and c.closed_at <= p_end_date
  ), item_breakdown as (
    select
      ci.id as item_id,
      ci.comanda_id,
      ci.professional_id,
      ci.quantity,
      ci.total_price,
      ci.item_type,
      ci.service_id,
      ci.product_id,
      case
        when ci.snapshot_status in ('confirmed', 'estimated') and ci.snapshot_net_amount is not null
          then ci.snapshot_net_amount
        when ci.snapshot_status = 'unavailable' and ci.total_price is not null
          then ci.total_price
        else 0.00
      end as recognized_revenue,
      case
        when ci.snapshot_status in ('confirmed', 'estimated') and ci.snapshot_gross_amount is not null
          then ci.snapshot_gross_amount
        when ci.snapshot_status = 'unavailable' and ci.total_price is not null
          then ci.total_price
        else 0.00
      end as recognized_gross,
      case
        when ci.snapshot_status in ('confirmed', 'estimated') then coalesce(ci.snapshot_quantity, ci.quantity)
        when ci.snapshot_status = 'unavailable' then coalesce(ci.quantity, 0)
        else 0
      end as recognized_quantity,
      case
        when ci.snapshot_status in ('confirmed', 'estimated') then coalesce(ci.snapshot_unit_cost, 0.00)
        else 0.00
      end as recognized_unit_cost,
      case
        when ci.snapshot_status in ('confirmed', 'estimated') and ci.snapshot_commission_amount is not null
          then ci.snapshot_commission_amount
        else 0.00
      end as recognized_commission,
      ci.snapshot_status,
      case
        when ci.snapshot_status = 'confirmed'
         and ci.snapshot_quantity is not null
         and ci.snapshot_unit_price is not null
         and ci.snapshot_gross_amount is not null
         and ci.snapshot_discount_amount is not null
         and ci.snapshot_net_amount is not null
         and ci.snapshot_commission_percentage is not null
         and ci.snapshot_commission_amount is not null
         and ci.snapshot_commission_rule is not null
         and (ci.item_type <> 'produto' or ci.snapshot_unit_cost is not null)
          then true
        else false
      end as snapshot_complete
    from public.comanda_itens ci
    join target_comandas tc on tc.id = ci.comanda_id
  )
  select
    coalesce(sum(ib.recognized_revenue) filter (where ib.item_type in ('servico', 'service') or ib.service_id is not null), 0.00),
    coalesce(sum(ib.recognized_revenue) filter (where ib.item_type in ('produto', 'product') or ib.product_id is not null), 0.00),
    coalesce(sum(ib.recognized_quantity) filter (where ib.item_type in ('produto', 'product') or ib.product_id is not null), 0),
    coalesce(sum(ib.recognized_unit_cost * ib.recognized_quantity) filter (where ib.item_type in ('produto', 'product') or ib.product_id is not null), 0.00),
    coalesce(sum(ib.recognized_commission), 0.00)
  into v_services_revenue, v_products_revenue, v_products_count, v_products_cost, v_total_commission
  from item_breakdown ib;

  v_operational_revenue := v_services_revenue + v_products_revenue;

  with target_comandas as (
    select c.id
    from public.comandas c
    where c.tenant_id = v_target_tenant_id
      and c.status in ('fechada', 'closed')
      and c.closed_at >= p_start_date
      and c.closed_at <= p_end_date
  ), item_quality as (
    select
      tc.id,
      case
        when count(ci.id) > 0 and bool_and(
          ci.snapshot_status = 'confirmed'
          and ci.snapshot_quantity is not null
          and ci.snapshot_unit_price is not null
          and ci.snapshot_gross_amount is not null
          and ci.snapshot_discount_amount is not null
          and ci.snapshot_net_amount is not null
          and ci.snapshot_commission_percentage is not null
          and ci.snapshot_commission_amount is not null
          and ci.snapshot_commission_rule is not null
          and (ci.item_type <> 'produto' or ci.snapshot_unit_cost is not null)
        ) then 'confirmed'
        when count(ci.id) > 0 and bool_and(
          ci.snapshot_status in ('confirmed', 'estimated')
          and ci.snapshot_quantity is not null
          and ci.snapshot_unit_price is not null
          and ci.snapshot_gross_amount is not null
          and ci.snapshot_discount_amount is not null
          and ci.snapshot_net_amount is not null
          and ci.snapshot_commission_percentage is not null
          and ci.snapshot_commission_amount is not null
          and ci.snapshot_commission_rule is not null
          and (ci.item_type <> 'produto' or ci.snapshot_unit_cost is not null)
        ) then 'estimated'
        else 'legacy'
      end as data_quality
    from target_comandas tc
    left join public.comanda_itens ci on ci.comanda_id = tc.id
    group by tc.id
  )
  select
    count(*) filter (where data_quality = 'confirmed'),
    count(*) filter (where data_quality = 'estimated'),
    count(*) filter (where data_quality = 'legacy')
  into v_snapshot_comandas_count, v_estimated_comandas_count, v_legacy_comandas_count
  from item_quality;

  v_historical_data_quality := case
    when v_snapshot_comandas_count > 0 and v_estimated_comandas_count = 0 and v_legacy_comandas_count = 0 then 'confirmed'
    when v_snapshot_comandas_count = 0 and v_estimated_comandas_count > 0 and v_legacy_comandas_count = 0 then 'estimated'
    when v_snapshot_comandas_count = 0 and v_estimated_comandas_count = 0 and v_legacy_comandas_count > 0 then 'legacy'
    when v_snapshot_comandas_count > 0 or v_estimated_comandas_count > 0 then 'mixed'
    when v_legacy_comandas_count > 0 then 'legacy'
    else 'unavailable'
  end;

  select coalesce(sum(amount), 0.00)
  into v_paid_commission
  from public.commission_payouts
  where tenant_id = v_target_tenant_id
    and paid_at >= p_start_date
    and paid_at <= p_end_date;

  select coalesce((public.get_tenant_current_commission_balance(v_target_tenant_id)->>'current_open_balance')::numeric, 0.00) into v_pending_commission;
  v_net_revenue := v_total_revenue - v_total_commission - v_products_cost;

  with target_comandas as (
    select c.id
    from public.comandas c
    where c.tenant_id = v_target_tenant_id
      and c.status in ('fechada', 'closed')
      and c.closed_at >= p_start_date
      and c.closed_at <= p_end_date
  )
  select coalesce(json_object_agg(method, amount_sum), '{}'::json)
  into v_revenue_by_method
  from (
    select cp.payment_method as method, coalesce(sum(cp.amount), 0.00) as amount_sum
    from public.comanda_pagamentos cp
    join target_comandas tc on tc.id = cp.comanda_id
    group by cp.payment_method
  ) payment_totals;

  with target_comandas as (
    select c.id
    from public.comandas c
    where c.tenant_id = v_target_tenant_id
      and c.status in ('fechada', 'closed')
      and c.closed_at >= p_start_date
      and c.closed_at <= p_end_date
  ), item_breakdown as (
    select
      ci.comanda_id,
      ci.professional_id,
      case
        when ci.snapshot_status in ('confirmed', 'estimated') and ci.snapshot_gross_amount is not null
          then ci.snapshot_gross_amount
        when ci.snapshot_status = 'unavailable' and ci.total_price is not null
          then ci.total_price
        else 0.00
      end as recognized_gross,
      case
        when ci.snapshot_status in ('confirmed', 'estimated') and ci.snapshot_commission_amount is not null
          then ci.snapshot_commission_amount
        else 0.00
      end as recognized_commission
    from public.comanda_itens ci
    join target_comandas tc on tc.id = ci.comanda_id
  ), prof_payouts as (
    select professional_id, coalesce(sum(amount), 0.00) as paid_amount
    from public.commission_payouts
    where tenant_id = v_target_tenant_id
      and paid_at >= p_start_date
      and paid_at <= p_end_date
    group by professional_id
  ), prof_stats as (
    select
      prof.id as professional_id,
      prof.name as professional_name,
      coalesce(sum(ib.recognized_gross), 0.00) as gross_sum,
      coalesce(sum(ib.recognized_commission), 0.00) as commission_sum,
      coalesce(pp.paid_amount, 0.00) as paid_sum,
      coalesce((public.get_professional_commission_balance(prof.id, null, null, v_target_tenant_id)->>'current_open_balance')::numeric, 0.00) as pending_sum,
      count(distinct ib.comanda_id) as appointments_count
    from public.professionals prof
    left join item_breakdown ib on ib.professional_id = prof.id
    left join prof_payouts pp on pp.professional_id = prof.id
    where prof.tenant_id = v_target_tenant_id
      and prof.is_active = true
    group by prof.id, prof.name, pp.paid_amount
    order by commission_sum desc, prof.name asc
  )
  select coalesce(json_agg(json_build_object(
    'professional_id', professional_id,
    'professional_name', professional_name,
    'gross_sum', gross_sum,
    'commission_sum', commission_sum,
    'paid_sum', paid_sum,
    'pending_sum', pending_sum,
    'appointments_count', appointments_count
  )), '[]'::json)
  into v_commissions_by_professional
  from prof_stats;

  return json_build_object(
    'total_revenue', v_total_revenue,
    'services_revenue', v_services_revenue,
    'products_revenue', v_products_revenue,
    'products_count', v_products_count,
    'products_cost', v_products_cost,
    'total_commission', v_total_commission,
    'paid_commission', v_paid_commission,
    'pending_commission', v_pending_commission,
    'net_revenue', v_net_revenue,
    'revenue_by_method', v_revenue_by_method,
    'commissions_by_professional', v_commissions_by_professional,
    'discounts_total', v_discounts_total,
    'tips_total', v_tips_total,
    'operational_revenue', v_operational_revenue,
    'historical_data_quality', v_historical_data_quality,
    'snapshot_comandas_count', v_snapshot_comandas_count,
    'estimated_comandas_count', v_estimated_comandas_count,
    'legacy_comandas_count', v_legacy_comandas_count
  );
end;
$function$;

create or replace function public.register_cash_session_adjustment(p_session_id uuid, p_tenant_id uuid, p_adjustment_amount numeric, p_reason text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_user_role text;
  v_user_tenant uuid;
  v_session public.cash_sessions%rowtype;
  v_adjustment_id uuid;
  v_adjusted_expected numeric;
  v_adjusted_closing numeric;
  v_adjusted_difference numeric;
  v_previous_adjustment_amount numeric := 0;
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
  if v_user_role <> 'proprietario' and v_user_tenant is distinct from p_tenant_id then
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

  select coalesce(sum(adjustment_amount), 0)
    into v_previous_adjustment_amount
  from public.cash_session_adjustments
  where cash_session_id = p_session_id;

  v_adjusted_expected := v_session.expected_amount;
  v_adjusted_closing := round(
    v_session.closing_amount + v_previous_adjustment_amount + round(p_adjustment_amount, 2),
    2
  );
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
    'previous_adjustment_amount', v_previous_adjustment_amount,
    'adjusted_closing_amount', v_adjusted_closing,
    'adjusted_difference_amount', v_adjusted_difference
  );
end;
$function$;

create or replace function public.register_commission_payout(p_professional_id uuid, p_amount numeric, p_payment_method text, p_notes text DEFAULT NULL::text, p_paid_at timestamp with time zone DEFAULT timezone('utc'::text, now()), p_tenant_id uuid DEFAULT NULL::uuid, p_cash_session_id uuid DEFAULT NULL::uuid, p_advance_amount numeric DEFAULT 0, p_credit_amount numeric DEFAULT 0)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_professional_tenant uuid;
  v_professional_active boolean;
  v_professional_deleted_at timestamptz;
  v_payment_method text;
  v_payout_amount numeric;
  v_advance_amount numeric := 0;
  v_credit_amount numeric := 0;
  v_cash_for_commission numeric := 0;
  v_open_obligation_amount numeric := 0;
  v_advances_open_amount numeric := 0;
  v_credits_open_amount numeric := 0;
  v_legacy_total_commission numeric := 0;
  v_legacy_paid_commission numeric := 0;
  v_legacy_open_amount numeric := 0;
  v_remaining numeric;
  v_allocation numeric;
  v_allocated_amount numeric := 0;
  v_legacy_allocated_amount numeric := 0;
  v_advance_remaining numeric;
  v_advance_allocation numeric;
  v_advance_allocated_amount numeric := 0;
  v_credit_remaining numeric;
  v_credit_allocation numeric;
  v_credit_allocated_amount numeric := 0;
  v_payout_id uuid;
  v_obligation record;
  v_advance record;
  v_credit record;
  v_cash_session public.cash_sessions%rowtype;
  v_cash_received numeric;
  v_supplies numeric;
  v_withdrawals numeric;
  v_cash_payouts_existing numeric;
  v_advances_existing numeric;
  v_cash_available numeric;
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
    raise exception 'Acesso negado para quitar comissoes.' using errcode = '42501';
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
    raise exception 'Unidade nao informada.' using errcode = '22023';
  end if;

  v_payment_method := lower(btrim(coalesce(p_payment_method, '')));
  if v_payment_method not in ('pix', 'cash', 'credit_card', 'debit_card', 'transfer', 'other') then
    raise exception 'Metodo de pagamento invalido.' using errcode = 'P0001';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount = 'NaN'::numeric then
    raise exception 'O valor do pagamento deve ser maior que zero.' using errcode = '22023';
  end if;
  v_payout_amount := round(p_amount, 2);
  if v_payout_amount <= 0 then
    raise exception 'O valor do pagamento deve ter pelo menos um centavo.' using errcode = '22023';
  end if;

  if p_credit_amount is not null and p_credit_amount < 0 then
    raise exception 'O valor do credito nao pode ser negativo.' using errcode = '22023';
  end if;
  v_credit_amount := round(coalesce(p_credit_amount, 0), 2);
  if v_credit_amount > v_payout_amount then
    raise exception 'O valor do credito de gorjeta nao pode exceder o valor total do repasse.' using errcode = 'P0001';
  end if;

  if p_advance_amount is not null and p_advance_amount < 0 then
    raise exception 'O valor do abate nao pode ser negativo.' using errcode = '22023';
  end if;
  v_advance_amount := round(coalesce(p_advance_amount, 0), 2);

  if v_payment_method = 'cash' then
    if p_cash_session_id is null then
      raise exception 'Informe a sessao de caixa para quitacao em dinheiro.' using errcode = '22023';
    end if;

    select * into v_cash_session
    from public.cash_sessions
    where id = p_cash_session_id
      and tenant_id = v_target_tenant
    for update;

    if not found or v_cash_session.status <> 'open' then
      raise exception 'A sessao de caixa informada nao esta aberta ou nao pertence a unidade.' using errcode = 'P0001';
    end if;

    select coalesce(sum(cp.amount) filter (where cp.payment_method = 'cash'), 0)
      into v_cash_received
    from public.comanda_pagamentos cp
    where cp.cash_session_id = p_cash_session_id and cp.tenant_id = v_target_tenant;

    select
      coalesce(sum(cm.amount) filter (where cm.type = 'suprimento'), 0),
      coalesce(sum(cm.amount) filter (where cm.type = 'sangria'), 0),
      coalesce(sum(cm.amount) filter (where cm.type = 'repasse_comissao' and cm.reversed_at is null), 0),
      coalesce(sum(cm.amount) filter (where cm.type = 'vale_profissional' and cm.reversed_at is null), 0)
      into v_supplies, v_withdrawals, v_cash_payouts_existing, v_advances_existing
    from public.cash_movements cm
    where cm.cash_session_id = p_cash_session_id and cm.tenant_id = v_target_tenant;

    v_cash_available := round(
      v_cash_session.initial_amount + v_cash_received + v_supplies - v_withdrawals
        - v_cash_payouts_existing - v_advances_existing,
      2
    );

    if v_payout_amount > v_cash_available then
      raise exception 'O valor do repasse em dinheiro excede o saldo disponivel na gaveta do turno.' using errcode = 'P0001';
    end if;
  else
    if p_cash_session_id is not null then
      raise exception 'Sessao de caixa so pode ser informada para quitacao em dinheiro.' using errcode = '22023';
    end if;
  end if;

  select tenant_id, is_active, deleted_at
    into v_professional_tenant, v_professional_active, v_professional_deleted_at
  from public.professionals
  where id = p_professional_id
  for update;

  if not found or v_professional_tenant <> v_target_tenant or not coalesce(v_professional_active, false) or v_professional_deleted_at is not null then
    raise exception 'Profissional nao encontrado ou inativo.' using errcode = 'P0001';
  end if;

  for v_obligation in
    select o.id, o.amount, o.settled_amount
    from public.commission_obligations o
    where o.tenant_id = v_target_tenant
      and o.professional_id = p_professional_id
      and o.status in ('open', 'partially_paid')
      and o.settled_amount < o.amount
    order by o.created_at, o.id
    for update
  loop
    v_open_obligation_amount := v_open_obligation_amount + (v_obligation.amount - v_obligation.settled_amount);
  end loop;

  select
    coalesce(sum(e.amount - e.settled_amount) filter (where e.entry_type = 'vale'), 0),
    coalesce(sum(e.amount - e.settled_amount) filter (where e.entry_type = 'gorjeta'), 0)
    into v_advances_open_amount, v_credits_open_amount
  from public.professional_account_entries e
  where e.tenant_id = v_target_tenant
    and e.professional_id = p_professional_id
    and e.status in ('open', 'partially_paid');

  with legacy_items as (
    select
      case
        when ci.snapshot_status in ('confirmed', 'estimated')
         and ci.snapshot_commission_amount is not null
          then ci.snapshot_commission_amount
        when ci.snapshot_status in ('unavailable', 'reverted') then 0
        when ci.item_type in ('servico', 'service') or ci.service_id is not null then
          round(ci.total_price * coalesce(ps.custom_commission_percentage, s.commission_percentage, prof.commission_percentage, 0) / 100, 2)
        when ci.item_type in ('produto', 'product') or ci.product_id is not null then
          round(ci.total_price * coalesce(prod.commission_percentage, 0) / 100, 2)
        else 0
      end as commission_amount
    from public.comanda_itens ci
    join public.comandas c on c.id = ci.comanda_id
    left join public.professionals prof on prof.id = ci.professional_id
    left join public.services s on s.id = ci.service_id
    left join public.professional_services ps
      on ps.service_id = ci.service_id
     and ps.professional_id = ci.professional_id
     and ps.tenant_id = ci.tenant_id
    left join public.products prod on prod.id = ci.product_id
    where c.tenant_id = v_target_tenant
      and c.status in ('fechada', 'closed')
      and ci.professional_id = p_professional_id
      and not exists (
        select 1 from public.commission_obligations o where o.comanda_item_id = ci.id
      )
  )
  select coalesce(sum(commission_amount), 0)
    into v_legacy_total_commission
  from legacy_items;

  select coalesce(sum(
    case
      when exists (select 1 from public.commission_payout_allocations a where a.payout_id = cp.id)
        then coalesce(cp.legacy_allocated_amount, 0)
      else cp.amount
    end
  ), 0)
    into v_legacy_paid_commission
  from public.commission_payouts cp
  where cp.tenant_id = v_target_tenant
    and cp.professional_id = p_professional_id
    and cp.reversed_at is null;

  v_legacy_open_amount := greatest(0, v_legacy_total_commission - v_legacy_paid_commission);

  v_cash_for_commission := v_payout_amount - v_credit_amount;

  if v_cash_for_commission + v_advance_amount > v_open_obligation_amount + v_legacy_open_amount then
    raise exception 'O valor informado excede o saldo pendente de comissao.' using errcode = 'P0001';
  end if;
  if v_advance_amount > v_advances_open_amount then
    raise exception 'O valor do abate excede o saldo de vales em aberto do profissional.' using errcode = 'P0001';
  end if;
  if v_credit_amount > v_credits_open_amount then
    raise exception 'O valor do credito excede o saldo de gorjeta em aberto do profissional.' using errcode = 'P0001';
  end if;

  insert into public.commission_payouts (
    tenant_id, professional_id, amount, payment_method, notes, paid_at, created_by, cash_session_id, advance_amount, credit_amount
  ) values (
    v_target_tenant, p_professional_id, v_payout_amount, v_payment_method,
    p_notes, coalesce(p_paid_at, timezone('utc'::text, now())), v_user_id, p_cash_session_id, v_advance_amount, v_credit_amount
  ) returning id into v_payout_id;

  if v_payment_method = 'cash' then
    insert into public.cash_movements (
      tenant_id, cash_session_id, type, amount, reason, performed_by, payout_id
    ) values (
      v_target_tenant, p_cash_session_id, 'repasse_comissao', v_payout_amount,
      coalesce(nullif(btrim(p_notes), ''), 'Repasse de comissao'), v_user_id, v_payout_id
    );
  end if;

  v_remaining := v_cash_for_commission + v_advance_amount;
  for v_obligation in
    select o.id, o.amount, o.settled_amount
    from public.commission_obligations o
    where o.tenant_id = v_target_tenant
      and o.professional_id = p_professional_id
      and o.status in ('open', 'partially_paid')
      and o.settled_amount < o.amount
    order by o.created_at, o.id
    for update
  loop
    exit when v_remaining <= 0;
    v_allocation := least(v_remaining, v_obligation.amount - v_obligation.settled_amount);
    if v_allocation <= 0 then
      continue;
    end if;

    insert into public.commission_payout_allocations (
      tenant_id, payout_id, obligation_id, amount
    ) values (
      v_target_tenant, v_payout_id, v_obligation.id, v_allocation
    );

    update public.commission_obligations
    set settled_amount = settled_amount + v_allocation,
        status = case
          when settled_amount + v_allocation >= amount then 'paid'
          else 'partially_paid'
        end
    where id = v_obligation.id;

    v_remaining := v_remaining - v_allocation;
    v_allocated_amount := v_allocated_amount + v_allocation;
  end loop;

  v_legacy_allocated_amount := greatest(0, v_cash_for_commission - least(v_allocated_amount, v_cash_for_commission));
  update public.commission_payouts
  set legacy_allocated_amount = v_legacy_allocated_amount
  where id = v_payout_id;

  v_advance_remaining := v_advance_amount;
  for v_advance in
    select e.id, e.amount, e.settled_amount
    from public.professional_account_entries e
    where e.tenant_id = v_target_tenant
      and e.professional_id = p_professional_id
      and e.entry_type = 'vale'
      and e.status in ('open', 'partially_paid')
      and e.settled_amount < e.amount
    order by e.created_at, e.id
    for update
  loop
    exit when v_advance_remaining <= 0;
    v_advance_allocation := least(v_advance_remaining, v_advance.amount - v_advance.settled_amount);
    if v_advance_allocation <= 0 then
      continue;
    end if;

    insert into public.professional_advance_allocations (
      tenant_id, payout_id, entry_id, amount
    ) values (
      v_target_tenant, v_payout_id, v_advance.id, v_advance_allocation
    );

    update public.professional_account_entries
    set settled_amount = settled_amount + v_advance_allocation,
        status = case
          when settled_amount + v_advance_allocation >= amount then 'settled'
          else 'partially_paid'
        end
    where id = v_advance.id;

    v_advance_remaining := v_advance_remaining - v_advance_allocation;
    v_advance_allocated_amount := v_advance_allocated_amount + v_advance_allocation;
  end loop;

  v_credit_remaining := v_credit_amount;
  for v_credit in
    select e.id, e.amount, e.settled_amount
    from public.professional_account_entries e
    where e.tenant_id = v_target_tenant
      and e.professional_id = p_professional_id
      and e.entry_type = 'gorjeta'
      and e.status in ('open', 'partially_paid')
      and e.settled_amount < e.amount
    order by e.created_at, e.id
    for update
  loop
    exit when v_credit_remaining <= 0;
    v_credit_allocation := least(v_credit_remaining, v_credit.amount - v_credit.settled_amount);
    if v_credit_allocation <= 0 then
      continue;
    end if;

    insert into public.professional_advance_allocations (
      tenant_id, payout_id, entry_id, amount
    ) values (
      v_target_tenant, v_payout_id, v_credit.id, v_credit_allocation
    );

    update public.professional_account_entries
    set settled_amount = settled_amount + v_credit_allocation,
        status = case
          when settled_amount + v_credit_allocation >= amount then 'settled'
          else 'partially_paid'
        end
    where id = v_credit.id;

    v_credit_remaining := v_credit_remaining - v_credit_allocation;
    v_credit_allocated_amount := v_credit_allocated_amount + v_credit_allocation;
  end loop;

  return jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'amount', v_payout_amount,
    'professional_id', p_professional_id,
    'allocated_amount', v_allocated_amount,
    'legacy_amount', v_legacy_allocated_amount,
    'cash_session_id', p_cash_session_id,
    'advance_amount', v_advance_amount,
    'advance_allocated_amount', v_advance_allocated_amount,
    'credit_amount', v_credit_amount,
    'credit_allocated_amount', v_credit_allocated_amount
  );
end;
$function$;

create or replace function public.register_professional_advance(p_professional_id uuid, p_amount numeric, p_reason text, p_payment_method text, p_tenant_id uuid DEFAULT NULL::uuid, p_cash_session_id uuid DEFAULT NULL::uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_professional_tenant uuid;
  v_professional_active boolean;
  v_professional_deleted_at timestamptz;
  v_payment_method text;
  v_amount numeric;
  v_reason text;
  v_cash_session public.cash_sessions%rowtype;
  v_cash_received numeric;
  v_supplies numeric;
  v_withdrawals numeric;
  v_cash_payouts_existing numeric;
  v_advances_existing numeric;
  v_cash_available numeric;
  v_entry_id uuid;
  v_movement_id uuid;
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
    raise exception 'Acesso negado para lancar vale.' using errcode = '42501';
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
    raise exception 'Unidade nao informada.' using errcode = '22023';
  end if;

  v_payment_method := lower(btrim(coalesce(p_payment_method, '')));
  if v_payment_method not in ('pix', 'cash', 'credit_card', 'debit_card', 'transfer', 'other') then
    raise exception 'Metodo de pagamento invalido.' using errcode = 'P0001';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount = 'NaN'::numeric then
    raise exception 'O valor do vale deve ser maior que zero.' using errcode = '22023';
  end if;
  v_amount := round(p_amount, 2);
  if v_amount <= 0 then
    raise exception 'O valor do vale deve ter pelo menos um centavo.' using errcode = '22023';
  end if;

  v_reason := btrim(coalesce(p_reason, ''));
  if length(v_reason) < 5 then
    raise exception 'Informe um motivo com pelo menos cinco caracteres.' using errcode = '22023';
  end if;

  if v_payment_method = 'cash' then
    if p_cash_session_id is null then
      raise exception 'Informe a sessao de caixa para vale em dinheiro.' using errcode = '22023';
    end if;

    select * into v_cash_session
    from public.cash_sessions
    where id = p_cash_session_id
      and tenant_id = v_target_tenant
    for update;

    if not found or v_cash_session.status <> 'open' then
      raise exception 'A sessao de caixa informada nao esta aberta ou nao pertence a unidade.' using errcode = 'P0001';
    end if;

    select coalesce(sum(cp.amount) filter (where cp.payment_method = 'cash'), 0)
      into v_cash_received
    from public.comanda_pagamentos cp
    where cp.cash_session_id = p_cash_session_id and cp.tenant_id = v_target_tenant;

    select
      coalesce(sum(cm.amount) filter (where cm.type = 'suprimento'), 0),
      coalesce(sum(cm.amount) filter (where cm.type = 'sangria'), 0),
      coalesce(sum(cm.amount) filter (where cm.type = 'repasse_comissao' and cm.reversed_at is null), 0),
      coalesce(sum(cm.amount) filter (where cm.type = 'vale_profissional' and cm.reversed_at is null), 0)
      into v_supplies, v_withdrawals, v_cash_payouts_existing, v_advances_existing
    from public.cash_movements cm
    where cm.cash_session_id = p_cash_session_id and cm.tenant_id = v_target_tenant;

    v_cash_available := round(
      v_cash_session.initial_amount + v_cash_received + v_supplies - v_withdrawals
        - v_cash_payouts_existing - v_advances_existing,
      2
    );

    if v_amount > v_cash_available then
      raise exception 'O valor do vale em dinheiro excede o saldo disponivel na gaveta do turno.' using errcode = 'P0001';
    end if;
  else
    if p_cash_session_id is not null then
      raise exception 'Sessao de caixa so pode ser informada para vale em dinheiro.' using errcode = '22023';
    end if;
  end if;

  select tenant_id, is_active, deleted_at
    into v_professional_tenant, v_professional_active, v_professional_deleted_at
  from public.professionals
  where id = p_professional_id
  for update;

  if not found or v_professional_tenant <> v_target_tenant or not coalesce(v_professional_active, false) or v_professional_deleted_at is not null then
    raise exception 'Profissional nao encontrado ou inativo.' using errcode = 'P0001';
  end if;

  insert into public.professional_account_entries (
    tenant_id, professional_id, entry_type, direction, amount, settled_amount,
    status, reason, created_by
  ) values (
    v_target_tenant, p_professional_id, 'vale', 'debit', v_amount, 0,
    'open', v_reason, v_user_id
  ) returning id into v_entry_id;

  if v_payment_method = 'cash' then
    insert into public.cash_movements (
      tenant_id, cash_session_id, type, amount, reason, performed_by, professional_id
    ) values (
      v_target_tenant, p_cash_session_id, 'vale_profissional', v_amount, v_reason, v_user_id, p_professional_id
    ) returning id into v_movement_id;

    update public.professional_account_entries
    set cash_movement_id = v_movement_id
    where id = v_entry_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'entry_id', v_entry_id,
    'professional_id', p_professional_id,
    'amount', v_amount,
    'cash_movement_id', v_movement_id,
    'cash_session_id', p_cash_session_id
  );
end;
$function$;

create or replace function public.reopen_cash_session(p_session_id uuid, p_tenant_id uuid, p_reason text)
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
  if v_user_role <> 'proprietario' and v_user_tenant is distinct from p_tenant_id then
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

create or replace function public.reopen_comanda(p_comanda_id uuid, p_tenant_id uuid)
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
  if v_user_role <> 'proprietario' and v_user_tenant is distinct from p_tenant_id then
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

create or replace function public.reverse_commission_payout(p_payout_id uuid, p_tenant_id uuid, p_reason text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_payout public.commission_payouts%rowtype;
  v_cash_session public.cash_sessions%rowtype;
  v_allocation record;
  v_advance_allocation record;
  v_new_settled numeric;
  v_result jsonb;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  select role, tenant_id into v_user_role, v_user_tenant
  from public.users where id = v_user_id and is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado para estornar quitacoes.' using errcode = '42501';
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
    raise exception 'Unidade nao informada.' using errcode = '22023';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Informe uma justificativa com pelo menos cinco caracteres.' using errcode = '22023';
  end if;

  select * into v_payout
  from public.commission_payouts
  where id = p_payout_id and tenant_id = v_target_tenant
  for update;

  if not found then
    raise exception 'Quitacao nao encontrada para esta unidade.' using errcode = 'P0001';
  end if;

  if v_payout.reversed_at is not null then
    raise exception 'Esta quitacao ja foi estornada.' using errcode = 'P0001';
  end if;

  perform 1 from public.professionals where id = v_payout.professional_id for update;

  if v_payout.payment_method = 'cash' then
    if v_payout.cash_session_id is null then
      raise exception 'Quitacao em dinheiro sem sessao de caixa associada.' using errcode = 'P0001';
    end if;

    select * into v_cash_session
    from public.cash_sessions
    where id = v_payout.cash_session_id
    for update;

    if not found or v_cash_session.status <> 'open' then
      raise exception 'A sessao de caixa do repasse esta encerrada; reabra o turno antes de estornar.' using errcode = 'P0001';
    end if;
  end if;

  for v_allocation in
    select a.id, a.obligation_id, a.amount
    from public.commission_payout_allocations a
    where a.payout_id = p_payout_id
    for update
  loop
    update public.commission_obligations o
    set settled_amount = greatest(0, o.settled_amount - v_allocation.amount),
        status = case
          when greatest(0, o.settled_amount - v_allocation.amount) <= 0 then 'open'
          when greatest(0, o.settled_amount - v_allocation.amount) < o.amount then 'partially_paid'
          else 'paid'
        end
    where o.id = v_allocation.obligation_id
      and o.status <> 'reversed';
  end loop;

  for v_advance_allocation in
    select a.id, a.entry_id, a.amount
    from public.professional_advance_allocations a
    where a.payout_id = p_payout_id
    for update
  loop
    update public.professional_account_entries e
    set settled_amount = greatest(0, e.settled_amount - v_advance_allocation.amount),
        status = case
          when greatest(0, e.settled_amount - v_advance_allocation.amount) <= 0 then 'open'
          when greatest(0, e.settled_amount - v_advance_allocation.amount) < e.amount then 'partially_paid'
          else 'settled'
        end
    where e.id = v_advance_allocation.entry_id
      and e.status <> 'reversed';
  end loop;

  update public.commission_payouts
  set reversed_at = timezone('utc'::text, now()),
      reversed_by = v_user_id,
      reversal_reason = btrim(p_reason)
  where id = p_payout_id;

  if v_payout.payment_method = 'cash' then
    update public.cash_movements
    set reversed_at = timezone('utc'::text, now()),
        reversed_by = v_user_id,
        reversal_reason = btrim(p_reason)
    where payout_id = p_payout_id
      and type = 'repasse_comissao'
      and reversed_at is null;
  end if;

  select to_jsonb(v_payout) || jsonb_build_object(
    'reversed', true,
    'reversed_at', timezone('utc'::text, now())
  ) into v_result;
  return v_result;
end;
$function$;

create or replace function public.reverse_professional_advance(p_entry_id uuid, p_tenant_id uuid, p_reason text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_entry public.professional_account_entries%rowtype;
  v_cash_session public.cash_sessions%rowtype;
  v_result jsonb;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  select role, tenant_id into v_user_role, v_user_tenant
  from public.users where id = v_user_id and is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado para estornar vale.' using errcode = '42501';
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
    raise exception 'Unidade nao informada.' using errcode = '22023';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Informe uma justificativa com pelo menos cinco caracteres.' using errcode = '22023';
  end if;

  select * into v_entry
  from public.professional_account_entries
  where id = p_entry_id and tenant_id = v_target_tenant
  for update;

  if not found or v_entry.entry_type <> 'vale' then
    raise exception 'Vale nao encontrado para esta unidade.' using errcode = 'P0001';
  end if;

  if v_entry.reversed_at is not null then
    raise exception 'Este vale ja foi estornado.' using errcode = 'P0001';
  end if;

  if v_entry.settled_amount > 0 then
    raise exception 'Vale ja abatido parcial ou totalmente; estorne o abate antes.' using errcode = 'P0001';
  end if;

  if v_entry.cash_movement_id is not null then
    select cs.* into v_cash_session
    from public.cash_sessions cs
    join public.cash_movements cm on cm.cash_session_id = cs.id
    where cm.id = v_entry.cash_movement_id
    for update of cs;

    if not found or v_cash_session.status <> 'open' then
      raise exception 'A sessao de caixa do vale esta encerrada; reabra o turno antes de estornar.' using errcode = 'P0001';
    end if;
  end if;

  update public.professional_account_entries
  set status = 'reversed',
      reversed_at = timezone('utc'::text, now()),
      reversed_by = v_user_id,
      reversal_reason = btrim(p_reason)
  where id = p_entry_id;

  if v_entry.cash_movement_id is not null then
    update public.cash_movements
    set reversed_at = timezone('utc'::text, now()),
        reversed_by = v_user_id,
        reversal_reason = btrim(p_reason)
    where id = v_entry.cash_movement_id
      and type = 'vale_profissional'
      and reversed_at is null;
  end if;

  select to_jsonb(v_entry) || jsonb_build_object(
    'reversed', true,
    'reversed_at', timezone('utc'::text, now())
  ) into v_result;
  return v_result;
end;
$function$;

create or replace function public.settle_comanda(p_comanda_id uuid DEFAULT NULL::uuid, p_tenant_id uuid DEFAULT NULL::uuid, p_appointment_id uuid DEFAULT NULL::uuid, p_customer_id uuid DEFAULT NULL::uuid, p_discount_amount numeric DEFAULT 0, p_tip_amount numeric DEFAULT 0, p_cash_session_id uuid DEFAULT NULL::uuid, p_itens jsonb DEFAULT '[]'::jsonb, p_pagamentos jsonb DEFAULT '[]'::jsonb, p_tip_professional_id uuid DEFAULT NULL::uuid)
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
$function$;
