# 05 — Suíte de Testes Automatizados (Vitest) e Validação dos Fluxos

**What to build:** Testes automatizados unitários e de integração cobrindo os novos componentes, fluxos e contratos de repositório.

**Blocked by:** 02 — Reelaboração da Tela de Configurações do Gerente (/configuracoes), 03 — Grade Dinâmica e Disclaimer de Política no Fluxo do Cliente (/cliente/:token/agendar), 04 — Política de Cancelamento e Redirecionamento para WhatsApp do Barbeiro (/cliente/:token)

**Status:** ready-for-agent

- [ ] Atualizar `src/pages/gerente/__tests__/Configuracoes.test.tsx` com testes de renderização dos 3 cards, ViaCEP, seleção de regras e submissão.
- [ ] Atualizar `src/pages/cliente/__tests__/FluxoAgendamento.test.tsx` com testes do disclaimer de política no modal de confirmação.
- [ ] Atualizar `src/pages/cliente/__tests__/MenuCliente.test.tsx` com testes de bloqueio de cancelamento expirado e botão de WhatsApp do barbeiro.
- [ ] Atualizar `src/modules/canal-cliente/__tests__/CanalClienteRepository.test.ts` validando o novo campo `professional_phone` e tratamento de erros.
- [ ] Executar toda a suíte de testes (`npm test`) e garantir 100% de aprovação sem regressões.
