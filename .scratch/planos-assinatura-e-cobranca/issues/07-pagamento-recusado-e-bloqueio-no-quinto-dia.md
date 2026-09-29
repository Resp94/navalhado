# 07: Pagamento recusado e bloqueio no 5º dia

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** quando o cartão é recusado, o Gerente vê uma faixa com a data do bloqueio e, se nada for aprovado até o 5º dia, a barbearia fica bloqueada. Estorno ou contestação bloqueia na hora.

- **Webhook:**
  - pagamento recusado da assinatura: a situação vira "pagamento recusado" e grava a data da primeira recusa, se ainda não houver
  - pagamento aprovado depois: volta para ativa e limpa a data da recusa
  - estorno ou contestação: bloqueada na hora
- **Faixa no painel:** "Pagamento recusado. Atualize o cartão até DD/MM para não ter o acesso bloqueado."
- **Rotina diária:** grava o bloqueio no 5º dia desde a primeira recusa, com a data do bloqueio.
- O `CONTEXT.md` ganha o termo Pagamento Recusado e Bloqueio por Assinatura (diferente de Bloqueio de Horário).

**Blocked by:** 05 (Assinar pelo Mercado Pago, 05a)

**Status:** ready-for-agent

- [ ] Teste Deno do webhook com o provedor falso: recusa grava a situação e a data só na primeira vez; aprovação depois volta para ativa; estorno e contestação bloqueiam
- [ ] pgTAP da rotina: bloqueia no 5º dia, não bloqueia no 4º, grava a data do bloqueio
- [ ] Teste do layout: faixa de recusa com a data do bloqueio
- [ ] `npm run lint`, `npm test` e `npm run build` passam
