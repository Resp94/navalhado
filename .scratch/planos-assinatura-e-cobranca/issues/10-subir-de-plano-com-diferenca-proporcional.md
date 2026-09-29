# 10: Subir de plano com diferença proporcional

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** o Gerente sobe de plano e pode cadastrar mais profissionais na hora. Ele paga agora só a diferença proporcional aos dias que faltam no ciclo, e a partir da próxima cobrança paga o preço cheio do plano novo.

- **Assinatura ativa:**
  - A Edge Function de cobrança calcula no servidor a diferença: (preço novo − preço atual) × dias que faltam no período pago ÷ dias do período, arredondada em centavos.
  - A tela mostra a diferença e o novo valor mensal antes de confirmar.
  - O Gerente digita o cartão no componente de campos seguros.
  - A função cobra a diferença num pagamento avulso, com chave de idempotência e referência ao tenant e ao upgrade.
  - Só com o pagamento aprovado: troca o plano (o limite sobe na hora), atualiza o valor da assinatura para a próxima cobrança e grava a cobrança no histórico como "diferença de plano". Recusado, nada muda.
  - Se a diferença ficar abaixo do mínimo aceito pelo Mercado Pago, o plano troca sem cobrança avulsa.
- **Em teste:** a troca de plano é livre, sem cobrança, e atualiza o valor da assinatura no Mercado Pago se ela já existir.
- Não é permitido com pagamento recusado, bloqueada ou cancelada.
- **DEV:** a cobrança avulsa usa o token de teste do app Navalhado e a Public Key correspondente, com e-mail do pagador que não seja de conta de teste. Se não houver token separado configurado, usa o da assinatura (caso de prod).

**Blocked by:** 02 (Limite de profissionais no banco e cota na tela), 06 (Tela Assinatura e histórico de cobranças, 05b), 09 (Trocar cartão)

**Status:** ready-for-agent

- [ ] Teste Deno com o provedor falso:
  - a diferença proporcional é calculada certo, inclusive no primeiro e no último dia do período
  - com aprovação, troca plano e valor e grava no histórico
  - com recusa, não muda nada
  - abaixo do mínimo, troca sem cobrar
  - em teste, troca sem cobrar
  - recusa com pagamento recusado, bloqueada ou cancelada
  - recusa quem não é Gerente do tenant
- [ ] pgTAP: depois do upgrade, o limite novo vale na hora para cadastrar profissional
- [ ] Teste do front: mostra a diferença e o novo valor antes de confirmar; com recusa mostra a mensagem e mantém o plano
- [ ] Roteiro manual no DEV com cartão de teste: a diferença é cobrada na hora e a próxima cobrança sai com o valor novo
- [ ] `npm run lint`, `npm test` e `npm run build` passam
