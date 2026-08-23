-- Migration: 030_security_and_performance_cleanup
-- Description: Corrige search_path em private.slugify, remove índice duplicado em tenants, ajusta permissões em triggers e adiciona índice de cobertura em cash_movements

-- 1. Fix mutable search_path em private.slugify
CREATE OR REPLACE FUNCTION private.slugify(value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_result TEXT;
BEGIN
  IF value IS NULL OR btrim(value) = '' THEN
    RETURN NULL;
  END IF;
  
  v_result := translate(lower(value), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
  v_result := regexp_replace(v_result, '[^a-z0-9]+', '-', 'g');
  v_result := regexp_replace(v_result, '^-+|-+$', '', 'g');
  
  RETURN v_result;
END;
$$;

-- 2. Remover índice duplicado em tenants.slug (tenants_slug_key já é criado automaticamente pela constraint UNIQUE)
DROP INDEX IF EXISTS public.idx_tenants_slug;

-- 3. Ajustar permissões e search_path no trigger de normalização de categorias
CREATE OR REPLACE FUNCTION public.normalize_service_category_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.category IS NOT NULL THEN
    NEW.category := INITCAP(TRIM(NEW.category));
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_service_category_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_service_category_trigger() FROM anon;
REVOKE ALL ON FUNCTION public.normalize_service_category_trigger() FROM authenticated;

-- 4. Índice de cobertura para FK cash_movements.performed_by
CREATE INDEX IF NOT EXISTS idx_cash_movements_performed_by ON public.cash_movements(performed_by);
