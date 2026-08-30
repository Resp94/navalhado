# 04 — Valor do serviço na confirmação

**What to build:** Incluir o valor do serviço na confirmação de criação usando o preço vigente do serviço e o marcador `{valor}`, com formatação monetária brasileira e compatibilidade com os templates existentes.

**Blocked by:** None — pode iniciar imediatamente.

**Status:** ready-for-agent

- [ ] A confirmação de criação resolve `{valor}` a partir do preço do serviço registrado, sem criar uma coluna redundante de preço no agendamento.
- [ ] O valor é formatado em pt-BR como moeda em reais, incluindo os casos válidos de valor zero.
- [ ] A substituição ocorre na confirmação de criação e não adiciona automaticamente o marcador a cancelamento, reagendamento, lembrete, boas-vindas, primeiro contato ou mensagem para profissional.
- [ ] Templates antigos sem `{valor}` continuam renderizando normalmente.
- [ ] Alteração do preço do serviço é refletida conforme a fonte de dados vigente definida pelo domínio.
- [ ] Testes cobrem valor inteiro, centavos, zero, template antigo, ausência de serviço e isolamento por tenant.
- [ ] O contrato de mensagens e aliases já registrado no snapshot permanece compatível.

