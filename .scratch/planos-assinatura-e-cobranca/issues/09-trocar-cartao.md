# 09: Trocar cartão

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** o Gerente troca o cartão da assinatura pela tela Assinatura, digitando o cartão nos campos seguros do Mercado Pago. A próxima cobrança sai no cartão novo.

- Componente de cartão com os campos seguros do Mercado Pago, carregado com a Public Key. Ele gera o token do cartão no navegador e entrega só o token. O número do cartão nunca passa pelo Navalhado. O componente é reaproveitado no ticket 10.
- A Edge Function de cobrança ganha a ação "trocar cartão": só para o Gerente do tenant; atualiza o cartão da assinatura no provedor, sem cobrança imediata; grava a bandeira e o final do cartão novo.
- Com a assinatura em "pagamento recusado", a cobrança pendente passa a ser tentada no cartão novo.
- A tela Assinatura mostra o final do cartão novo depois da troca.

**Blocked by:** 06 (Tela Assinatura e histórico de cobranças, 05b)

**Status:** ready-for-agent

- [ ] Teste Deno com o provedor falso: a ação manda só o token; grava bandeira e final; recusa quem não é Gerente do tenant
- [ ] Teste do front: o fluxo de troca gera o token pelo componente (falso no teste) e chama a ação; a tela mostra o final novo
- [ ] Roteiro manual no DEV com cartão de teste: trocar o cartão não cobra nada; a próxima cobrança sai no cartão novo
- [ ] `npm run lint`, `npm test` e `npm run build` passam
