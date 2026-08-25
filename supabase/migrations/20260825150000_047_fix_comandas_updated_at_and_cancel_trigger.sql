-- =============================================================================
-- Migration 047: Adicionar coluna updated_at na tabela comandas e corrigir trigger de cancelamento
-- Target DB: dev (selvxobcjbkligxighlp)
-- =============================================================================

-- 1. Adicionar coluna updated_at na tabela public.comandas se não existir
ALTER TABLE public.comandas 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- 2. Atualizar a função de trigger para incluir closed_at e updated_at
CREATE OR REPLACE FUNCTION public.fn_auto_cancel_comanda_on_appointment_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Se o status mudou para 'canceled'
  IF NEW.status = 'canceled' AND (OLD.status IS NULL OR OLD.status <> 'canceled') THEN
    UPDATE public.comandas
    SET 
      status = 'cancelada',
      closed_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
    WHERE appointment_id = NEW.id
      AND status = 'aberta';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_auto_cancel_comanda_on_appointment_cancel() IS 
'Cancela automaticamente a comanda vinculada em estado aberta quando o agendamento correspondente é cancelado, definindo status cancelada, closed_at e updated_at.';
