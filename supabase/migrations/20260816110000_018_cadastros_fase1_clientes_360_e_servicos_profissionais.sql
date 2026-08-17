-- =============================================================================
-- Migration: 20260816110000_018_cadastros_fase1_clientes_360_e_servicos_profissionais.sql
-- Description: Módulo de Cadastros (Fase 1) - Clientes 360, Associação N:N de Serviços,
--              Produtos e Movimentações de Estoque, Drop da tabela legada payments
--              e RLS Granular.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Expansão de Clientes (public.customers)
-- -----------------------------------------------------------------------------
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS birth_date DATE NULL;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[];
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS acquisition_channel TEXT NULL;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS cpf TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_tenant_birth_date ON public.customers (tenant_id, birth_date);
CREATE INDEX IF NOT EXISTS idx_customers_tags ON public.customers USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_cpf ON public.customers (tenant_id, cpf) WHERE cpf IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. Expansão de Serviços (public.services)
-- -----------------------------------------------------------------------------
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS return_period_days INTEGER NOT NULL DEFAULT 20 CHECK (return_period_days > 0);
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS custom_reminder_template TEXT NULL;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS price_type TEXT NOT NULL DEFAULT 'fixed' CHECK (price_type IN ('fixed', 'starting_at'));
ALTER TABLE public.services ALTER COLUMN duration_minutes SET DEFAULT 40;

-- -----------------------------------------------------------------------------
-- 3. Expansão de Produtos (public.products)
-- -----------------------------------------------------------------------------
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'retail' CHECK (product_type IN ('retail', 'internal_use'));
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER NOT NULL DEFAULT 5 CHECK (min_stock_alert >= 0);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand TEXT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category TEXT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unit_type TEXT NOT NULL DEFAULT 'un' CHECK (unit_type IN ('un', 'cx', 'kg', 'lt', 'ml'));
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5,2) NULL CHECK (commission_percentage IS NULL OR (commission_percentage >= 0 AND commission_percentage <= 100));

CREATE INDEX IF NOT EXISTS idx_products_tenant_type ON public.products (tenant_id, product_type);
CREATE INDEX IF NOT EXISTS idx_products_tenant_low_stock ON public.products (tenant_id, stock_quantity, min_stock_alert);

