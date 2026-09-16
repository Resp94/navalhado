# 07 — Fechar caixa atomicamente

**What to build:** O gerente informa a contagem física e recebe um fechamento único com valor esperado, valor contado e diferença persistidos no mesmo instante.

**Blocked by:** 02 — Restaurar movimentações de estoque; 03 — Restringir operações financeiras e de estoque; 04 — Proteger a quitação de comissões.

**Status:** completed

- [x] Caracterizar o cálculo atual de fundo inicial, dinheiro recebido, suprimentos, sangrias e outros meios.
- [x] Consultar no DEV, pelo MCP, o schema e os dados das sessões e movimentos de caixa.
- [x] Criar migration nova com os campos aditivos necessários e um comando transacional de fechamento.
- [x] Calcular o valor esperado dentro da mesma transação que encerra a sessão.
- [x] Persistir valor esperado, contado, diferença, responsável e instante do servidor.
- [x] Excluir PIX, cartões e outros meios da gaveta física sem removê-los do resumo financeiro.
- [x] Exigir sessão aberta, tenant correto e usuário ativo autorizado.
- [x] Impedir fechamento duplicado ou concorrente.
- [x] Fazer o repositório atual usar uma única chamada preservando o modal e o retorno esperado.
- [x] Aplicar no DEV via MCP e validar igualdade, sobra, quebra, concorrência e timezone.
- [x] Manter verdes os testes atuais de Caixa e Financeiro.

**Evidências:** migration `20260910192733_fechar_caixa_atomicamente` aplicada no DEV; teste pgTAP com 20/20 asserções; testes de Caixa/modal com 19/19; build TypeScript/Vite concluído; advisors do DEV sem alertas específicos de tabelas ou funções fora dos avisos preexistentes de funções `SECURITY DEFINER` autenticadas.
