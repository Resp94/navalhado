# 02 — Catálogo público e profissionais por serviço

**What to build:** O visitante escolhe um serviço no canal público e passa a visualizar somente profissionais habilitados para executar esse serviço.

**Blocked by:** 01 — Contexto público sem criação automática de cliente.

**Status:** ready-for-agent

- [ ] O catálogo público lista somente serviços ativos e elegíveis para agendamento no tenant resolvido.
- [ ] A seleção de um serviço retorna somente profissionais ativos vinculados àquele serviço e tenant.
- [ ] A tela mantém estados de carregamento, vazio e erro sem quebrar o fluxo existente.
- [ ] O contrato público não depende de token de cliente provisório ou reconhecido.
- [ ] Existem testes de banco, adapter e interface para isolamento por tenant e filtragem por serviço.
