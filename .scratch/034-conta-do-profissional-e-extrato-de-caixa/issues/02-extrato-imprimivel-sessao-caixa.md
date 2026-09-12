# 02: Extrato imprimível da Sessão de Caixa

**What to build:** o gestor abre uma Sessão de Caixa fechada no Hub Financeiro, aciona o extrato
e imprime a conferência do turno em papel — para assinar, anexar ao malote e conferir com o dono
no dia seguinte. Hoje a única saída é fotografar o monitor.

O extrato mostra o recebido discriminado por forma de pagamento, os suprimentos, as sangrias e os
repasses de comissão do turno, e a sobra ou quebra apurada no Fechamento de Caixa com
Conferência. A impressão sai em largura de bobina térmica, para usar a impressora que já está na
recepção.

O contrato de leitura do extrato do turno **já existe no banco, com privilégios corretos, e não é
consumido por nenhuma superfície**. Esta entrega é de interface: nenhuma alteração de schema,
nenhuma RPC nova. A linha de gorjetas do turno **não** faz parte deste ticket — ela é o ticket 05.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] O extrato é acionável a partir de uma Sessão de Caixa fechada na aba de Caixa Diário &
      Turnos.
- [ ] A impressão apresenta recebido por forma de pagamento, suprimentos, sangrias, repasses e a
      diferença apurada no fechamento.
- [ ] A folha de estilo de impressão produz saída legível em largura de bobina térmica, sem
      corte lateral de conteúdo.
- [ ] Uma sessão que passou por ajuste posterior imprime os valores ajustados, não os originais,
      e sinaliza que houve ajuste.
- [ ] Nenhuma migração é criada neste ticket.
- [ ] Cobertura pelo teste da página do Hub Financeiro; `npm run test` verde.
