# 03 — Adaptador Supabase e Custom Hook useCanalCliente

**What to build:** O adaptador de produção `SupabaseCanalClienteAdapter` encapsulando as rotinas RPC do Supabase e o gerenciamento transparente do `localStorage`, além do custom hook React `useCanalCliente` para fácil integração nas páginas.

**Blocked by:** 02 — Módulo Profundo CanalClienteRepository e Adaptador em Memória com Testes.

**Status:** completed

- [x] Implementação de `SupabaseCanalClienteAdapter` chamando as RPCs `get_customer_details_by_token`, `get_services_by_customer_token`, `get_professionals_by_customer_token`, `get_available_slots_by_customer_token`, `create_appointment_by_customer_token`, `reschedule_appointment_by_customer_token`, `cancel_appointment_by_customer_token`, `get_customer_appointments_by_token`, `promote_customer_registration_by_token`.
- [x] Leitura, escrita e remoção transparente da chave `navalhado_customer_token` no `localStorage`.
- [x] Mapeamento de erros de RPC para exceções de domínio tipadas.
- [x] Implementação do custom hook React `useCanalCliente` em `useCanalCliente.ts`.

