# 01 — Consolidar o contrato de disponibilidade do tenant

**What to build:** Uma disponibilidade baseada exclusivamente nas configurações dinâmicas do tenant, com uma interface única para os consumidores da agenda.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] A janela usa `business_hours` do tenant e respeita dias ativos e fechados.
- [x] A cadência usa `slot_interval_minutes` do tenant, sem valores hardcoded.
- [x] A disponibilidade considera o timezone configurado pelo tenant.
- [x] A regra fica concentrada em uma interface de domínio reutilizável pela Agenda e pelo portal.
- [x] O contrato diferencia horário de funcionamento, cadência e disponibilidade efetiva.
- [x] O comportamento é coberto por testes automatizados com intervalos configuráveis.
- [x] Não houve mudança de banco nesta implementação; migration não foi necessária. O contrato existente foi preservado.
