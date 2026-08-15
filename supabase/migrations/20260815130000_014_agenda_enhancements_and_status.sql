-- Migração: Suporte aprimorado para Agenda Operacional (Encaixes, Notas, Origem e Status)
-- Criada em: 2026-08-15
-- Arquivo: supabase/migrations/20260815130000_014_agenda_enhancements_and_status.sql

-- 1. Adicionar colunas de suporte na tabela appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS is_fitting boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual';

-- 2. Restrição de Origem
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_origin_check,
  ADD CONSTRAINT appointments_origin_check CHECK (origin IN ('manual', 'whatsapp', 'client_channel'));

-- 3. Atualizar restrição de Status para incluir in_progress e no_show
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check,
  ADD CONSTRAINT appointments_status_check CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'canceled', 'no_show'));

-- 4. Atualizar constraint GIST anti-sobreposição para cobrir in_progress (mantém bloqueado durante atendimento)
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_no_professional_overlap;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_professional_overlap
  EXCLUDE USING gist (
    professional_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (status IN ('pending', 'confirmed', 'in_progress'));

-- 5. Índice parcial composto para a busca diária da agenda
CREATE INDEX IF NOT EXISTS idx_appointments_agenda_daily 
  ON public.appointments (tenant_id, start_time) 
  WHERE (status != 'canceled');
