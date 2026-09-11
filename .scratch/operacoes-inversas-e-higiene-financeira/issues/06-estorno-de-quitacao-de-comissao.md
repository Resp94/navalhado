# 06 — Estorno de Quitação de Comissão

**What to build:** O gerente desfaz uma Quitação de Comissão registrada por engano, informando o motivo. Cada obrigação de comissão volta exatamente ao saldo que tinha antes daquele pagamento, a quitação estornada deixa de contar como valor pago em todos os saldos e extratos mas permanece visível no histórico, e a Comanda que estava travada por comissão quitada volta a poder ser reaberta. Quitação paga em dinheiro devolve o valor à gaveta do turno.

**Blocked by:** 03 — Módulo profundo de comissões; 04 — Quitação de Comissão sai da gaveta.

**Status:** ready-for-agent

- [ ] Consultar pelo MCP a definição vigente das funções de quitação, saldo e reabertura de Comanda no DEV.
- [ ] Criar migration nova acrescentando à quitação a marcação de estorno na própria linha — quando, por quem e por quê — sem apagar a linha nem as alocações.
- [ ] Criar a função remota de estorno exigindo usuário ativo com papel financeiro, unidade correspondente e motivo obrigatório, mantendo a prerrogativa multiunidade do proprietário.
- [ ] Devolver a cada obrigação exatamente o valor que aquela quitação alocou a ela, recalculando o status pela mesma regra da constraint de consistência vigente.
- [ ] Recusar segundo estorno da mesma quitação com erro de domínio.
- [ ] Estornar o efeito na gaveta quando o repasse foi em dinheiro, pelo mesmo mecanismo de marcação usado no restante do módulo, sem apagar a movimentação original.
- [ ] Recusar o estorno de repasse em dinheiro cujo turno já esteja encerrado, apontando a reabertura de Sessão de Caixa como pré-requisito.
- [ ] Excluir quitações estornadas de toda soma de valor pago, no livro de obrigações e no cálculo legado de compatibilidade.
- [ ] Serializar estornos concorrentes pelo mesmo ponto de travamento já usado pelo registro de quitação.
- [ ] Cobrir por pgTAP: devolução exata em obrigação integral e parcial na mesma operação; saldo do profissional e da unidade sem a quitação estornada; segundo estorno recusado; devolução à gaveta com turno aberto e recusa com turno fechado; estornos concorrentes sem devolução dobrada; Comanda destravada para reabertura; papel não autorizado recusado.
- [ ] Acrescentar a operação ao contrato do módulo de comissões e cobrir a validação de entrada.
- [ ] Aplicar no DEV pelo MCP e comparar advisors antes e depois.
