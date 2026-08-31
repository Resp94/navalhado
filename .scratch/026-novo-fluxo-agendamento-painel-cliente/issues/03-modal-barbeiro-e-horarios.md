# 03 — Modal de Seleção de Barbeiro e Horários

**What to build:**
Modal double-bezel (ModalSelecaoHorarios.tsx) exibindo a lista de barbeiros (ou qualquer livre) e a grade de horários disponíveis em 3 colunas, com exclusão automática de horários passados ou fora da janela de antecedência mínima configurada.

**Blocked by:** 02 — Modal de Seleção de Dias da Semana

**Status:** ready-for-agent

- [ ] Criar ModalSelecaoHorarios.tsx com seletor de barbeiros em cards horizontais
- [ ] Renderizar grade de slots de horários em 3 colunas com destaque para slot selecionado
- [ ] Aplicar filtragem de horários viáveis (isSlotViableForToday) respeitando lead-time
- [ ] Suportar transição para a etapa de resumo ou confirmação direta em caso de remarcação
