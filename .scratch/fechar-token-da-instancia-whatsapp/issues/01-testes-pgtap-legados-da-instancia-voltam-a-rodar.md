# 01: Testes pgTAP legados da Instância WhatsApp voltam a rodar

Parte da spec 053 (Fechar o token da Instância WhatsApp no navegador).

**What to build:** os arquivos pgTAP que chamam `has_constraint`, função que o pgTAP 1.3.3 do DEV não tem, passam a rodar de ponta a ponta. Assim as asserções de token que já existem neles são executadas e servem de linha de base antes do fechamento.

- `supabase/tests/database/whatsapp_neutral_persistence.test.sql`: as oito chamadas de `has_constraint` (linhas 15 a 62) viram `select ok(exists(select 1 from pg_constraint where conrelid = '<tabela>'::regclass and conname = '<nome>'), '<descrição que já existe>')`. É uma troca por uma, então `plan(45)` não muda. Os oito nomes de constraint existem no DEV (conferido em 2026-10-01).
- `supabase/tests/database/whatsapp_balcao_outbox.test.sql`: as duas chamadas (linhas 10 e 16), mesma troca. Antes, confirmar no DEV que `whatsapp_message_outbox_key_unique` e `whatsapp_message_outbox_status_check` existem; se algum nome mudou, ajustar o nome, não a asserção.
- Nenhuma asserção de token muda. As de `whatsapp_neutral_persistence.test.sql` (token não legível e não gravável) e a 7 de `security_hardening.test.sql` já pedem o fechamento certo e passam no ticket 02.
- A linha de base fica registrada no resultado: o que passa e o que falha, nos três arquivos, antes do ticket 02.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `whatsapp_neutral_persistence.test.sql` roda inteiro no DEV (por `execute_sql`, dentro do `begin; ... rollback;` do próprio arquivo). Esperado antes do ticket 02: falha só nas duas asserções do token
- [ ] `whatsapp_balcao_outbox.test.sql` roda inteiro
- [ ] `security_hardening.test.sql` rodado só para registrar a linha de base: a 7 (token) falha; a 12 (`comanda_pagamentos`) é o achado antigo e conhecido e fica como está
- [ ] Resultado registrado neste ticket, com a contagem de cada arquivo
- [ ] `npm run lint`, `npm test` e `npm run build` passam
