# 01 — Consolidar o contrato de disponibilidade do tenant

**What to build:** Uma disponibilidade baseada exclusivamente nas configurações dinâmicas do tenant, com uma interface única para os consumidores da agenda.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A janela usa `business_hours` do tenant e respeita dias ativos e fechados.
- [ ] A cadência usa `slot_interval_minutes` do tenant, sem valores hardcoded.
- [ ] A disponibilidade considera o timezone configurado pelo tenant.
- [ ] A regra fica concentrada em uma interface de domínio reutilizável pela Agenda e pelo portal.
- [ ] O contrato diferencia horário de funcionamento, cadência e disponibilidade efetiva.
- [ ] O comportamento é coberto por testes automatizados com intervalos configuráveis.
- [ ] Qualquer mudança de banco é versionada, numerada conforme a sequência vigente e aplicada somente em DEV via MCP.