-- -----------------------------------------------------------------------------
-- 4. Tabela de Auditoria e Movimentações de Estoque (public.product_movements)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('entry_manual', 'entry_purchase', 'exit_manual', 'exit_sale_comanda', 'exit_internal_use', 'adjustment')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(10,2) NULL CHECK (unit_cost IS NULL OR unit_cost >= 0),
  reason TEXT NULL,
  comanda_id UUID REFERENCES public.comandas(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_product_movements_tenant_product ON public.product_movements(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_product_movements_product_id ON public.product_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_product_movements_created_by ON public.product_movements(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_movements_tenant_type ON public.product_movements(tenant_id, movement_type);
CREATE INDEX IF NOT EXISTS idx_product_movements_created_at ON public.product_movements(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_movements_comanda_id ON public.product_movements(comanda_id) WHERE comanda_id IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 5. Tabela Associativa Profissional-Serviço (public.professional_services)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.professional_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  custom_duration_minutes INTEGER CHECK (custom_duration_minutes IS NULL OR custom_duration_minutes > 0),
  custom_commission_percentage NUMERIC(5,2) CHECK (custom_commission_percentage IS NULL OR (custom_commission_percentage >= 0 AND custom_commission_percentage <= 100)),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_professional_service_per_tenant UNIQUE (tenant_id, professional_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_prof_services_tenant_id ON public.professional_services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prof_services_professional_id ON public.professional_services(professional_id);
CREATE INDEX IF NOT EXISTS idx_prof_services_service_id ON public.professional_services(service_id);
CREATE INDEX IF NOT EXISTS idx_prof_services_lookup ON public.professional_services(tenant_id, professional_id, service_id);

-- -----------------------------------------------------------------------------
-- 6. Row Level Security (RLS) Granular
-- -----------------------------------------------------------------------------
ALTER TABLE public.professional_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_movements ENABLE ROW LEVEL SECURITY;

-- Políticas para professional_services
DROP POLICY IF EXISTS prof_services_select_policy ON public.professional_services;
CREATE POLICY prof_services_select_policy ON public.professional_services
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

DROP POLICY IF EXISTS prof_services_insert_policy ON public.professional_services;
CREATE POLICY prof_services_insert_policy ON public.professional_services
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

DROP POLICY IF EXISTS prof_services_update_policy ON public.professional_services;
CREATE POLICY prof_services_update_policy ON public.professional_services
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

DROP POLICY IF EXISTS prof_services_delete_policy ON public.professional_services;
CREATE POLICY prof_services_delete_policy ON public.professional_services
  FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

-- Políticas para product_movements
DROP POLICY IF EXISTS product_movements_select_policy ON public.product_movements;
CREATE POLICY product_movements_select_policy ON public.product_movements
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

DROP POLICY IF EXISTS product_movements_insert_policy ON public.product_movements;
CREATE POLICY product_movements_insert_policy ON public.product_movements
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

DROP POLICY IF EXISTS product_movements_update_policy ON public.product_movements;
CREATE POLICY product_movements_update_policy ON public.product_movements
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

DROP POLICY IF EXISTS product_movements_delete_policy ON public.product_movements;
CREATE POLICY product_movements_delete_policy ON public.product_movements
  FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

-- -----------------------------------------------------------------------------
-- 7. Backfill Idempotente de Associação Profissional-Serviço
-- -----------------------------------------------------------------------------
INSERT INTO public.professional_services (
  tenant_id,
  professional_id,
  service_id,
  custom_duration_minutes,
  custom_commission_percentage,
  is_enabled
)
SELECT 
  p.tenant_id,
  p.id AS professional_id,
  s.id AS service_id,
  COALESCE(s.duration_minutes, 40) AS custom_duration_minutes,
  p.commission_percentage AS custom_commission_percentage,
  true AS is_enabled
FROM public.professionals p
CROSS JOIN public.services s
WHERE p.tenant_id = s.tenant_id
  AND p.is_active = true
  AND s.is_active = true
ON CONFLICT (tenant_id, professional_id, service_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8. RPC Atômica de Ajuste de Estoque (adjust_product_stock)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_product_stock(
  p_product_id UUID,
  p_movement_type TEXT,
  p_quantity INTEGER,
  p_unit_cost NUMERIC DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_comanda_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
  v_current_stock INTEGER;
  v_new_stock INTEGER;
  v_delta INTEGER;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING errcode = '42501';
  END IF;

  SELECT tenant_id INTO v_tenant_id FROM public.users WHERE id = v_user_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant não encontrado para o usuário' USING errcode = '42501';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'A quantidade deve ser maior que zero' USING errcode = '22023';
  END IF;

  SELECT stock_quantity INTO v_current_stock
  FROM public.products
  WHERE id = p_product_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado' USING errcode = 'P0002';
  END IF;

  IF p_movement_type IN ('entry_manual', 'entry_purchase') THEN
    v_delta := p_quantity;
    v_new_stock := v_current_stock + v_delta;
  ELSIF p_movement_type IN ('exit_manual', 'exit_sale_comanda', 'exit_internal_use') THEN
    v_delta := -p_quantity;
    v_new_stock := v_current_stock + v_delta;
    IF v_new_stock < 0 THEN
      RAISE EXCEPTION 'Estoque insuficiente para esta operação (Saldo atual: %)', v_current_stock USING errcode = '22003';
    END IF;
  ELSIF p_movement_type = 'adjustment' THEN
    v_delta := p_quantity - v_current_stock;
    v_new_stock := p_quantity;
  ELSE
    RAISE EXCEPTION 'Tipo de movimentação inválido: %', p_movement_type USING errcode = '22023';
  END IF;

  UPDATE public.products
  SET stock_quantity = v_new_stock
  WHERE id = p_product_id AND tenant_id = v_tenant_id;

  INSERT INTO public.product_movements (
    tenant_id,
    product_id,
    movement_type,
    quantity,
    unit_cost,
    reason,
    comanda_id,
    created_by
  ) VALUES (
    v_tenant_id,
    p_product_id,
    p_movement_type,
    p_quantity,
    p_unit_cost,
    p_reason,
    p_comanda_id,
    v_user_id
  );

  RETURN jsonb_build_object(
    'product_id', p_product_id,
    'previous_stock', v_current_stock,
    'new_stock', v_new_stock,
    'movement_type', p_movement_type,
    'quantity', p_quantity
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.adjust_product_stock(UUID, TEXT, INTEGER, NUMERIC, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(UUID, TEXT, INTEGER, NUMERIC, TEXT, UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 9. Atualização de get_available_slots para respeitar professional_services
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_tenant_id uuid,
  p_professional_id uuid,
  p_service_id uuid,
  p_date date,
  p_exclude_appointment_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(slot_time text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_duration integer;
  v_day_of_week text;
  v_start_time_str text;
  v_end_time_str text;
  v_break_start_str text;
  v_break_end_str text;
  v_timezone text;
begin
  select coalesce(timezone, 'America/Sao_Paulo') into v_timezone 
  from public.tenants 
  where id = p_tenant_id;

  if p_professional_id is not null then
    -- Se o serviço estiver explicitamente desabilitado para o profissional, não há slots
    if exists (
      select 1 from public.professional_services ps
      where ps.professional_id = p_professional_id
        and ps.service_id = p_service_id
        and ps.tenant_id = p_tenant_id
        and ps.is_enabled = false
    ) then
      return;
    end if;

    select coalesce(ps.custom_duration_minutes, s.duration_minutes, 40)
    into v_duration
    from public.services s
    left join public.professional_services ps 
      on ps.service_id = s.id 
      and ps.professional_id = p_professional_id 
      and ps.tenant_id = p_tenant_id
      and ps.is_enabled = true
    where s.id = p_service_id 
      and s.tenant_id = p_tenant_id 
      and s.is_active = true;
  else
    select coalesce(duration_minutes, 40)
    into v_duration
    from public.services 
    where id = p_service_id 
      and tenant_id = p_tenant_id 
      and is_active = true;
  end if;

  if v_duration is null then 
    return; 
  end if;

  select case extract(dow from p_date) 
    when 0 then 'sunday' 
    when 1 then 'monday' 
    when 2 then 'tuesday' 
    when 3 then 'wednesday' 
    when 4 then 'thursday' 
    when 5 then 'friday' 
    when 6 then 'saturday' 
  end into v_day_of_week;

  if p_professional_id is not null then
    select weekly_schedule->v_day_of_week->>'start', 
           weekly_schedule->v_day_of_week->>'end', 
           weekly_schedule->v_day_of_week->>'break_start', 
           weekly_schedule->v_day_of_week->>'break_end' 
    into v_start_time_str, v_end_time_str, v_break_start_str, v_break_end_str 
    from public.professionals 
    where id = p_professional_id and tenant_id = p_tenant_id and is_active = true;

    if v_start_time_str is null or v_end_time_str is null then 
      return; 
    end if;

    return query 
    with slots as (
      select 
        gs as slot_start, 
        gs + (v_duration || ' minutes')::interval as slot_end 
      from generate_series(
        ((p_date::text || ' ' || v_start_time_str || ':00')::timestamp) at time zone v_timezone, 
        ((p_date::text || ' ' || v_end_time_str || ':00')::timestamp) at time zone v_timezone - (v_duration || ' minutes')::interval, 
        '30 minutes'::interval
      ) gs
    ) 
    select to_char(s.slot_start at time zone v_timezone, 'HH24:MI') 
    from slots s 
    where s.slot_start > now() 
      and (v_break_start_str is null or v_break_end_str is null or not (
        s.slot_start < ((p_date::text || ' ' || v_break_end_str || ':00')::timestamp) at time zone v_timezone 
        and s.slot_end > ((p_date::text || ' ' || v_break_start_str || ':00')::timestamp) at time zone v_timezone
      )) 
      -- Exclui colisões com agendamentos ativos
      and not exists (
        select 1 from public.appointments a 
        where a.professional_id = p_professional_id 
          and a.status != 'canceled' 
          and (p_exclude_appointment_id is null or a.id != p_exclude_appointment_id) 
          and a.start_time < s.slot_end 
          and a.end_time > s.slot_start
      )
      -- Exclui colisões com bloqueios de horário
      and not exists (
        select 1 from public.blocked_slots b
        where b.professional_id = p_professional_id
          and b.start_time < s.slot_end
          and b.end_time > s.slot_start
      );
  end if;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_available_slots(uuid, uuid, uuid, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid, uuid, uuid, date, uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 10. Atualização de complete_customer_registration (Validação de Sobrenome)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_customer_registration(
  p_token uuid,
  p_name text
)
RETURNS TABLE(
  customer_id uuid,
  customer_name text,
  tenant_id uuid,
  tenant_name text,
  tenant_phone text,
  cadastro_completo boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text := btrim(p_name);
  v_row record;
BEGIN
  -- Validação de Nome e Sobrenome (mínimo de 2 palavras com mais de 1 caractere)
  IF v_name IS NULL 
     OR char_length(v_name) NOT BETWEEN 2 AND 100 
     OR array_length(regexp_split_to_array(v_name, '\s+'), 1) < 2 
  THEN
    RAISE EXCEPTION 'CUSTOMER_NAME_INVALID' USING errcode = '22023';
  END IF;

  UPDATE public.customers c
  SET name = v_name,
      cadastro_completo = true,
      updated_at = timezone('utc'::text, now())
  FROM public.tenants t
  WHERE c.tenant_id = t.id
    AND c.token_acesso = p_token
    AND (c.token_expirado_em IS NULL OR c.token_expirado_em >= now())
    AND c.cadastro_completo = false
  RETURNING c.id as customer_id,
    c.name as customer_name,
    c.tenant_id as tenant_id,
    t.name as tenant_name,
    t.phone as tenant_phone,
    c.cadastro_completo as cadastro_completo
  INTO v_row;

  IF FOUND THEN
    RETURN QUERY SELECT v_row.customer_id, v_row.customer_name, v_row.tenant_id,
      v_row.tenant_name, v_row.tenant_phone, v_row.cadastro_completo;
    RETURN;
  END IF;

  SELECT c.id, c.name, c.tenant_id, t.name as tenant_name,
         t.phone as tenant_phone, c.cadastro_completo, c.token_expirado_em
  INTO v_row
  FROM public.customers c
  JOIN public.tenants t ON t.id = c.tenant_id
  WHERE c.token_acesso = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOKEN_INVALID' USING errcode = 'P0002';
  END IF;

  IF v_row.token_expirado_em IS NOT NULL AND v_row.token_expirado_em < now() THEN
    RAISE EXCEPTION 'TOKEN_EXPIRED' USING errcode = '22023';
  END IF;

  -- Se o cadastro já foi completado anteriormente, retorna idempotente com o nome atualizado
  UPDATE public.customers
  SET name = v_name,
      updated_at = timezone('utc'::text, now())
  WHERE id = v_row.id;

  RETURN QUERY SELECT v_row.id, v_name, v_row.tenant_id,
    v_row.tenant_name, v_row.tenant_phone, true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_customer_registration(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_customer_registration(uuid, text) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 11. Refatoração de get_tenant_financial_metrics (Comandas Fechadas)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_tenant_financial_metrics(
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id uuid;
  v_role text;
  v_total_revenue numeric := 0.00;
  v_total_commission numeric := 0.00;
  v_net_revenue numeric := 0.00;
  v_revenue_by_method json;
  v_commissions_by_professional json;
BEGIN
  SELECT tenant_id, role INTO v_tenant_id, v_role
  FROM public.users
  WHERE id = (SELECT auth.uid());

  IF v_tenant_id IS NULL OR v_role != 'gerente' THEN
    RAISE EXCEPTION 'Acesso negado. Apenas gerentes autenticados podem acessar métricas financeiras.' USING errcode = '42501';
  END IF;

  -- 1. Total faturado e comissões consolidadas das comandas fechadas no período
  SELECT 
    COALESCE(SUM(c.total_final), 0),
    COALESCE(SUM(ci.commission_amount), 0)
  INTO v_total_revenue, v_total_commission
  FROM public.comandas c
  LEFT JOIN public.comanda_itens ci ON ci.comanda_id = c.id
  WHERE c.tenant_id = v_tenant_id
    AND c.status = 'closed'
    AND c.closed_at >= p_start_date
    AND c.closed_at <= p_end_date;

  v_net_revenue := v_total_revenue - v_total_commission;

  -- 2. Faturamento por método de pagamento (a partir de comanda_pagamentos)
  SELECT COALESCE(json_object_agg(method, amount_sum), '{}'::json)
  INTO v_revenue_by_method
  FROM (
    SELECT cp.payment_method AS method, COALESCE(SUM(cp.amount), 0) AS amount_sum
    FROM public.comanda_pagamentos cp
    JOIN public.comandas c ON c.id = cp.comanda_id
    WHERE c.tenant_id = v_tenant_id
      AND c.status = 'closed'
      AND c.closed_at >= p_start_date
      AND c.closed_at <= p_end_date
    GROUP BY cp.payment_method
  ) s;

  -- 3. Comissões e quantidade de atendimentos por profissional ativo
  SELECT COALESCE(json_agg(json_build_object(
    'professional_name', name,
    'commission_sum', commission_sum,
    'appointments_count', appointments_count
  )), '[]'::json)
  INTO v_commissions_by_professional
  FROM (
    SELECT 
      prof.name,
      COALESCE(SUM(ci.commission_amount), 0) AS commission_sum,
      COUNT(DISTINCT ci.appointment_id) FILTER (WHERE ci.appointment_id IS NOT NULL) AS appointments_count
    FROM public.professionals prof
    LEFT JOIN public.comanda_itens ci ON ci.professional_id = prof.id
    LEFT JOIN public.comandas c ON c.id = ci.comanda_id 
      AND c.status = 'closed' 
      AND c.closed_at >= p_start_date 
      AND c.closed_at <= p_end_date
    WHERE prof.tenant_id = v_tenant_id
      AND prof.is_active = true
    GROUP BY prof.id, prof.name
    ORDER BY prof.name ASC
  ) s;

  RETURN json_build_object(
    'total_revenue', v_total_revenue,
    'total_commission', v_total_commission,
    'net_revenue', v_net_revenue,
    'revenue_by_method', v_revenue_by_method,
    'commissions_by_professional', v_commissions_by_professional
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_tenant_financial_metrics(timestamp with time zone, timestamp with time zone) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_financial_metrics(timestamp with time zone, timestamp with time zone) TO authenticated;

-- -----------------------------------------------------------------------------
-- 12. Remoção Segura da Tabela Legada payments
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.payments CASCADE;
