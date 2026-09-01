# 06 — Validação integrada e não regressão

**What to build:** A funcionalidade completa é validada no ambiente de desenvolvimento em desktop e mobile, com persistência confirmada e garantia de que as rotinas atuais do caixa continuam operando.

**Blocked by:** 01 — MVP de faturamento diário no Caixa; 02 — Resumo diário no mobile; 03 — Detalhamento de sessões que atravessam dias; 04 — Métodos de pagamento e comandas sem duplicidade; 05 — Segurança, performance e migration versionada

**Status:** ready-for-agent

- [ ] Executar a suíte automatizada dos módulos de caixa, financeiro e mobile.
- [ ] Validar um dia com comanda fechada e pagamento integral.
- [ ] Validar sessão atravessando dois dias, incluindo dia sem movimento.
- [ ] Validar pagamento dividido e fechamento separado da data de pagamento.
- [ ] Validar os fusos `America/Manaus` e `America/Sao_Paulo`.
- [ ] Validar consulta sem resultados, carregamento e falha de rede ou RPC.
- [ ] Validar atualização após finalização de comanda e novo pagamento.
- [ ] Validar que gaveta, suprimento, sangria, abertura, fechamento e comissões não regrediram.
- [ ] Validar visualmente desktop e mobile no ambiente de desenvolvimento.
- [ ] Registrar evidências da persistência e dos resultados observados.
- [ ] Somente após tudo aprovado, preparar eventual promoção para produção.
