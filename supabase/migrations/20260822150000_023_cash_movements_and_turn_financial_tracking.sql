-- =============================================================================
-- Migration 023: Movimentações de Caixa (Sangrias e Suprimentos) e Auditoria de Turno
-- ADR: docs/adr/016_hub_financeiro_caixa_e_quitacao_de_comissoes.md
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela: cash_movements (Sangrias / Retiradas e Suprimentos / Entradas)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cash_session_id UUID NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sangria', 'suprimento')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_session_id ON public.cash_movements(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_tenant_id ON public.cash_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_type ON public.cash_movements(tenant_id, type);

-- -----------------------------------------------------------------------------
-- 2. RLS e Políticas Granulares de Segurança
-- -----------------------------------------------------------------------------
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_movements_select_policy" ON public.cash_movements;
DROP POLICY IF EXISTS "cash_movements_insert_policy" ON public.cash_movements;
DROP POLICY IF EXISTS "cash_movements_update_policy" ON public.cash_movements;
DROP POLICY IF EXISTS "cash_movements_delete_policy" ON public.cash_movements;

CREATE POLICY "cash_movements_select_policy"
  ON public.cash_movements FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

CREATE POLICY "cash_movements_insert_policy"
  ON public.cash_movements FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

CREATE POLICY "cash_movements_update_policy"
  ON public.cash_movements FOR UPDATE
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

CREATE POLICY "cash_movements_delete_policy"
  ON public.cash_movements FOR DELETE
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid())));

-- -----------------------------------------------------------------------------
-- 3. Publicação no Supabase Realtime
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cash_movements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_movements;
  END IF;
END $$;
