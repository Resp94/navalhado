-- Outbox durável para boas-vindas de balcão.
-- O INSERT do cliente e o enfileiramento acontecem na mesma transação;
-- nenhum trigger dispara HTTP fire-and-forget.

CREATE TABLE IF NOT EXISTS public.whatsapp_message_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_until TIMESTAMPTZ,
  last_error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_message_outbox_status_check
    CHECK (status IN ('queued', 'processing', 'succeeded', 'failed')),
  CONSTRAINT whatsapp_message_outbox_attempt_count_check
    CHECK (attempt_count >= 0),
  CONSTRAINT whatsapp_message_outbox_key_unique
    UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS whatsapp_message_outbox_ready_idx
  ON public.whatsapp_message_outbox (status, available_at, lease_until);

ALTER TABLE public.whatsapp_message_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_outbox FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_message_outbox FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_customer_welcome_balcao_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.registration_origin = 'balcao'
     AND NEW.phone IS NOT NULL
     AND btrim(NEW.phone) <> ''
     AND NEW.welcome_sent_at IS NULL THEN
    INSERT INTO public.whatsapp_message_outbox (
      tenant_id,
      customer_id,
      event_type,
      idempotency_key,
      payload
    ) VALUES (
      NEW.tenant_id,
      NEW.id,
      'customer_welcome_balcao',
      'customer:' || NEW.id::text || ':customer_welcome_balcao',
      jsonb_build_object(
        'event', 'customer_welcome_balcao',
        'event_type', 'customer_welcome_balcao',
        'customer_id', NEW.id,
        'tenant_id', NEW.tenant_id
      )
    )
    ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_customer_welcome_balcao_trigger() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_customer_welcome_balcao ON public.customers;

CREATE TRIGGER trg_customer_welcome_balcao
  AFTER INSERT
  ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_customer_welcome_balcao_trigger();

CREATE OR REPLACE FUNCTION public.claim_whatsapp_message_outbox(p_limit INTEGER DEFAULT 25)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  customer_id UUID,
  event_type TEXT,
  idempotency_key TEXT,
  payload JSONB,
  attempt_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT o.id
    FROM public.whatsapp_message_outbox AS o
    WHERE (
      o.status = 'queued'
      AND o.available_at <= now()
    ) OR (
      o.status = 'processing'
      AND o.lease_until IS NOT NULL
      AND o.lease_until < now()
    )
    ORDER BY o.available_at, o.created_at
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 25), 100))
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.whatsapp_message_outbox AS o
    SET status = 'processing',
        attempt_count = o.attempt_count + 1,
        lease_until = now() + interval '2 minutes',
        updated_at = now()
    FROM candidates AS c
    WHERE o.id = c.id
    RETURNING o.id, o.tenant_id, o.customer_id, o.event_type,
              o.idempotency_key, o.payload, o.attempt_count
  )
  SELECT * FROM claimed;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_whatsapp_message_outbox(
  p_outbox_id UUID,
  p_success BOOLEAN,
  p_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_customer_id UUID;
  v_event_type TEXT;
  v_updated BOOLEAN;
BEGIN
  UPDATE public.whatsapp_message_outbox
  SET status = CASE
        WHEN p_success THEN 'succeeded'
        WHEN attempt_count >= 5 THEN 'failed'
        ELSE 'queued'
      END,
      available_at = CASE
        WHEN p_success THEN available_at
        ELSE now() + LEAST((2 ^ LEAST(attempt_count, 6)) * interval '1 minute', interval '60 minutes')
      END,
      lease_until = NULL,
      last_error = CASE WHEN p_success THEN NULL ELSE left(coalesce(p_error, 'provider request failed'), 500) END,
      processed_at = CASE WHEN p_success THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = p_outbox_id AND status = 'processing'
  RETURNING customer_id, event_type INTO v_customer_id, v_event_type;

  v_updated := FOUND;

  IF v_updated AND p_success AND v_event_type = 'customer_welcome_balcao' THEN
    UPDATE public.customers
    SET welcome_sent_at = now()
    WHERE id = v_customer_id
      AND registration_origin = 'balcao'
      AND welcome_sent_at IS NULL;
  END IF;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_whatsapp_message_outbox(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_whatsapp_message_outbox(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_message_outbox(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_whatsapp_message_outbox(UUID, BOOLEAN, TEXT) TO service_role;
