# 03 — Aba 1: Frente de Caixa Diário & Histórico de Turnos

**What to build:**
Superfície operacional da Aba 1 no Hub Financeiro (`/financeiro`), exibindo o monitoramento da gaveta de caixa em tempo real: se o caixa estiver fechado, exibe banner informativo com CTA `[+ Abrir caixa do dia]` disparando o modal de abertura com fundo de troco; se estiver aberto, exibe badge verde de sessão ativa, horário de abertura, operador responsável, fundo de troco inicial, recebimentos em dinheiro apurados e botão `[🔒 Fechar caixa do turno]` (que abre o modal de conferência). Abaixo, exibe a tabela com o histórico de turnos anteriores e detalhes de fechamento.

**Blocked by:**
- 01 — Repositório de Caixa & Modal de Fechamento com Conferência
- 02 — Painel de Indicadores Financeiros (KPIs) com Destaque para Produtos e Custos (CMV)

**Status:** ready-for-agent

- [x] Implementar seletor de abas (`Caixa diário & Turnos` e `Repasses de comissões`) com controle de estado e acessibilidade via teclado.
- [x] Construir card/banner de monitoramento de sessão ativa consumindo `CaixaRepository.getActiveSession`.
- [x] Integrar fluxo de abertura assistida de caixa (`AberturaAssistidaCaixaModal.tsx`) atualizando o estado visual instantaneamente após abertura.
- [x] Integrar fluxo de fechamento de caixa (`FechamentoCaixaModal.tsx`) com recarregamento suave de métricas e histórico.
- [x] Renderizar tabela com lista de sessões anteriores consumindo `CaixaRepository.listarHistorico` (data/hora, operador, troco inicial, valor fechado, diferença e status).

