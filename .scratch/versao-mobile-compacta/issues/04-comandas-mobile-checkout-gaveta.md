# 04 — Aba Comandas Mobile e Gaveta de Checkout Rápido

**What to build:**
Implementar a 2ª aba fixa da Bottom Bar do Gerente focada no ciclo operacional de comandas: exibir a lista de todas as contas atualmente em aberto/em atendimento no salão, botão para criar uma "Nova Comanda Avulsa" (para venda rápida de produtos ou clientes sem agendamento prévio) e fluxo de recebimento (checkout) através de uma gaveta inferior (*Bottom Sheet*) com escolha de método de pagamento (PIX, Cartão de Crédito/Débito, Dinheiro) e quitação instantânea.

**Blocked by:** 01 — Infraestrutura de Layout Base, Bottom Navigation e Modais Bottom Sheet

**Status:** ready-for-agent

- [ ] Listagem de cartões de comandas abertas mostrando nome do cliente, barbeiro, serviços/produtos lançados e valor total acumulado.
- [ ] Botão de ação rápida `+ Nova Comanda Avulsa` posicionado na zona ergonômica da tela.
- [ ] Possibilidade de adicionar serviços ou produtos rápidos a uma comanda existente antes de encerrá-la.
- [ ] Toque no botão "Receber" dispara uma gaveta inferior (*Bottom Sheet*) com resumo financeiro, desconto/acréscimo e seleção da forma de pagamento (PIX, Cartão, Dinheiro).
- [ ] Confirmação de recebimento encerra a comanda, registra a movimentação no caixa e atualiza o estado em tempo real.
