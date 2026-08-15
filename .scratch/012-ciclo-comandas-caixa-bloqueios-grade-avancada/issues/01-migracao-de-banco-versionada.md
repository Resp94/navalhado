# 01 — Migração de Banco Versionada (Comandas, Caixa, Bloqueios, Produtos, RLS e Limpeza RPC)

**What to build:**
Criar e aplicar a migração versionada `20260815140000_015_comandas_caixa_bloqueios_produtos.sql` no Supabase DEV contendo as estruturas completas de tabelas, índices de chaves estrangeiras, regras de concorrência, políticas RLS blindadas e limpeza de funções RPC legadas.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Criar tabelas `public.cash_sessions`, `public.products`, `public.comandas`, `public.comanda_itens`, `public.comanda_pagamentos`, `public.blocked_slots` e `public.waiting_list` com tipos atômicos, defaults em UTC e checks monetários (`CHECK >= 0`).
- [ ] Criar índices cobrindo todas as chaves estrangeiras (`unindexed_foreign_keys`) para evitar table scans.
- [ ] Criar índice único parcial `idx_single_open_cash_session_per_tenant` em `cash_sessions` para impedir múltiplos caixas abertos simultâneos por barbearia.
- [ ] Atualizar a constraint GIST anti-sobreposição de `appointments` para permitir overbooking quando `is_fitting = true`.
- [ ] Habilitar Row Level Security (RLS) com políticas multi-tenant estritas usando `TO authenticated` com `USING` e `WITH CHECK`.
- [ ] Incluir tabelas `comandas`, `cash_sessions` e `blocked_slots` na publicação `supabase_realtime`.
- [ ] Remover formalmente as funções legadas `get_available_slots(uuid, text, date)` e `get_customer_info_by_token(uuid, text)`.
