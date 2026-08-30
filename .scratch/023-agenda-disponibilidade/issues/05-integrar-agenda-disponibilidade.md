# 05 — Integrar a disponibilidade na Agenda

**What to build:** A Agenda interna deve consumir o contrato unificado de disponibilidade para exibir a interseção correta entre tenant, profissional, duração e conflitos, incluindo a opção `Tanto faz`.

**Blocked by:** 01 — Consolidar o contrato de disponibilidade do tenant; 02 — Aplicar escala e pausas exatas do profissional; 03 — Aplicar duração efetiva e conflitos temporais; 04 — Calcular último horário dentro dos limites.

**Status:** ready-for-agent

- [ ] A Agenda interna usa a mesma decisão de disponibilidade do contrato de domínio.
- [ ] A grade do profissional não é recriada a partir do início da escala individual.
- [ ] A opção `Tanto faz` usa a grade do tenant.
- [ ] `Tanto faz` fica disponível quando pelo menos um profissional compatível atende às regras.
- [ ] Um dia fechado no tenant continua fechado mesmo com escala profissional cadastrada.
- [ ] A Agenda não permite início fora do fechamento do tenant ou do profissional.
- [ ] A duração exibida e a duração usada para conflitos permanecem consistentes.
- [ ] A integração não altera o fluxo especial de encaixes.
- [ ] O contrato fica pronto para ser consumido pelo portal público da Spec 024 sem duplicar a regra.
