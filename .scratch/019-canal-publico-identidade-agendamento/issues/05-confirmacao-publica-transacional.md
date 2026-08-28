# 05 — Confirmação pública transacional com identidade correta

**What to build:** Na confirmação do agendamento, o sistema identifica ou cria o cliente pelo telefone normalizado e grava cliente e agendamento atomicamente.

**Blocked by:** 01 — Contexto público sem criação automática de cliente; 04 — Restrições reais de disponibilidade profissional.

**Status:** ready-for-agent

- [ ] Nome completo e telefone são obrigatórios e validados antes da confirmação.
- [ ] O telefone é normalizado antes da busca ou criação da identidade.
- [ ] Telefone já cadastrado no tenant reutiliza a identidade correspondente sem duplicação.
- [ ] Telefone inexistente cria um novo cadastro completo vinculado ao tenant.
- [ ] Cliente e agendamento são confirmados em uma única transação, sem registros parciais em caso de falha.
- [ ] O agendamento respeita novamente disponibilidade, antecedência e conflito no momento da gravação.
- [ ] O contrato retorna a identidade/token necessários para a continuidade do fluxo público.
- [ ] Existem testes de concorrência, repetição, falha transacional e isolamento por tenant.
