-- Migration: 029_normalize_service_categories
-- Description: Normaliza os nomes de categorias dos servicos para TitleCase e cria trigger de integridade

-- 1. Normaliza registros existentes
UPDATE public.services
SET category = INITCAP(TRIM(category))
WHERE category IS NOT NULL;

-- 2. Trigger para garantir integridade em inserts e updates
CREATE OR REPLACE FUNCTION public.normalize_service_category_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.category IS NOT NULL THEN
    NEW.category := INITCAP(TRIM(NEW.category));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_service_category ON public.services;
CREATE TRIGGER trg_normalize_service_category
  BEFORE INSERT OR UPDATE OF category ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_service_category_trigger();
