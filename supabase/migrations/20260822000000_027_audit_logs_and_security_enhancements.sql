-- =============================================================================
-- Migration: 027_audit_logs_and_security_enhancements
-- Descrição: Criação da tabela imutável de trilha de auditoria (audit_logs)
--            com RLS granular e função auxiliar de registro de eventos.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Índices para performance e consultas de conformidade LGPD
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created 
  ON public.audit_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id 
  ON public.audit_logs (user_id);

-- Ativação de Row Level Security
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
DROP POLICY IF EXISTS audit_logs_select_policy ON public.audit_logs;
CREATE POLICY audit_logs_select_policy ON public.audit_logs
FOR SELECT TO authenticated
USING (
  (SELECT private.is_saas_admin())
  OR (
    tenant_id = (SELECT private.get_auth_tenant_id())
    AND (SELECT private.get_auth_role()) = 'gerente'
  )
);

DROP POLICY IF EXISTS audit_logs_insert_policy ON public.audit_logs;
CREATE POLICY audit_logs_insert_policy ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT private.is_saas_admin())
  OR tenant_id = (SELECT private.get_auth_tenant_id())
);

-- Logs são estritamente imutáveis: revogar UPDATE e DELETE
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM public, anon, authenticated;

-- Função auxiliar segura para registro de eventos auditáveis
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action text,
  p_resource text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS \$\$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_log_id uuid;
BEGIN
  v_tenant_id := private.get_auth_tenant_id();
  v_user_id := auth.uid();

  INSERT INTO public.audit_logs (tenant_id, user_id, action, resource, details)
  VALUES (v_tenant_id, v_user_id, p_action, p_resource, p_details)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
\$\$;

REVOKE ALL ON FUNCTION public.log_audit_event(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, jsonb) TO authenticated, service_role;