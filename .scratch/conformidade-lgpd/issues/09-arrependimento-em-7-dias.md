# 09: Arrependimento: reembolso da primeira cobrança em até 7 dias

Parte da spec 055 (Conformidade com os novos Termos e Política).

**What to build:** se o Gerente cancelar pela tela Assinatura em até 7 dias depois da primeira cobrança `approved` da barbearia:

- a tela mostra que o valor será devolvido;
- o Navalhado pede o reembolso dessa cobrança ao Mercado Pago;
- o acesso termina na hora (Estado de Acesso `blocked`, com motivo próprio).

Fora desse prazo, o cancelamento segue como hoje. Só a primeira cobrança da barbearia dá direito ao reembolso; quem assina de novo não ganha outro prazo.

A cláusula 11.2 da minuta dos Termos promete isso, e o cancelamento de hoje não reembolsa nada.

**Blocked by:** decisão do advogado sobre manter a cláusula (diagnóstico, seção 3, itens 2 e 3). Se ela cair, este ticket fecha como `wontfix`, e a cláusula 11.2 sai da minuta

**Status:** blocked (decisão do advogado)

- [ ] Conferir na documentação do Mercado Pago (MCP `search_documentation`) a API de reembolso de pagamento de assinatura e o que acontece com a recorrência
- [ ] Migration só no DEV: o motivo novo no Estado de Acesso; o registro do reembolso em `billing_charges` (o estorno já sai do faturamento)
- [ ] O webhook trata o aviso de reembolso sem bloquear duas vezes
- [ ] pgTAP: dentro do prazo, bloqueia com o motivo novo; fora dele, segue a regra de hoje; a segunda assinatura não tem direito
- [ ] Vitest da tela de cancelamento nos dois casos
- [ ] Roteiro manual no DEV com cartão de teste (ver a memória "Roteiro manual do MP no DEV"); o usuário digita os dados
- [ ] Gates de lint, Vitest e build passam
