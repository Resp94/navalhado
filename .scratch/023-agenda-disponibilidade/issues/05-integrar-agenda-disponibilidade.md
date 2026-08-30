# 05 — Integrar a disponibilidade na Agenda

**What to build:** A Agenda interna deve consumir o contrato unificado de disponibilidade para exibir a interseção correta entre tenant, profissional, duração e conflitos, incluindo a opção `Tanto faz`.

**Blocked by:** 01 — Consolidar o contrato de disponibilidade do tenant; 02 — Aplicar escala e pausas exatas do profissional; 03 — Aplicar duração efetiva e conflitos temporais; 04 — Calcular último horário dentro dos limites.

**Status:** completed

- [x] A Agenda interna usa a mesma decisão de disponibilidade do contrato de domínio.
- [x] A grade do profissional começa no início efetivo da escala individual e respeita os limites máximos do tenant.
- [x] A opção `Tanto faz` compõe a união das grades dos profissionais compatíveis, respeitando o início efetivo de cada um.
- [x] `Tanto faz` fica disponível quando pelo menos um profissional compatível atende às regras.
- [x] Um dia fechado no tenant continua fechado mesmo com escala profissional cadastrada.
- [x] A Agenda não permite início fora do fechamento do tenant ou do profissional.
- [x] A duração exibida e a duração usada para conflitos permanecem consistentes.
- [x] A integração não altera o fluxo especial de encaixes.
- [x] O contrato fica pronto para ser consumido pelo portal público da Spec 024 sem duplicar a regra.
