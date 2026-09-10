# 07 — Fechar caixa atomicamente

**What to build:** O gerente informa a contagem física e recebe um fechamento único com valor esperado, valor contado e diferença persistidos no mesmo instante.

**Blocked by:** 02 — Restaurar movimentações de estoque; 03 — Restringir operações financeiras e de estoque; 04 — Proteger a quitação de comissões.

**Status:** ready-for-agent

- [ ] Caracterizar o cálculo atual de fundo inicial, dinheiro recebido, suprimentos, sangrias e outros meios.
- [ ] Consultar no DEV, pelo MCP, o schema e os dados das sessões e movimentos de caixa.
- [ ] Criar migration nova com os campos aditivos necessários e um comando transacional de fechamento.
- [ ] Calcular o valor esperado dentro da mesma transação que encerra a sessão.
- [ ] Persistir valor esperado, contado, diferença, responsável e instante do servidor.
- [ ] Excluir PIX, cartões e outros meios da gaveta física sem removê-los do resumo financeiro.
- [ ] Exigir sessão aberta, tenant correto e usuário ativo autorizado.
- [ ] Impedir fechamento duplicado ou concorrente.
- [ ] Fazer o repositório atual usar uma única chamada preservando o modal e o retorno esperado.
- [ ] Aplicar no DEV via MCP e validar igualdade, sobra, quebra, concorrência e timezone.
- [ ] Manter verdes os testes atuais de Caixa e Financeiro.
