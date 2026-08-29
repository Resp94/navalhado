# 02 — Catálogo público e profissionais por serviço

**What to build:** O visitante escolhe um serviço no canal público e passa a visualizar somente profissionais habilitados para executar esse serviço.

**Blocked by:** 01 — Contexto público sem criação automática de cliente.

**Status:** concluído

- [x] O catálogo público lista somente serviços ativos e elegíveis para agendamento no tenant resolvido.
- [x] A seleção de um serviço retorna somente profissionais ativos vinculados àquele serviço e tenant.
- [x] A tela mantém estados de carregamento, vazio e erro sem quebrar o fluxo existente.
- [x] O contrato público não depende de token de cliente provisório ou reconhecido.
- [x] Existem testes de banco, adapter e interface para isolamento por tenant e filtragem por serviço.
