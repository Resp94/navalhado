-- =============================================================================
-- Migration 015: Ciclo de Comandas, Sessões de Caixa, Bloqueio de Horários,
--                Estoque Simples de Produtos e Encaixes Concorrentes
-- ADR: docs/adr/013_ciclo_de_comandas_sessao_caixa_e_grade_avancada.md
-- Spec: specs/012-ciclo-comandas-caixa-bloqueios-grade-avancada/spec.md
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela: cash_sessions (Sessões de Caixa Diário)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opened_by UUID REFERENCES auth.users(id),
  closed_by UUID REFERENCES auth.users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  closed_at TIMESTAMPTZ,
  initial_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (initial_amount >= 0),
  closing_amount NUMERIC(10,2) CHECK (closing_amount IS NULL OR closing_amount >= 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_tenant_id ON public.cash_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_opened_by ON public.cash_sessions(opened_by);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_closed_by ON public.cash_sessions(closed_by);
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_open_cash_session_per_tenant ON public.cash_sessions (tenant_id) WHERE (status = 'open');

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage cash_sessions in their tenant"
  ON public.cash_sessions
  FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

-- -----------------------------------------------------------------------------
-- 2. Tabela: products (Produtos / Estoque Simples)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  cost_price NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON public.products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_active ON public.products(tenant_id, is_active);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage products in their tenant"
  ON public.products
  FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

-- -----------------------------------------------------------------------------
-- 3. Tabela: comandas (Comandas de Atendimento e Balcão)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comandas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'fechada', 'cancelada')),
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  tip_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (tip_amount >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_comandas_tenant_id ON public.comandas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comandas_appointment_id ON public.comandas(appointment_id);
CREATE INDEX IF NOT EXISTS idx_comandas_customer_id ON public.comandas(customer_id);
CREATE INDEX IF NOT EXISTS idx_comandas_tenant_status ON public.comandas(tenant_id, status);

ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage comandas in their tenant"
  ON public.comandas
  FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

-- -----------------------------------------------------------------------------
-- 4. Tabela: comanda_itens (Itens de Comanda: Serviços e Produtos)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comanda_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comanda_id UUID NOT NULL REFERENCES public.comandas(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('servico', 'produto')),
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC(10,2) NOT NULL CHECK (total_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_comanda_itens_comanda_id ON public.comanda_itens(comanda_id);
CREATE INDEX IF NOT EXISTS idx_comanda_itens_tenant_id ON public.comanda_itens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comanda_itens_service_id ON public.comanda_itens(service_id);
CREATE INDEX IF NOT EXISTS idx_comanda_itens_product_id ON public.comanda_itens(product_id);
CREATE INDEX IF NOT EXISTS idx_comanda_itens_professional_id ON public.comanda_itens(professional_id);

ALTER TABLE public.comanda_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage comanda_itens in their tenant"
  ON public.comanda_itens
  FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

-- -----------------------------------------------------------------------------
-- 5. Tabela: comanda_pagamentos (Divisões de Pagamento da Comanda)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comanda_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comanda_id UUID NOT NULL REFERENCES public.comandas(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cash_session_id UUID REFERENCES public.cash_sessions(id) ON DELETE SET NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'credit_card', 'debit_card', 'cash', 'other')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  change_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (change_amount >= 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_comanda_pagamentos_comanda_id ON public.comanda_pagamentos(comanda_id);
CREATE INDEX IF NOT EXISTS idx_comanda_pagamentos_tenant_id ON public.comanda_pagamentos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comanda_pagamentos_cash_session_id ON public.comanda_pagamentos(cash_session_id);

ALTER TABLE public.comanda_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage comanda_pagamentos in their tenant"
  ON public.comanda_pagamentos
  FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

-- -----------------------------------------------------------------------------
-- 6. Tabela: blocked_slots (Bloqueios de Horário na Grade)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blocked_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL DEFAULT 'Almoço',
  is_all_day BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT blocked_slots_valid_timerange CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_blocked_slots_tenant_id ON public.blocked_slots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_blocked_slots_professional_id ON public.blocked_slots(professional_id);
CREATE INDEX IF NOT EXISTS idx_blocked_slots_time_range ON public.blocked_slots(tenant_id, professional_id, start_time);

ALTER TABLE public.blocked_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage blocked_slots in their tenant"
  ON public.blocked_slots
  FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

-- -----------------------------------------------------------------------------
-- 7. Tabela: waiting_list (Lista de Espera Diária)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.waiting_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'scheduled', 'expired', 'canceled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_waiting_list_tenant_id ON public.waiting_list(tenant_id);
CREATE INDEX IF NOT EXISTS idx_waiting_list_customer_id ON public.waiting_list(customer_id);
CREATE INDEX IF NOT EXISTS idx_waiting_list_service_id ON public.waiting_list(service_id);
CREATE INDEX IF NOT EXISTS idx_waiting_list_professional_id ON public.waiting_list(professional_id);
CREATE INDEX IF NOT EXISTS idx_waiting_list_tenant_status ON public.waiting_list(tenant_id, status);

ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage waiting_list in their tenant"
  ON public.waiting_list
  FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

-- -----------------------------------------------------------------------------
-- 8. Ajuste da Constraint GIST de Anti-Sobreposição (Encaixe / Overbooking)
-- -----------------------------------------------------------------------------
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_no_professional_overlap;

ALTER TABLE public.appointments ADD CONSTRAINT appointments_no_professional_overlap
  EXCLUDE USING gist (
    professional_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (status IN ('pending', 'confirmed', 'in_progress') AND is_fitting = false);

-- -----------------------------------------------------------------------------
-- 9. Atualização de get_available_slots para subtrair blocked_slots
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
  v_tenant_start_str text;
  v_tenant_end_str text;
  v_tenant_active boolean;
begin
  select coalesce(timezone, 'America/Sao_Paulo') into v_timezone 
  from public.tenants 
  where id = p_tenant_id;

  select duration_minutes into v_duration 
  from public.services 
  where id = p_service_id and tenant_id = p_tenant_id and is_active = true;

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
  else
    select 
      business_hours->v_day_of_week->>'start', 
      business_hours->v_day_of_week->>'end', 
      coalesce((business_hours->v_day_of_week->>'active')::boolean, false) 
    into v_tenant_start_str, v_tenant_end_str, v_tenant_active 
    from public.tenants 
    where id = p_tenant_id;

    if not v_tenant_active or v_tenant_start_str is null or v_tenant_end_str is null then 
      return; 
    end if;

    return query 
    with slots as (
      select 
        gs as slot_start, 
        gs + (v_duration || ' minutes')::interval as slot_end 
      from generate_series(
        ((p_date::text || ' ' || v_tenant_start_str || ':00')::timestamp) at time zone v_timezone, 
        ((p_date::text || ' ' || v_tenant_end_str || ':00')::timestamp) at time zone v_timezone - (v_duration || ' minutes')::interval, 
        '30 minutes'::interval
      ) gs
    ) 
    select distinct to_char(s.slot_start at time zone v_timezone, 'HH24:MI') 
    from slots s 
    join public.professionals prof 
      on prof.tenant_id = p_tenant_id 
      and prof.is_active = true 
    where s.slot_start > now() 
      and prof.weekly_schedule->v_day_of_week->>'start' is not null 
      and prof.weekly_schedule->v_day_of_week->>'end' is not null 
      and s.slot_start >= ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'start') || ':00')::timestamp) at time zone v_timezone 
      and s.slot_end <= ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'end') || ':00')::timestamp) at time zone v_timezone 
      and (prof.weekly_schedule->v_day_of_week->>'break_start' is null or prof.weekly_schedule->v_day_of_week->>'break_end' is null or not (
        s.slot_start < ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'break_end') || ':00')::timestamp) at time zone v_timezone 
        and s.slot_end > ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'break_start') || ':00')::timestamp) at time zone v_timezone
      )) 
      -- Exclui colisões com agendamentos do profissional
      and not exists (
        select 1 from public.appointments a 
        where a.professional_id = prof.id 
          and a.status != 'canceled' 
          and (p_exclude_appointment_id is null or a.id != p_exclude_appointment_id) 
          and a.start_time < s.slot_end 
          and a.end_time > s.slot_start
      )
      -- Exclui colisões com bloqueios de horário do profissional
      and not exists (
        select 1 from public.blocked_slots b
        where b.professional_id = prof.id
          and b.start_time < s.slot_end
          and b.end_time > s.slot_start
      )
    order by 1;
  end if;
end;
$function$;

-- -----------------------------------------------------------------------------
-- 10. Limpeza de Funções RPC Legadas
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_customer_info_by_token(uuid);

-- -----------------------------------------------------------------------------
-- 11. Habilitação de Realtime para sincronização instantânea
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'comandas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comandas;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cash_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'blocked_slots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_slots;
  END IF;
END $$;
