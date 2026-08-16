# 01 — Migração de Banco Versionada 018 (Expansão de Clientes, Serviços e Produtos, Tabela N:N, Drop Payments e RLS Granular)

**What to build:**
Criar e aplicar no Supabase DEV a migração versionada `20260816110000_018_cadastros_fase1_clientes_360_e_servicos_profissionais.sql` contendo todas as estruturas de tabelas, índices de performance e cobertura, políticas RLS granulares e funções RPC refatoradas.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Adicionar campos em `public.customers` (`birth_date`, `tags`, `acquisition_channel`, `cpf`) com índices GIN e B-Tree.
- [ ] Adicionar campos em `public.services` (`return_period_days`, `custom_reminder_template`, `price_type`) e ajustar `duration_minutes` padrão para 40 min.
- [ ] Expandir `public.products` com `product_type` (`retail`/`internal_use`), `barcode`, `min_stock_alert`, `brand`, `category`, `unit_type` e `commission_percentage`, com índices de busca e estoque baixo.
- [ ] Criar tabela de auditoria de estoque `public.product_movements` com chaves estrangeiras para `products`, `comandas` e `users`, com índices de cobertura.
- [ ] Criar tabela associativa `public.professional_services` com `custom_duration_minutes`, `custom_commission_percentage`, `is_enabled` e constraint composta única `(tenant_id, professional_id, service_id)`.
- [ ] Habilitar Row Level Security (RLS) com políticas estritamente granulares (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) para `authenticated` em `professional_services`, `products` e `product_movements`, sem políticas `FOR ALL`.
- [ ] Criar script de *backfill* idempotente associando profissionais e serviços ativos existentes com duração de 40 min.
- [ ] Criar função RPC atômica `adjust_product_stock` para saldo e log de estoque com `SET search_path = ''`.
- [ ] Atualizar RPC `get_available_slots` para consultar a duração customizada do profissional selecionado.
- [ ] Atualizar RPC `complete_customer_registration` para exigir validação de Nome e Sobrenome no backend.
- [ ] Refatorar RPC `get_tenant_financial_metrics` para consolidar faturamento e comissões diretamente de `public.comandas` e `public.comanda_pagamentos`.
- [ ] Remover formalmente a tabela legada `public.payments` (`DROP TABLE IF EXISTS public.payments CASCADE;`).
