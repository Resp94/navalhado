# 05 — Testes Unitários de Regressão, Acessibilidade e Auditoria Impeccable

**What to build:**
Suite de testes automatizados e validação de qualidade visual/acessibilidade para a rota `/financeiro` e seus componentes, garantindo 100% de cobertura nos novos fluxos e zero regressões em todo o app.

**Blocked by:**
- 03 — Aba 1: Frente de Caixa Diário & Histórico de Turnos
- 04 — Aba 2: Repasses de Comissões, Detalhamento e Quitação

**Status:** ready-for-agent

- [ ] Escrever testes unitários em `Financeiro.test.tsx` cobrindo a renderização dos 5 KPI cards, alternância entre as abas operacionais, acionamento do modal de abertura/fechamento de caixa e acionamento do modal de quitação de comissão.
- [ ] Adicionar testes unitários para `FechamentoCaixaModal.test.tsx` e `QuitacaoComissaoModal.test.tsx`.
- [ ] Validar conformidade de acessibilidade (A11y): navegação por teclado, atributos `aria-label`, foco em modais e suporte a `prefers-reduced-motion`.
- [ ] Garantir que o comando `npx tsc --noEmit` passe com 0 erros de tipagem.
- [ ] Executar bateria completa do `vitest` e assegurar que todos os testes passem (100% de taxa de aprovação).
