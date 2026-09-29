# 11: Descer de plano agendado

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** o Gerente desce de plano. O plano menor vale a partir da próxima cobrança, sem reembolso, e só se os profissionais ativos couberem nele.

- A Edge Function de cobrança ganha a ação "descer de plano":
  - só para o Gerente do tenant
  - recusa quando os profissionais ativos passam do limite do plano menor, com a mensagem de quantos precisam ser desativados
  - grava o plano agendado e atualiza o valor da assinatura para a próxima cobrança
- Com uma descida agendada, o limite do plano menor já vale para novos cadastros e reativações de profissional. É o gatilho do ticket 02 considerando o plano agendado.
- O webhook aplica o plano agendado quando a próxima cobrança é aprovada.
- A tela Assinatura mostra "Muda para Tesoura em DD/MM" e permite desfazer o agendamento antes da data.
- Durante o teste, descer de plano troca na hora, sem cobrança, desde que os profissionais caibam.

**Blocked by:** 02 (Limite de profissionais no banco e cota na tela), 06 (Tela Assinatura e histórico de cobranças, 05b)

**Status:** ready-for-agent

- [ ] Teste Deno com o provedor falso: recusa acima do limite; agenda o plano e muda o valor; desfazer volta o valor; em teste troca na hora; recusa quem não é Gerente do tenant
- [ ] Teste Deno do webhook: cobrança aprovada aplica o plano agendado
- [ ] pgTAP: com descida agendada, o cadastro de profissional respeita o limite menor
- [ ] Teste do front: mostra o aviso de limite; mostra a mudança agendada com a data e o desfazer
- [ ] `npm run lint`, `npm test` e `npm run build` passam
