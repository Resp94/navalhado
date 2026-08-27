# 01 — Atendimento e Encaixe de Balcão sem Cliente

**What to build:** Permitir realizar atendimentos, encaixes e comandas de balcão sem cadastro ou seleção de cliente, tornando `public.appointments.customer_id` anulável no banco, impedindo a geração de clientes fantasmas na tabela `customers` e garantindo que os agendamentos e comandas anônimas funcionem normalmente no faturamento e no caixa.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] Criar e aplicar migration tornando `public.appointments.customer_id` anulável (`DROP NOT NULL`) e ajustando a trigger `fn_auto_create_comanda_for_appointment()` para suportar `customer_id: null`.
- [x] Atualizar o modal de agendamento/encaixe na Agenda do Gerente para permitir submissão sem seleção ou cadastro de cliente.
- [x] Garantir que nenhum registro provisório com nome "Cliente" seja inserido na tabela `customers` durante encaixes anônimos.
- [x] Garantir que comandas de balcão sem cliente sejam identificadas como "Venda Balcão" ou "Cliente Balcão" e contabilizadas com exatidão nas sessões de caixa e no financeiro.
- [x] Atualizar testes unitários e de integração em `Agenda.test.tsx` e `ComandaCheckoutModal.test.tsx`.
