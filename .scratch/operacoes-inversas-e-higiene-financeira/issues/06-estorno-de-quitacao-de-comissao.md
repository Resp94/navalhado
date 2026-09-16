# 06 — Estorno de Quitação de Comissão

**What to build:** O gerente desfaz uma Quitação de Comissão registrada por engano, informando o motivo. Cada obrigação de comissão volta exatamente ao saldo que tinha antes daquele pagamento, a quitação estornada deixa de contar como valor pago em todos os saldos e extratos mas permanece visível no histórico, e a Comanda que estava travada por comissão quitada volta a poder ser reaberta. Quitação paga em dinheiro devolve o valor à gaveta do turno.

**Blocked by:** 03 — Módulo profundo de comissões; 04 — Quitação de Comissão sai da gaveta.

**Status:** done — migration aplicada no DEV, pgTAP e vitest verdes

- [x] Consultar pelo MCP a definição vigente das funções de quitação, saldo e reabertura de Comanda no DEV.
- [x] Criar migration nova acrescentando à quitação a marcação de estorno na própria linha — quando, por quem e por quê — sem apagar a linha nem as alocações.
- [x] Criar a função remota de estorno exigindo usuário ativo com papel financeiro, unidade correspondente e motivo obrigatório, mantendo a prerrogativa multiunidade do proprietário.
- [x] Devolver a cada obrigação exatamente o valor que aquela quitação alocou a ela, recalculando o status pela mesma regra da constraint de consistência vigente.
- [x] Recusar segundo estorno da mesma quitação com erro de domínio.
- [x] Estornar o efeito na gaveta quando o repasse foi em dinheiro, pelo mesmo mecanismo de marcação usado no restante do módulo, sem apagar a movimentação original.
- [x] Recusar o estorno de repasse em dinheiro cujo turno já esteja encerrado, apontando a reabertura de Sessão de Caixa como pré-requisito.
- [x] Excluir quitações estornadas de toda soma de valor pago, no livro de obrigações e no cálculo legado de compatibilidade.
- [x] Serializar estornos concorrentes pelo mesmo ponto de travamento já usado pelo registro de quitação.
- [x] Cobrir por pgTAP: devolução exata em obrigação integral e parcial na mesma operação; saldo do profissional e da unidade sem a quitação estornada; segundo estorno recusado; devolução à gaveta com turno aberto e recusa com turno fechado; estornos concorrentes sem devolução dobrada; Comanda destravada para reabertura; papel não autorizado recusado.
- [x] Acrescentar a operação ao contrato do módulo de comissões e cobrir a validação de entrada.
- [x] Aplicar no DEV pelo MCP e comparar advisors antes e depois.

## Notas de execução

- Migration `20260912020000_estorno_quitacao_comissao` aplicada no DEV via
  MCP, versão reconciliada.
- `commission_payouts` ganha `reversed_at`/`reversed_by`/`reversal_reason`
  (com constraint exigindo motivo de 5+ caracteres quando estornada);
  `cash_movements` ganha as mesmas três colunas para marcar o movimento de
  `repasse_comissao` como estornado sem apagá-lo.
- `reverse_commission_payout`: exige gerente/proprietário da unidade,
  motivo mínimo, localiza a quitação por tenant, recusa segunda tentativa,
  serializa com `register_commission_payout` travando a mesma linha do
  profissional, devolve a cada obrigação exatamente o valor alocado
  (recalculando `open`/`partially_paid`/`paid` pela mesma regra da
  constraint de saldo), e — quando o repasse foi em dinheiro — exige que o
  turno de origem ainda esteja aberto (senão aponta a reabertura como
  pré-requisito) e marca o movimento de caixa correspondente como
  estornado.
- `register_commission_payout`, `get_professional_commission_balance` e
  `close_cash_session` foram atualizadas para excluir quitações e
  movimentações estornadas de todos os cálculos de saldo pago e de valor
  esperado — sem essa mudança, uma quitação estornada continuaria contando
  como paga.
- Novo `supabase/tests/database/21_estorno_quitacao_comissao.test.sql`
  (19 asserções): devolução exata de obrigação integral e parcial, saldo e
  extrato refletindo o estorno, recusa de estorno duplicado, recusa de
  estorno em dinheiro com turno encerrado (com a reabertura do ticket 05
  destravando o fluxo), e confirmação de que o registro original permanece
  visível apenas marcado como estornado.
- Revalidados 11 (`quitacoes_obrigacoes`) e 19 (`quitacao_comissao_gaveta_caixa`)
  após a reescrita das três funções compartilhadas — sem regressão.
- Frontend: `src/modules/comissoes` ganha `reversePayout`/`estornarQuitacao`
  de forma aditiva, com a mesma validação de motivo mínimo do banco.
  Nenhuma tela nova (fiação visual fica para trabalho posterior).
- Advisors de segurança sem alerta novo (`reverse_commission_payout` sem
  exec para `anon`, confirmado nas 4 funções tocadas); `npx tsc -b --noEmit`
  limpo; vitest completo: 67 arquivos / 425 testes verdes (era 419 após o
  ticket 05).
