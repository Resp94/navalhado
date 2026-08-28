# 05 — Confirmação pública transacional com identidade correta

**What to build:** Na confirmação do agendamento, o sistema identifica ou cria o cliente pelo telefone normalizado e grava cliente e agendamento atomicamente.

**Blocked by:** 01 — Contexto público sem criação automática de cliente; 04 — Restrições reais de disponibilidade profissional.

**Status:** concluído

- [x] Nome completo e telefone são obrigatórios e validados antes da confirmação.
- [x] O telefone é normalizado antes da busca ou criação da identidade.
- [x] Telefone já cadastrado no tenant reutiliza a identidade correspondente sem duplicação.
- [x] Telefone inexistente cria um novo cadastro completo vinculado ao tenant.
- [x] Cliente e agendamento são confirmados em uma única transação, sem registros parciais em caso de falha.
- [x] O agendamento respeita novamente disponibilidade, antecedência e conflito no momento da gravação.
- [x] O contrato retorna a identidade/token necessários para a continuidade do fluxo público.
- [x] Existem testes de concorrência, repetição, falha transacional e isolamento por tenant.
