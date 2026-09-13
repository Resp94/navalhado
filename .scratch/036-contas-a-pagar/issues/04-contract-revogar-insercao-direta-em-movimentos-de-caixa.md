# 04: Contract — revogar a inserção direta em movimentos de caixa

**What to build:** o proprietário passa a ter garantia de que toda movimentação de caixa registra
como autor quem realmente a fez, sem que o navegador possa informar outro autor. Depois do ticket
03, a RPC já faz o certo, mas a porta antiga continua aberta: a política atual deixa o gestor
inserir movimento de **qualquer tipo** direto na tabela, com autor livre, vínculos de quitação,
profissional e estorno forjáveis, e sem trava de saldo.

Este ticket fecha essa porta. Restringir a política a suprimento e sangria não bastaria: autor e
vínculos continuariam forjáveis, cada coluna futura reabriria a brecha, e a política não consegue
validar saldo sem replicar a fórmula e travar a sessão.

**Expand-contract.** É a segunda migração da Entrega 1. A revogação quebra qualquer navegador com a
versão anterior do adaptador de caixa, por isso **só pode ser aplicada depois que o frontend do
ticket 03 estiver publicado em produção**.

Spec: `specs/036-contas-a-pagar/spec.md`, seção "Entrega 1 — Apuração única do valor esperado da
gaveta" (brecha de inserção direta; expand e contract).

**Blocked by:** 03 — Sangria e suprimento por RPC com trava de saldo (com o frontend já publicado
em produção).

**Status:** ready-for-agent

- [ ] Pré-condição verificada antes de aplicar a migração: o frontend do ticket 03 está em
      produção e nenhum chamador vivo insere direto em movimentos de caixa.
- [ ] A política de inserção em movimentos de caixa é removida.
- [ ] A permissão de inserção direta é revogada do papel autenticado.
- [ ] A permissão residual do papel anônimo na tabela é revogada (hoje neutralizada só pela
      ausência de política).
- [ ] Nenhuma outra tabela financeira tem permissões alteradas neste ticket.
- [ ] A suíte pgTAP `03_restringir_operacoes_financeiras_estoque` passa a afirmar que o papel
      autenticado não tem permissão de inserção em movimentos de caixa.
- [ ] A suíte pgTAP `17_code_review_regressions` troca a asserção sobre o texto da política pela
      recusa, na RPC, de movimento em sessão fechada.
- [ ] A suíte pgTAP `18_code_review_behavioral_regressions` mantém a recusa de inserção direta em
      caixa fechado, agora por falta de permissão.
- [ ] Um gestor autenticado não consegue gravar movimento de caixa com autor diferente de si mesmo
      por nenhum caminho exposto (história 4).
- [ ] `npm run test:db` verde.
