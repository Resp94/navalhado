# 12: Cancelar assinatura

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** o Gerente cancela a assinatura pela tela. A cobrança para na hora, o acesso continua até o fim do período já pago e depois a barbearia fica bloqueada. Ele pode assinar de novo quando quiser.

- A Edge Function de cobrança ganha a ação "cancelar": só para o Gerente do tenant; cancela a assinatura no provedor na hora; grava a situação cancelada e a data do cancelamento.
- O Estado de Acesso mantém a barbearia liberada, com aviso, até o fim do período pago. A faixa diz "Assinatura cancelada. Acesso até DD/MM."
- A rotina diária grava o bloqueio no dia seguinte ao fim do período pago.
- O webhook trata a assinatura cancelada fora do Navalhado (pelo próprio Gerente no Mercado Pago) do mesmo jeito.
- Assinar de novo usa a ação "assinar" do ticket 05.
- A tela pede confirmação antes de cancelar e diz até quando o acesso continua.

**Blocked by:** 06 (Tela Assinatura e histórico de cobranças, 05b)

**Status:** ready-for-agent

- [ ] Teste Deno com o provedor falso: cancela no provedor e grava a situação e a data; recusa quem não é Gerente do tenant
- [ ] Teste Deno do webhook: assinatura cancelada no Mercado Pago vira cancelada
- [ ] pgTAP: liberada até o fim do período pago e bloqueada depois; a rotina grava o bloqueio
- [ ] Teste do front: confirmação com a data do fim do acesso; faixa de cancelada; "Assinar" volta a aparecer
- [ ] `npm run lint`, `npm test` e `npm run build` passam
