-- Migration: 039_customer_last_first_contact
-- Description: Adiciona coluna last_first_contact_at na tabela customers para controle de envio diário e reenvio por palavra-chave
-- Date: 2026-08-24

ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS last_first_contact_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.customers.last_first_contact_at IS 'Data e hora do último envio de mensagem de primeiro contato / boas-vindas via WhatsApp';
