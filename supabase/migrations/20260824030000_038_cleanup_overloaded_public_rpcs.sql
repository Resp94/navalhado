-- Migration: 038_cleanup_overloaded_public_rpcs
-- Description: Remove assinaturas legadas de RPCs públicas sobrecarregadas (overloaded) que causam ambiguidade 42725 no PostgREST/Supabase RPC
-- Date: 2026-08-24

-- 1. Remover assinatura legada de complete_customer_registration(uuid, text)
-- Mantendo apenas a assinatura vigente com validação de telefone: complete_customer_registration(uuid, text, text)
DROP FUNCTION IF EXISTS public.complete_customer_registration(uuid, text);

-- 2. Remover assinatura legada de get_or_create_provisional_customer_by_slug(text)
-- Mantendo apenas a assinatura vigente com token reutilizável: get_or_create_provisional_customer_by_slug(text, uuid);
DROP FUNCTION IF EXISTS public.get_or_create_provisional_customer_by_slug(text);
