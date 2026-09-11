# 04 — Quitação de Comissão sai da gaveta

**What to build:** O gerente paga a comissão de um barbeiro em dinheiro e o sistema reconhece que aquele dinheiro saiu da gaveta: a quitação exige uma Sessão de Caixa aberta, registra a saída correspondente com tipo próprio de movimentação, e o Fechamento de Caixa com Conferência passa a subtrair esse valor do saldo esperado. Repasse em PIX, transferência ou cartão continua sem tocar o caixa físico.

**Blocked by:** 01 — Suíte de banco confiável; 02 — Histórico de migrations reconciliado; 03 — Módulo profundo de comissões.

**Status:** ready-for-agent

- [ ] Consultar pelo MCP a definição vigente das funções de quitação e de fechamento e os tipos aceitos de movimentação de caixa no DEV.
- [ ] Criar migration nova acrescentando o tipo próprio de movimentação para repasse de comissão, sem reaproveitar sangria.
- [ ] Acrescentar à quitação o parâmetro de Sessão de Caixa, obrigatório quando o método é dinheiro e recusado quando não é.
- [ ] Recusar com erro de domínio sessão inexistente, encerrada ou de outra unidade.
- [ ] Gerar a movimentação de caixa vinculada à quitação que a originou, e guardar na quitação o vínculo com a sessão em que foi paga.
- [ ] Fazer o fechamento subtrair as quitações em dinheiro do turno no cálculo do valor esperado, ao lado das sangrias.
- [ ] Incrementar a versão de cálculo gravada na sessão, para que fechamentos anteriores continuem interpretáveis pela fórmula que os produziu.
- [ ] Cobrir por pgTAP: quitação em dinheiro sem turno aberto recusada; com turno aberto gerando movimentação do tipo próprio; métodos não-dinheiro sem sessão e sem movimentação; fechamento apurando a divergência real.
- [ ] Refletir o parâmetro novo no contrato do módulo de comissões e cobrir a validação de entrada.
- [ ] Aplicar no DEV pelo MCP e comparar advisors de segurança e performance antes e depois.
- [ ] Manter verdes as suítes atuais de Caixa, Financeiro e quitação.
