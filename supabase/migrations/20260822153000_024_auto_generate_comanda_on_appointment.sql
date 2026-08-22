-- =============================================================================
-- Migration 024: Geração Automática de Comanda para Agendamentos e Encaixes
-- =============================================================================

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

  -- Criar a comanda com status 'aberta'
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

DROP TRIGGER IF EXISTS trg_auto_create_comanda_for_appointment ON public.appointments;

CREATE TRIGGER trg_auto_create_comanda_for_appointment
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_create_comanda_for_appointment();

-- Backfill para agendamentos existentes que não possuem comanda
DO $$
DECLARE
  app RECORD;
  v_comanda_id UUID;
  v_price NUMERIC(10,2);
BEGIN
  FOR app IN 
    SELECT a.*, s.price as srv_price 
    FROM public.appointments a
    LEFT JOIN public.services s ON s.id = a.service_id
    WHERE a.id NOT IN (SELECT appointment_id FROM public.comandas WHERE appointment_id IS NOT NULL)
  LOOP
    v_price := COALESCE(app.srv_price, 0);
    
    INSERT INTO public.comandas (
      tenant_id, appointment_id, customer_id, status, total_amount, discount_amount, tip_amount, created_at
    ) VALUES (
      app.tenant_id, app.id, app.customer_id, 
      CASE WHEN app.payment_status = 'paid' OR app.status = 'completed' THEN 'fechada' ELSE 'aberta' END,
      v_price, 0, 0, app.created_at
    ) RETURNING id INTO v_comanda_id;

    IF app.service_id IS NOT NULL THEN
      INSERT INTO public.comanda_itens (
        comanda_id, tenant_id, item_type, service_id, professional_id, quantity, unit_price, total_price, created_at
      ) VALUES (
        v_comanda_id, app.tenant_id, 'servico', app.service_id, app.professional_id, 1, v_price, v_price, app.created_at
      );
    END IF;
  END LOOP;
END $$;
