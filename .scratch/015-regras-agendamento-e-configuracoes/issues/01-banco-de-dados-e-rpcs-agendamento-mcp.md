# 01 — Motor de Banco de Dados, RPCs de Agendamento Dinâmico e Aplicação via MCP

**What to build:** As regras dinâmicas de agendamento no banco de dados (colunas em `tenants`, constraints de validação e RPCs de geração de slots e controle de antecedência mínima para agendar e cancelar), com aplicação direta no banco Supabase via MCP `execute_sql`.

**Blocked by:** None — can start immediately

**Status:** done

- [x] Criar arquivo de migração versionado `supabase/migrations/20260818221500_025_booking_rules_and_config.sql`.
- [x] Adicionar colunas `slot_interval_minutes`, `min_booking_lead_time_minutes` e `min_cancellation_lead_time_minutes` em `public.tenants` com `CHECK` constraints.
- [x] Atualizar `public.get_available_slots` para gerar slots no passo `v_slot_interval` e filtrar `s.slot_start >= (now() + (v_min_booking_lead_time || ' minutes')::interval)`.
- [x] Atualizar `public.create_appointment_by_token` com validação defensiva de antecedência mínima.
- [x] Atualizar `public.cancel_appointment_by_token` com validação de `min_cancellation_lead_time_minutes` e erro `APPOINTMENT_CANCELLATION_DEADLINE_EXPIRED`.
- [x] Atualizar `public.reschedule_appointment_by_token` para validação atômica de cancelamento e nova reserva.
- [x] Atualizar `public.get_customer_appointments_by_token` para retornar `p.phone as professional_phone`.
- [x] Garantir `SECURITY DEFINER`, `SET search_path = ''` e permissões granulares (`REVOKE FROM PUBLIC`, `GRANT EXECUTE`).
- [x] Aplicar o script no banco Supabase ativo via ferramenta MCP `execute_sql` e validar via query de teste.
