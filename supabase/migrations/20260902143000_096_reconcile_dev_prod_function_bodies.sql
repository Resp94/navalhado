-- Migration 096: Reconcilia corpos de funções já ativos e validados em DEV.
-- Não altera tabelas nem dados. Preserva as assinaturas, SECURITY DEFINER,
-- search_path e privilégios existentes ao usar CREATE OR REPLACE.

+CREATE OR REPLACE FUNCTION private.clamp_professional_schedule_to_tenant(p_schedule jsonb, p_business_hours jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_result JSONB := COALESCE(p_schedule, '{}'::jsonb);
  v_day_index INTEGER;
  v_day_en TEXT;
  v_day_pt TEXT;
  v_professional_key TEXT;
  v_professional_day JSONB;
  v_tenant_day JSONB;
  v_tenant_active BOOLEAN;
  v_professional_start TEXT;
  v_professional_end TEXT;
  v_break_start TEXT;
  v_break_end TEXT;
  v_open TEXT;
  v_close TEXT;
  v_start_field TEXT;
  v_end_field TEXT;
  v_day JSONB;
  v_clamped_start TIME;
  v_clamped_end TIME;
  v_clamped_break_start TIME;
  v_clamped_break_end TIME;
BEGIN
  FOR v_day_index IN 0..6 LOOP
    v_day_en := (ARRAY['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])[v_day_index + 1];
    v_day_pt := (ARRAY['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'])[v_day_index + 1];

    IF p_schedule ? v_day_en THEN
      v_professional_key := v_day_en;
    ELSIF p_schedule ? v_day_pt THEN
      v_professional_key := v_day_pt;
    ELSE
      CONTINUE;
    END IF;

    v_professional_day := p_schedule -> v_professional_key;
    IF jsonb_typeof(v_professional_day) <> 'object' THEN
      CONTINUE;
    END IF;

    v_tenant_day := COALESCE(p_business_hours -> v_day_pt, p_business_hours -> v_day_en);
    v_tenant_active := CASE
      WHEN v_tenant_day IS NULL THEN true
      ELSE lower(COALESCE(v_tenant_day ->> 'active', 'true')) <> 'false'
    END;

    IF NOT v_tenant_active THEN
      CONTINUE;
    END IF;

    v_open := COALESCE(v_tenant_day ->> 'open', v_tenant_day ->> 'start', '08:00');
    v_close := COALESCE(v_tenant_day ->> 'close', v_tenant_day ->> 'end', '20:00');
    v_professional_start := COALESCE(v_professional_day ->> 'start', v_professional_day ->> 'open');
    v_professional_end := COALESCE(v_professional_day ->> 'end', v_professional_day ->> 'close');

    IF v_professional_start IS NULL OR v_professional_end IS NULL THEN
      CONTINUE;
    END IF;

    v_clamped_start := GREATEST(v_professional_start::TIME, v_open::TIME);
    v_clamped_end := LEAST(v_professional_end::TIME, v_close::TIME);
    v_day := v_professional_day;

    IF v_clamped_start >= v_clamped_end THEN
      v_clamped_start := v_open::TIME;
      v_clamped_end := v_close::TIME;
      v_day := jsonb_set(v_day, '{active}', 'false'::jsonb, true);
    END IF;

    v_start_field := CASE WHEN v_professional_day ? 'start' THEN 'start' ELSE 'open' END;
    v_end_field := CASE WHEN v_professional_day ? 'end' THEN 'end' ELSE 'close' END;
    v_day := jsonb_set(v_day, ARRAY[v_start_field], to_jsonb(to_char(v_clamped_start, 'HH24:MI')), true);
    v_day := jsonb_set(v_day, ARRAY[v_end_field], to_jsonb(to_char(v_clamped_end, 'HH24:MI')), true);

    v_break_start := v_professional_day ->> 'break_start';
    v_break_end := v_professional_day ->> 'break_end';
    IF v_break_start IS NULL OR v_break_end IS NULL THEN
      v_day := v_day - 'break_start' - 'break_end';
    ELSE
      v_clamped_break_start := GREATEST(v_break_start::TIME, v_clamped_start);
      v_clamped_break_end := LEAST(v_break_end::TIME, v_clamped_end);
      IF v_clamped_break_start >= v_clamped_break_end THEN
        v_day := v_day - 'break_start' - 'break_end';
      ELSE
        v_day := jsonb_set(v_day, '{break_start}', to_jsonb(to_char(v_clamped_break_start, 'HH24:MI')), true);
        v_day := jsonb_set(v_day, '{break_end}', to_jsonb(to_char(v_clamped_break_end, 'HH24:MI')), true);
      END IF;
    END IF;

    v_result := jsonb_set(v_result, ARRAY[v_professional_key], v_day, true);
  END LOOP;

  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION private.fn_customer_welcome_balcao_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.registration_origin = 'balcao' AND NEW.phone IS NOT NULL AND btrim(NEW.phone) <> '' AND NEW.welcome_sent_at IS NULL THEN
    INSERT INTO public.whatsapp_message_outbox (tenant_id, customer_id, event_type, idempotency_key, payload)
    VALUES (NEW.tenant_id, NEW.id, 'customer_welcome_balcao', 'customer:' || NEW.id::text || ':customer_welcome_balcao',
      jsonb_build_object('event','customer_welcome_balcao','event_type','customer_welcome_balcao','customer_id',NEW.id,'tenant_id',NEW.tenant_id))
    ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION private.get_auth_role()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select role from public.users where id = (select auth.uid()); $function$
;

CREATE OR REPLACE FUNCTION private.get_auth_tenant_id()
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select tenant_id from public.users where id = (select auth.uid()); $function$
;

CREATE OR REPLACE FUNCTION private.is_own_appointment(p_appointment_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select exists (select 1 from public.appointments a join public.professionals p on p.id = a.professional_id where a.id = p_appointment_id and p.user_id = (select auth.uid()) and a.tenant_id = (select private.get_auth_tenant_id())); $function$
;

CREATE OR REPLACE FUNCTION private.is_own_professional(p_professional_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select exists (select 1 from public.professionals p where p.id = p_professional_id and p.user_id = (select auth.uid()) and p.tenant_id = (select private.get_auth_tenant_id())); $function$
;

CREATE OR REPLACE FUNCTION private.is_saas_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select exists (select 1 from public.users where id = (select auth.uid()) and role = 'proprietario'); $function$
;

CREATE OR REPLACE FUNCTION private.prevent_customer_registration_regression()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if old.cadastro_completo and not new.cadastro_completo then
    raise exception 'CUSTOMER_REGISTRATION_CANNOT_REGRESS';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.adjust_product_stock(p_product_id uuid, p_movement_type text, p_quantity integer, p_unit_cost numeric, p_reason text DEFAULT NULL::text, p_comanda_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_current_stock integer;
  v_new_stock integer;
  v_delta integer;
  v_user_role text;
  v_user_tenant uuid;
BEGIN
  SELECT role, tenant_id INTO v_user_role, v_user_tenant
  FROM public.users
  WHERE id = (SELECT auth.uid());

  IF v_user_role IS NULL OR v_user_role NOT IN ('gerente', 'proprietario') THEN
    RAISE EXCEPTION 'Acesso negado: apenas gerentes e proprietários podem movimentar estoque.';
  END IF;

  SELECT tenant_id, stock_quantity INTO v_tenant_id, v_current_stock
  FROM public.products
  WHERE id = p_product_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado.';
  END IF;

  IF v_user_role <> 'proprietario' AND v_user_tenant <> v_tenant_id THEN
    RAISE EXCEPTION 'Acesso negado para este tenant.';
  END IF;

  IF p_movement_type = 'entry' THEN
    IF p_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantidade de entrada deve ser maior que zero.';
    END IF;
    v_delta := p_quantity;
    v_new_stock := v_current_stock + p_quantity;
  ELSIF p_movement_type = 'exit' THEN
    IF p_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantidade de saída deve ser maior que zero.';
    END IF;
    IF v_current_stock < p_quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para a saída solicitada.';
    END IF;
    v_delta := -p_quantity;
    v_new_stock := v_current_stock - p_quantity;
  ELSIF p_movement_type = 'adjustment' THEN
    IF p_quantity < 0 THEN
      RAISE EXCEPTION 'Ajuste de estoque não pode ser negativo.';
    END IF;
    v_delta := p_quantity - v_current_stock;
    v_new_stock := p_quantity;
  ELSIF p_movement_type = 'sale' THEN
    IF p_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantidade vendida deve ser maior que zero.';
    END IF;
    IF v_current_stock < p_quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para a venda.';
    END IF;
    v_delta := -p_quantity;
    v_new_stock := v_current_stock - p_quantity;
  ELSE
    RAISE EXCEPTION 'Tipo de movimentação inválido: %', p_movement_type;
  END IF;

  UPDATE public.products
  SET stock_quantity = v_new_stock,
      cost_price = COALESCE(p_unit_cost, cost_price),
      updated_at = timezone('utc'::text, now())
  WHERE id = p_product_id;

  INSERT INTO public.product_movements (
    tenant_id,
    product_id,
    comanda_id,
    movement_type,
    quantity,
    unit_cost,
    reason,
    created_by
  ) VALUES (
    v_tenant_id,
    p_product_id,
    p_comanda_id,
    p_movement_type,
    v_delta,
    COALESCE(p_unit_cost, 0),
    p_reason,
    (SELECT auth.uid())
  );

  RETURN json_build_object(
    'product_id', p_product_id,
    'previous_stock', v_current_stock,
    'new_stock', v_new_stock,
    'delta', v_delta
  )::jsonb;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.confirm_public_booking(p_slug text, p_service_id uuid, p_professional_id uuid, p_date date, p_slot text, p_name text, p_phone text, p_token uuid)
 RETURNS TABLE(appointment_id uuid, customer_id uuid, token_acesso uuid, customer_name text, customer_phone text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id UUID;
  v_customer public.customers%ROWTYPE;
  v_phone TEXT;
  v_name TEXT := btrim(p_name);
  v_appointment_id UUID;
BEGIN
  IF v_name IS NULL OR array_length(regexp_split_to_array(v_name,'\s+'),1)<2 THEN
    RAISE EXCEPTION 'Informe nome e sobrenome completos.' USING ERRCODE='22023';
  END IF;
  v_phone := private.normalize_br_phone(p_phone);
  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Informe um WhatsApp válido com DDD.' USING ERRCODE='22023';
  END IF;
  SELECT t.id INTO v_tenant_id FROM public.tenants t
  WHERE lower(t.slug)=lower(btrim(p_slug)) AND t.onboarding_completed IS TRUE;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Estabelecimento não encontrado.' USING ERRCODE='P0002';
  END IF;
  IF p_token IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.token_acesso=p_token AND c.tenant_id=v_tenant_id
      AND (c.token_expirado_em IS NULL OR c.token_expirado_em>=now())
  ) THEN
    RAISE EXCEPTION 'Token inválido para este estabelecimento.' USING ERRCODE='P0002';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::TEXT||':'||v_phone,0));
  SELECT c.* INTO v_customer FROM public.customers c
  WHERE c.tenant_id=v_tenant_id AND c.telefone_normalizado=v_phone;
  IF FOUND THEN
    IF v_customer.cadastro_completo IS FALSE THEN
      UPDATE public.customers
      SET name=left(v_name,100),phone=v_phone,cadastro_completo=true,
          registration_origin='canal_cliente',updated_at=timezone('utc'::TEXT,now())
      WHERE id=v_customer.id RETURNING * INTO v_customer;
    END IF;
  ELSE
    INSERT INTO public.customers(tenant_id,name,phone,cadastro_completo,registration_origin)
    VALUES(v_tenant_id,left(v_name,100),v_phone,true,'canal_cliente')
    RETURNING * INTO v_customer;
  END IF;
  v_appointment_id := public.create_appointment_by_token(v_customer.token_acesso,p_service_id,p_professional_id,p_date,p_slot);
  RETURN QUERY SELECT v_appointment_id,v_customer.id,v_customer.token_acesso,v_customer.name,v_customer.phone;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_metrics()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_mrr numeric;
  v_active_tenants integer;
  v_suspended_tenants integer;
  v_revenue_this_month numeric;
  v_revenue_trend json;
begin
  if not exists (select 1 from public.users where id = (select auth.uid()) and role = 'proprietario') then
    raise exception 'Acesso negado. Apenas proprietários do SaaS podem visualizar estas métricas.';
  end if;
  select coalesce(sum(case when sub.billing_cycle = 'yearly' then p.price / 12.0 else p.price end), 0)
  into v_mrr from public.tenant_subscriptions sub join public.plans p on p.id = sub.plan_id where sub.status = 'active';
  select count(distinct tenant_id) into v_active_tenants from public.tenant_subscriptions where status = 'active';
  select count(distinct tenant_id) into v_suspended_tenants from public.tenant_subscriptions where status = 'suspended';
  select coalesce(sum(amount), 0) into v_revenue_this_month from public.invoices where status = 'paid' and paid_at >= date_trunc('month', now()) and paid_at < date_trunc('month', now() + interval '1 month');
  with months as (
    select date_trunc('month', m)::date as month_date from generate_series(date_trunc('month', now() - interval '11 months'), date_trunc('month', now()), interval '1 month') m
  ), monthly_revenue as (
    select date_trunc('month', paid_at)::date as month_date, sum(amount) as total_amount from public.invoices where status = 'paid' and paid_at >= date_trunc('month', now() - interval '11 months') group by 1
  )
  select json_agg(json_build_object('month', to_char(m.month_date, 'YYYY-MM'), 'month_label', to_char(m.month_date, 'TMMonth YY'), 'revenue', coalesce(r.total_amount, 0)) order by m.month_date)
  into v_revenue_trend from months m left join monthly_revenue r on r.month_date = m.month_date;
  return json_build_object('mrr', v_mrr, 'active_tenants', v_active_tenants, 'suspended_tenants', v_suspended_tenants, 'revenue_this_month', v_revenue_this_month, 'revenue_trend', coalesce(v_revenue_trend, '[]'::json));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_professionals_by_customer_token(p_token uuid)
 RETURNS TABLE(id uuid, name text, phone text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_tenant_id uuid;
begin
  select c.tenant_id into v_tenant_id from public.customers c where c.token_acesso = p_token and (c.token_expirado_em is null or c.token_expirado_em > now());
  if v_tenant_id is null then raise exception 'Acesso negado. Token inválido ou expirado.'; end if;
  return query select p.id, p.name, p.phone from public.professionals p where p.tenant_id = v_tenant_id and p.is_active = true order by p.name;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_professionals_by_public_slug(p_slug text, p_service_id uuid)
 RETURNS TABLE(id uuid, name text, phone text, is_active boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT p.id,p.name,p.phone,p.is_active
  FROM public.professionals p
  JOIN public.tenants t ON t.id=p.tenant_id
  JOIN public.services s ON s.tenant_id=p.tenant_id AND s.id=p_service_id
  JOIN public.professional_services ps ON ps.tenant_id=p.tenant_id AND ps.professional_id=p.id AND ps.service_id=s.id
  WHERE lower(t.slug)=lower(btrim(p_slug))
    AND t.onboarding_completed IS TRUE
    AND s.is_active IS TRUE AND s.deleted_at IS NULL
    AND p.is_active IS TRUE AND p.deleted_at IS NULL
    AND ps.is_enabled IS TRUE
  ORDER BY p.name ASC;
$function$
;

CREATE OR REPLACE FUNCTION public.get_public_tenant_by_slug(p_slug text)
 RETURNS TABLE(tenant_id uuid, tenant_name text, tenant_phone text, tenant_slug text, logo_url text, timezone text, business_hours jsonb, slot_interval_minutes integer, min_booking_lead_time_minutes integer, min_cancellation_lead_time_minutes integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_cleaned_slug TEXT := lower(btrim(p_slug));
BEGIN
  RETURN QUERY
  SELECT t.id,t.name,t.phone,t.slug,t.logo_url,COALESCE(t.timezone,'America/Sao_Paulo'),t.business_hours,
    COALESCE(t.slot_interval_minutes,30)::INTEGER,
    COALESCE(t.min_booking_lead_time_minutes,15)::INTEGER,
    COALESCE(t.min_cancellation_lead_time_minutes,120)::INTEGER
  FROM public.tenants t
  WHERE lower(t.slug)=v_cleaned_slug
    AND t.onboarding_completed IS TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_services_by_customer_token(p_token uuid)
 RETURNS TABLE(id uuid, name text, description text, price numeric, duration_minutes integer, category text, display_order integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Validar token e capturar tenant_id
  SELECT c.tenant_id INTO v_tenant_id
  FROM public.customers c
  WHERE c.token_acesso = p_token 
    AND (c.token_expirado_em IS NULL OR c.token_expirado_em > now());

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado. Token inválido ou expirado.';
  END IF;

  RETURN QUERY
  SELECT 
    s.id, 
    s.name, 
    s.description, 
    s.price, 
    s.duration_minutes, 
    s.category,
    s.display_order
  FROM public.services s
  WHERE s.tenant_id = v_tenant_id
    AND s.is_active = true
  ORDER BY s.display_order ASC, s.created_at ASC, s.name ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_services_by_public_slug(p_slug text)
 RETURNS TABLE(id uuid, name text, description text, price numeric, duration_minutes integer, category text, is_active boolean, display_order integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT s.id,s.name,s.description,s.price,s.duration_minutes,s.category,s.is_active,s.display_order
  FROM public.services s JOIN public.tenants t ON t.id=s.tenant_id
  WHERE lower(t.slug)=lower(btrim(p_slug))
    AND t.onboarding_completed IS TRUE
    AND s.is_active IS TRUE AND s.deleted_at IS NULL
  ORDER BY s.display_order ASC,s.created_at ASC,s.name ASC;
$function$
;

CREATE OR REPLACE FUNCTION public.get_tenant_financial_metrics(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
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
  v_revenue_by_method json;
  v_commissions_by_professional json;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING errcode = '42501';
  END IF;

  SELECT tenant_id, role INTO v_user_tenant_id, v_user_role
  FROM public.users
  WHERE id = v_user_id;

  IF v_user_role IS NULL OR v_user_role NOT IN ('gerente', 'proprietario') THEN
    RAISE EXCEPTION 'Acesso negado. Apenas gerentes e proprietários podem acessar métricas financeiras.' USING errcode = '42501';
  END IF;

  -- Resolver tenant_id de forma segura
  IF p_tenant_id IS NOT NULL THEN
    IF v_user_role <> 'proprietario' AND v_user_tenant_id <> p_tenant_id THEN
      RAISE EXCEPTION 'Acesso negado para a unidade solicitada.' USING errcode = '42501';
    END IF;
    v_target_tenant_id := p_tenant_id;
  ELSE
    v_target_tenant_id := v_user_tenant_id;
  END IF;

  IF v_target_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Unidade (tenant_id) não informada.' USING errcode = '22023';
  END IF;

  -- 1. Faturamento Total
  SELECT COALESCE(SUM(c.total_amount), 0.00)
  INTO v_total_revenue
  FROM public.comandas c
  WHERE c.tenant_id = v_target_tenant_id
    AND c.status IN ('fechada', 'closed')
    AND c.closed_at >= p_start_date
    AND c.closed_at <= p_end_date;

  -- 2. Desdobramento de Itens (Serviços vs Produtos, Custos e Comissões)
  WITH target_comandas AS (
    SELECT c.id
    FROM public.comandas c
    WHERE c.tenant_id = v_target_tenant_id
    AND c.status IN ('fechada', 'closed')
    AND c.closed_at >= p_start_date
    AND c.closed_at <= p_end_date
  ),
  item_breakdown AS (
    SELECT 
      ci.id AS item_id,
      ci.professional_id,
      ci.quantity,
      ci.total_price,
      ci.item_type,
      ci.service_id,
      ci.product_id,
      COALESCE(prod.cost_price, 0.00) AS unit_cost,
      ROUND((ci.total_price * COALESCE(
        CASE 
          WHEN ci.item_type IN ('servico', 'service') OR ci.service_id IS NOT NULL THEN
            COALESCE(ps.custom_commission_percentage, s.commission_percentage, prof.commission_percentage, 0.0)
          WHEN ci.item_type IN ('produto', 'product') OR ci.product_id IS NOT NULL THEN
            COALESCE(prod.commission_percentage, 0.0)
          ELSE 0.0
        END, 0.0) / 100.0), 2) AS commission_amount
    FROM public.comanda_itens ci
    JOIN target_comandas tc ON tc.id = ci.comanda_id
    LEFT JOIN public.professionals prof ON prof.id = ci.professional_id
    LEFT JOIN public.services s ON s.id = ci.service_id
    LEFT JOIN public.professional_services ps ON ps.service_id = ci.service_id AND ps.professional_id = ci.professional_id AND ps.tenant_id = ci.tenant_id
    LEFT JOIN public.products prod ON prod.id = ci.product_id
  )
  SELECT 
    COALESCE(SUM(total_price) FILTER (WHERE item_type IN ('servico', 'service') OR service_id IS NOT NULL), 0.00),
    COALESCE(SUM(total_price) FILTER (WHERE item_type IN ('produto', 'product') OR product_id IS NOT NULL), 0.00),
    COALESCE(SUM(quantity) FILTER (WHERE item_type IN ('produto', 'product') OR product_id IS NOT NULL), 0),
    COALESCE(SUM(unit_cost * quantity) FILTER (WHERE item_type IN ('produto', 'product') OR product_id IS NOT NULL), 0.00),
    COALESCE(SUM(commission_amount), 0.00)
  INTO 
    v_services_revenue,
    v_products_revenue,
    v_products_count,
    v_products_cost,
    v_total_commission
  FROM item_breakdown;

  -- 3. Comissões Quitadas no Período
  SELECT COALESCE(SUM(amount), 0.00)
  INTO v_paid_commission
  FROM public.commission_payouts
  WHERE tenant_id = v_target_tenant_id
    AND paid_at >= p_start_date
    AND paid_at <= p_end_date;

  v_pending_commission := GREATEST(0.00, v_total_commission - v_paid_commission);
  v_net_revenue := v_total_revenue - v_total_commission - v_products_cost;

  -- 4. Faturamento por Método de Pagamento
  WITH target_comandas AS (
    SELECT c.id
    FROM public.comandas c
    WHERE c.tenant_id = v_target_tenant_id
      AND c.status IN ('fechada', 'closed')
      AND c.closed_at >= p_start_date
      AND c.closed_at <= p_end_date
  )
  SELECT COALESCE(json_object_agg(method, amount_sum), '{}'::json)
  INTO v_revenue_by_method
  FROM (
    SELECT 
      cp.payment_method AS method, 
      COALESCE(SUM(cp.amount), 0.00) AS amount_sum
    FROM public.comanda_pagamentos cp
    JOIN target_comandas tc ON tc.id = cp.comanda_id
    GROUP BY cp.payment_method
  ) s;

  -- 5. Comissões e Quantidade de Atendimentos por Profissional Ativo
  WITH target_comandas AS (
    SELECT c.id
    FROM public.comandas c
    WHERE c.tenant_id = v_target_tenant_id
      AND c.status IN ('fechada', 'closed')
      AND c.closed_at >= p_start_date
      AND c.closed_at <= p_end_date
  ),
  item_breakdown AS (
    SELECT 
      ci.id AS item_id,
      ci.comanda_id,
      ci.professional_id,
      ci.total_price,
      ROUND((ci.total_price * COALESCE(
        CASE 
          WHEN ci.item_type IN ('servico', 'service') OR ci.service_id IS NOT NULL THEN
            COALESCE(ps.custom_commission_percentage, s.commission_percentage, prof.commission_percentage, 0.0)
          WHEN ci.item_type IN ('produto', 'product') OR ci.product_id IS NOT NULL THEN
            COALESCE(prod.commission_percentage, 0.0)
          ELSE 0.0
        END, 0.0) / 100.0), 2) AS commission_amount
    FROM public.comanda_itens ci
    JOIN target_comandas tc ON tc.id = ci.comanda_id
    LEFT JOIN public.professionals prof ON prof.id = ci.professional_id
    LEFT JOIN public.services s ON s.id = ci.service_id
    LEFT JOIN public.professional_services ps ON ps.service_id = ci.service_id AND ps.professional_id = ci.professional_id AND ps.tenant_id = ci.tenant_id
    LEFT JOIN public.products prod ON prod.id = ci.product_id
  ),
  prof_payouts AS (
    SELECT 
      professional_id,
      COALESCE(SUM(amount), 0.00) AS paid_amount
    FROM public.commission_payouts
    WHERE tenant_id = v_target_tenant_id
      AND paid_at >= p_start_date
      AND paid_at <= p_end_date
    GROUP BY professional_id
  ),
  prof_stats AS (
    SELECT 
      prof.id AS professional_id,
      prof.name AS professional_name,
      COALESCE(SUM(ib.total_price), 0.00) AS gross_sum,
      COALESCE(SUM(ib.commission_amount), 0.00) AS commission_sum,
      COALESCE(pp.paid_amount, 0.00) AS paid_sum,
      GREATEST(0.00, COALESCE(SUM(ib.commission_amount), 0.00) - COALESCE(pp.paid_amount, 0.00)) AS pending_sum,
      COUNT(DISTINCT ib.comanda_id) AS appointments_count
    FROM public.professionals prof
    LEFT JOIN item_breakdown ib ON ib.professional_id = prof.id
    LEFT JOIN prof_payouts pp ON pp.professional_id = prof.id
    WHERE prof.tenant_id = v_target_tenant_id
      AND prof.is_active = true
    GROUP BY prof.id, prof.name, pp.paid_amount
    ORDER BY commission_sum DESC, prof.name ASC
  )
  SELECT COALESCE(json_agg(json_build_object(
    'professional_id', professional_id,
    'professional_name', professional_name,
    'gross_sum', gross_sum,
    'commission_sum', commission_sum,
    'paid_sum', paid_sum,
    'pending_sum', pending_sum,
    'appointments_count', appointments_count
  )), '[]'::json)
  INTO v_commissions_by_professional
  FROM prof_stats;

  RETURN json_build_object(
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
    'commissions_by_professional', v_commissions_by_professional
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.register_commission_payout(p_professional_id uuid, p_amount numeric, p_payment_method text, p_notes text DEFAULT NULL::text, p_paid_at timestamp with time zone DEFAULT timezone('utc'::text, now()), p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_payout_id uuid;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING errcode = '42501';
  END IF;

  SELECT role, tenant_id INTO v_user_role, v_user_tenant
  FROM public.users
  WHERE id = v_user_id;

  IF v_user_role IS NULL OR v_user_role NOT IN ('gerente', 'proprietario') THEN
    RAISE EXCEPTION 'Acesso negado. Apenas gerentes e proprietários podem registrar pagamentos de comissão.' USING errcode = '42501';
  END IF;

  IF p_tenant_id IS NOT NULL THEN
    IF v_user_role <> 'proprietario' AND v_user_tenant <> p_tenant_id THEN
      RAISE EXCEPTION 'Acesso negado para esta unidade.' USING errcode = '42501';
    END IF;
    v_target_tenant := p_tenant_id;
  ELSE
    v_target_tenant := v_user_tenant;
  END IF;

  IF v_target_tenant IS NULL THEN
    RAISE EXCEPTION 'Unidade não informada.' USING errcode = '22023';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'O valor do pagamento deve ser maior que zero.' USING errcode = '22023';
  END IF;

  -- Inserir quitação
  INSERT INTO public.commission_payouts (
    tenant_id,
    professional_id,
    amount,
    payment_method,
    notes,
    paid_at,
    created_by
  ) VALUES (
    v_target_tenant,
    p_professional_id,
    p_amount,
    p_payment_method,
    p_notes,
    COALESCE(p_paid_at, timezone('utc'::text, now())),
    v_user_id
  )
  RETURNING id INTO v_payout_id;

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'amount', p_amount,
    'professional_id', p_professional_id
  );
END;
$function$
;
