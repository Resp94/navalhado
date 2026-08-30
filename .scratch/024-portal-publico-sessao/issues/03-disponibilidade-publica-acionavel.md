# 03 — Disponibilidade pública somente com horários acionáveis

**What to build:** O portal público mostra somente horários realmente reserváveis para o serviço, profissional e data selecionados, usando a mesma decisão de disponibilidade da Agenda e mantendo um estado vazio orientativo quando não houver opções.

**Blocked by:** 01 — Entrada pública por slug e sessão do cliente; Spec 023 — disponibilidade dinâmica da Agenda (concluída).

**Status:** ready-for-agent

- [ ] O novo agendamento renderiza somente horários disponíveis.
- [ ] Horários ocupados, bloqueados ou dentro de pausas não são renderizados como botões inativos.
- [ ] A disponibilidade considera serviço, duração efetiva, profissional, data, expediente, escala, pausa, conflitos e antecedência.
- [ ] A mesma decisão de disponibilidade é usada no novo agendamento e no reagendamento.
- [ ] Alterar serviço, profissional ou data recalcula a lista de opções.
- [ ] O agendamento atual é tratado corretamente durante o reagendamento.
- [ ] Quando não há opções, o portal exibe estado vazio com orientação para escolher outra data ou profissional.
- [ ] A Agenda administrativa mantém sua visualização operacional, sem herdar a ocultação pública.
- [ ] Testes automatizados cobrem disponibilidade, reagendamento, estado vazio e ausência de botões inativos.
- [ ] A validação manual em DEV confirma o comportamento em desktop e mobile com prints.
