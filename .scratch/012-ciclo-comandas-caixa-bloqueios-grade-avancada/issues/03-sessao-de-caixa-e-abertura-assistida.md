# 03 — Sessão de Caixa: Abertura Assistida no Checkout e Controle de Turno Diário

**What to build:**
Construir o fluxo de validação e abertura assistida de caixa diário (`cash_sessions`), impedindo recebimentos com caixa fechado e permitindo abrir o turno em 1 clique durante o checkout sem perder os dados da comanda.

**Blocked by:** 02 — Repositórios de Domínio (ComandaRepository, CaixaRepository, BloqueioRepository) e Testes.

**Status:** ready-for-agent

- [ ] Criar modal/overlay contextual de Abertura Assistida de Caixa disparado automaticamente ao tentar cobrar com caixa fechado.
- [ ] Formulário ágil com campo de Fundo de Troco Inicial (`initial_amount`) e confirmação imediata.
- [ ] Preservação integral do estado da comanda preenchida após a abertura do caixa.
- [ ] Validação visual e feedback toast amigável em PT-BR para abertura de turno.
- [ ] Testes unitários do modal de abertura assistida de caixa.
