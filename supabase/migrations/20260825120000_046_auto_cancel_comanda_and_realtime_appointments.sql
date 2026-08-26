-- Migration 046: Cancelamento automático de comanda ao cancelar agendamento e inclusão de appointments/comanda_itens no supabase_realtime
-- Target DB: dev (selvxobcjbkligxighlp)

-- 1. Função de trigger para cancelar automaticamente a comanda aberta ao cancelar agendamento
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
      updated_at = now()
    WHERE appointment_id = NEW.id
      AND status = 'aberta';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_auto_cancel_comanda_on_appointment_cancel() IS 
'Cancela automaticamente a comanda vinculada em estado aberta quando o agendamento correspondente é cancelado.';

-- 2. Vincular trigger na tabela public.appointments
DROP TRIGGER IF EXISTS trg_auto_cancel_comanda_on_appointment_cancel ON public.appointments;

CREATE TRIGGER trg_auto_cancel_comanda_on_appointment_cancel
AFTER UPDATE OF status ON public.appointments
FOR EACH ROW
WHEN (NEW.status = 'canceled' AND OLD.status IS DISTINCT FROM 'canceled')
EXECUTE FUNCTION public.fn_auto_cancel_comanda_on_appointment_cancel();

-- 3. Habilitar tabelas appointments e comanda_itens na publicação supabase_realtime
DO $$
BEGIN
  -- Adicionar appointments caso ainda não esteja na publicação
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  END IF;

  -- Adicionar comanda_itens caso ainda não esteja na publicação
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'comanda_itens'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comanda_itens;
  END IF;
END $$;
