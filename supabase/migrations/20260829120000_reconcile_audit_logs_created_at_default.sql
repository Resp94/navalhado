-- Migration: reconcile_audit_logs_created_at_default
-- Description: Alinha o default de created_at de audit_logs ao contrato versionado.

ALTER TABLE public.audit_logs
  ALTER COLUMN created_at SET DEFAULT now();
