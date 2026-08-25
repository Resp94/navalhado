# 03 — Identificação Visual do Agendamento Vinculado nas Comandas

**What to build:** 
Tornar explícito e altamente visual na listagem de comandas (`Comandas.tsx`) e no modal de checkout (`ComandaCheckoutModal.tsx`) a qual agendamento cada comanda se refere. Comandas geradas a partir de um agendamento devem exibir um badge destacado com ícone de calendário, data, horário e serviço contratado (ou indicação de encaixe). Comandas criadas de forma avulsa devem exibir a etiqueta correspondente de "Atendimento Balcão / Avulsa".

**Blocked by:** 02 — Cancelamento Automático de Comandas e Atualização em Tempo Real (Sem Refresh).

**Status:** completed

- [x] Expandir o tipo `ComandaEnriched` e o método `listarTodas` no repositório/adaptador de comandas para retornar os dados de data, horário, serviço e tipo de encaixe do agendamento vinculado.
- [x] Renderizar badge destacado com ícone e cores temáticas nos cards da página `Comandas.tsx`.
- [x] Destacar as informações do agendamento de origem no cabeçalho do `ComandaCheckoutModal.tsx`.
- [x] Atualizar os testes unitários do módulo de comandas para validar o enriquecimento dos dados.
