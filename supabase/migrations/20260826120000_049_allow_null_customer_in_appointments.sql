-- =============================================================================
-- Migration 049: Permitir customer_id NULL em appointments (Atendimento/Encaixe sem Cliente)
-- =============================================================================

-- 1. Tornar a coluna customer_id em public.appointments anulável
ALTER TABLE public.appointments ALTER COLUMN customer_id DROP NOT NULL;

-- 2. Atualizar handle_appointment_notification() para tratar customer_id nulo de forma robusta
CREATE OR REPLACE FUNCTION public.handle_appointment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_customer_name text;
  v_service_name text;
  v_professional_name text;
  v_formatted_time text;
  v_title text;
  v_message text;
  v_type text;
  v_timezone text;
BEGIN
  -- Buscar nomes relacionados usando qualificadores de schema explícitos
  IF new.customer_id IS NOT NULL THEN
    SELECT name INTO v_customer_name FROM public.customers WHERE id = new.customer_id;
  END IF;
  v_customer_name := COALESCE(v_customer_name, 'Cliente Balcão');

  SELECT name INTO v_service_name FROM public.services WHERE id = new.service_id;
  SELECT name INTO v_professional_name FROM public.professionals WHERE id = new.professional_id;
  
  -- Buscar o fuso horário do tenant
  SELECT COALESCE(timezone, 'America/Sao_Paulo') INTO v_timezone FROM public.tenants WHERE id = new.tenant_id;

  -- Formatar data/hora no padrão do fuso do tenant
  v_formatted_time := to_char(new.start_time AT TIME ZONE v_timezone, 'DD/MM/YYYY "às" HH24:MI');

  -- Caso 1: Novo Agendamento (INSERT)
  IF tg_op = 'INSERT' THEN
    v_type := 'appointment_created';
    v_title := 'Novo Agendamento';
    v_message := v_customer_name || ' agendou ' || COALESCE(v_service_name, 'Serviço') || ' com ' || COALESCE(v_professional_name, 'Profissional') || ' para ' || v_formatted_time || '.';
    
    -- Notificação para o Gerente
    INSERT INTO public.notifications (tenant_id, professional_id, type, title, message)
    VALUES (new.tenant_id, null, v_type, v_title, v_message);
    
    -- Notificação para o Barbeiro
    INSERT INTO public.notifications (tenant_id, professional_id, type, title, message)
    VALUES (new.tenant_id, new.professional_id, v_type, v_title, v_message);

  -- Caso 2: Atualização (UPDATE)
  ELSIF tg_op = 'UPDATE' THEN
    -- Subcaso A: Cancelamento
    IF new.status = 'canceled' AND old.status <> 'canceled' THEN
      v_type := 'appointment_canceled';
      v_title := 'Agendamento Cancelado';
      v_message := 'O agendamento de ' || v_customer_name || ' (' || COALESCE(v_service_name, 'Serviço') || ') em ' || v_formatted_time || ' foi cancelado.';
      
      -- Notificação para o Gerente
      INSERT INTO public.notifications (tenant_id, professional_id, type, title, message)
      VALUES (new.tenant_id, null, v_type, v_title, v_message);
      
      -- Notificação para o Barbeiro
      INSERT INTO public.notifications (tenant_id, professional_id, type, title, message)
      VALUES (new.tenant_id, new.professional_id, v_type, v_title, v_message);
    END IF;
  END IF;

  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_appointment_notification() FROM PUBLIC, anon, authenticated;

-- 3. Atualizar a trigger de criação automática de comanda para garantir idempotência e suporte a NULL
CREATE OR REPLACE FUNCTION public.fn_auto_create_comanda_for_appointment()
RETURNS TRIGGER AS $$
DECLARE
  v_comanda_id UUID;
  v_service_price NUMERIC(10,2) := 0;
BEGIN
  -- Se já existir uma comanda vinculada a este appointment, não duplica
  IF EXISTS (SELECT 1 FROM public.comandas WHERE appointment_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Obter preço do serviço cadastrado
  SELECT price INTO v_service_price FROM public.services WHERE id = NEW.service_id;
  IF v_service_price IS NULL THEN
    v_service_price := 0;
  END IF;

  -- Criar a comanda com status 'aberta' (customer_id pode ser NULL)
  INSERT INTO public.comandas (
    tenant_id,
    appointment_id,
    customer_id,
    status,
    total_amount,
    discount_amount,
    tip_amount,
    created_at
  ) VALUES (
    NEW.tenant_id,
    NEW.id,
    NEW.customer_id,
    CASE WHEN NEW.payment_status = 'paid' OR NEW.status = 'completed' THEN 'fechada' ELSE 'aberta' END,
    v_service_price,
    0,
    0,
    COALESCE(NEW.created_at, timezone('utc'::text, now()))
  ) RETURNING id INTO v_comanda_id;

  -- Inserir o serviço como primeiro item da comanda
  IF NEW.service_id IS NOT NULL THEN
    INSERT INTO public.comanda_itens (
      comanda_id,
      tenant_id,
      item_type,
      service_id,
      professional_id,
      quantity,
      unit_price,
      total_price,
      created_at
    ) VALUES (
      v_comanda_id,
      NEW.tenant_id,
      'servico',
      NEW.service_id,
      NEW.professional_id,
      1,
      v_service_price,
      v_service_price,
      COALESCE(NEW.created_at, timezone('utc'::text, now()))
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
