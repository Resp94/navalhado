# 01 — Migration 055: Slots Canônicos, Origem de Cadastro, Trava de Antecedência e Reagendamento

**What to build:** 
A migração de banco de dados PostgreSQL `20260827180000_055_fix_first_contact_slots_lead_time_and_reschedule.sql` que unifica canonicamente a RPC `public.get_available_slots` (eliminando sobrecargas conflitantes e corrigindo cálculos de dia da semana com `extract(dow)`), ajusta `public.get_available_slots_by_token`, atualiza `customers.registration_origin` com default `'agenda'`, restringe o trigger `trg_customer_welcome_balcao` estritamente a cadastros manuais do balcão, atualiza RPCs de cadastro para registrar origens explícitas, refatora `reschedule_appointment_by_token` para `UPDATE` direto e reconfigura o job `process-whatsapp-reminders` no `pg_cron` com timeout de 15000ms.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Remover assinaturas sobrecarregadas legadas de `public.get_available_slots` e criar a função canônica única com suporte a timezone e filtragem de antecedência mínima (`min_booking_lead_time_minutes`).
- [ ] Atualizar `public.get_available_slots_by_token` para chamar a função canônica com a ordem de parâmetros correta.
- [ ] Atualizar constraint `customers_registration_origin_check` e definir `DEFAULT 'agenda'` na tabela `public.customers`.
- [ ] Ajustar `fn_customer_welcome_balcao_trigger()` para disparar exclusivamente quando `NEW.registration_origin = 'balcao'` e `NEW.welcome_sent_at IS NULL`.
- [ ] Ajustar `find_or_create_whatsapp_customer` (`'whatsapp_bot'`) e `get_or_create_provisional_customer_by_slug` (`'online'`).
- [ ] Refatorar `reschedule_appointment_by_token` para executar `UPDATE appointments` atômico sem invocar cancelamento.
- [ ] Reconfigurar `process-whatsapp-reminders` no `pg_cron` com timeout de 15s e aplicar a migration com sucesso no banco.
