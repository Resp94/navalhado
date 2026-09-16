# 07: Pagamento de gorjeta na Quitação de Comissão

**What to build:** o repasse de gorjeta deixa de depender de pagamento por fora. O líquido
sugerido na Quitação de Comissão passa a somar os créditos de gorjeta — comissão mais gorjetas
menos vales — e a quitação liquida esses créditos junto, consumindo os mais antigos primeiro.
Estornar a quitação devolve os créditos ao estado aberto.

Como no ticket 06, o estorno pertence a este ticket: separá-los criaria uma janela em que estornar
uma quitação deixaria a gorjeta marcada como paga sem ter sido.

Este ticket **libera** o parâmetro de créditos que o ticket 06 já acrescentou à assinatura e
mantinha recusado — nenhuma alteração de assinatura nova, nenhum privilégio refeito.

**Blocked by:** 06 (abate de vale na quitação).

**Status:** ready-for-agent

- [ ] O parâmetro de créditos a pagar passa a ser aceito, consumido em ordem cronológica
      crescente do lançamento, expressando pagamento parcial naturalmente.
- [ ] O líquido sugerido devolvido pelo contrato de saldo passa a somar créditos de gorjeta em
      aberto, e continua igual ao líquido liquidado.
- [ ] Créditos pagos ficam vinculados à quitação pela mesma tabela de rateio do ticket 06.
- [ ] A ordem de lock estabelecida no ticket 06 é preservada.
- [ ] Estorno de quitação devolve os créditos de gorjeta pagos ao estado aberto.
- [ ] A gorjeta continua sem gerar comissão: nenhum percentual incide sobre ela e os snapshots de
      comissão permanecem intocados (ADR 018 e ADR 019).
- [ ] Casos adicionados ao arquivo pgTAP de quitação com Conta do Profissional criado no
      ticket 06.
- [ ] `npm run test` e `npm run test:db` verdes.
