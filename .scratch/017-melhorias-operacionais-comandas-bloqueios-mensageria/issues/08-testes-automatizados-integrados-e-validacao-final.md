# 08 — Testes Automatizados Integrados e Validação Final

**What to build:** Executar a suíte de testes automatizados Vitest cobrindo todos os fluxos (encaixes anônimos, auto-save de comandas, bloqueio manual, soft delete, boas-vindas balcão, comissões por item, cancelamento com barbearia e cards), além de verificar a compilação TypeScript (`npm run build`) e lint (`npm run lint`).

**Blocked by:** 01 — Atendimento e Encaixe de Balcão sem Cliente, 02 — Persistência Imediata de Itens na Comanda, 03 — Bloqueio Manual de Horários na Agenda, 04 — Governança de Cadastros (Soft Delete de Serviços e Profissionais), 05 — Mensageria WhatsApp: Boas-Vindas de Balcão e Templates da Equipe, 06 — Comissões por Item na Comanda (Minhas Comissões), 07 — Canal do Cliente: Cancelamento com Barbearia e Cards Responsivos.

**Status:** ready-for-agent

- [ ] Executar toda a suíte de testes Vitest (`npm test`) e garantir 100% de sucesso sem regressões.
- [ ] Executar checagem de tipos TypeScript (`npm run build`) e confirmar zero erros de compilação.
- [ ] Executar linter (`npm run lint`) garantindo conformidade de código.
- [ ] Realizar validação cruzada dos critérios de aceitação da especificação técnica.
