# 05: Linha de gorjetas no extrato do turno

**What to build:** o gestor, ao imprimir o extrato da Sessão de Caixa, passa a ver quanto da
gaveta não é da casa. A linha de gorjetas do turno aparece separando o que foi atribuído a um
profissional do que ficou sem atribuição — este último existindo por causa das Comandas fechadas
antes do ticket 04, que deliberadamente não recebem backfill.

É a **única alteração de contrato de leitura do caixa** em toda a spec 034. O ticket existe
separado justamente por isso: contrato de leitura merece ticket próprio, ainda que a mudança seja
pequena.

**Blocked by:** 02 (extrato imprimível), 04 (gorjeta como crédito).

**Status:** ready-for-agent

- [ ] O contrato de leitura do extrato do turno devolve a gorjeta do período, discriminando
      atribuída e não atribuída.
- [ ] A visão imprimível apresenta a linha, e o valor não é confundido com forma de pagamento —
      gorjeta não é forma de pagamento, e a identidade entre recebido total e a soma por forma de
      pagamento permanece intacta.
- [ ] Caso coberto **dentro do arquivo pgTAP existente do extrato de sessão de caixa**, não em
      arquivo novo.
- [ ] `npm run test` e `npm run test:db` verdes.
