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

**Status:** done

- [x] Teste Deno do webhook com o provedor falso: recusa grava a situação e a data só na primeira vez; aprovação depois volta para ativa; estorno e contestação bloqueiam
- [x] pgTAP da rotina: bloqueia no 5º dia, não bloqueia no 4º, grava a data do bloqueio
- [x] Teste do layout: faixa de recusa com a data do bloqueio
- [x] `npm run lint`, `npm test` e `npm run build` passam

## Resultado (2026-09-30)

Implementado, testado e conferido no DEV.

- **Banco** (migrations `052_ticket07_pagamento_recusado_e_estorno`, `20260930003144`, e `052_ticket07_estorno_antigo_e_primeira_cobranca`, `20260930111943`, da revisão de código, ambas aplicadas no DEV). `apply_subscription_payment` agora traduz recusa, estorno e contestação, além da aprovação. Mensalidade recusada: ativa (ou em teste, no caso da primeira cobrança) vira `past_due` e grava `first_failed_at` uma vez só, com a data do pagamento; a retentativa recusada não muda a data; um aprovado depois reativa e limpa a data (já era assim). Recusa em bloqueada, cancelada ou cortesia, recusa de upgrade e recusa de antes do início do período pago atual só entram no histórico. Estorno ou contestação: bloqueada na hora, com `blocked_reason` `refunded` ou `charged_back` (o check da coluna ganhou os dois valores) e `blocked_at` de agora; cortesia não é bloqueada; aviso repetido do mesmo tipo é `duplicate`. Da revisão de código: o estorno (não a contestação) de um pagamento de mais de 3 dias antes do início do período pago atual, numa assinatura ativa, só entra no histórico; em teste, a recusa só vira "pagamento recusado" com o cartão já autorizado (bandeira gravada) e a cobrança até 1 dia antes do fim do teste, então a cobrança imediata recusada depois do teste vencido (antes da rotina das 03:05) não ganha os 5 dias. O Estado de Acesso e a rotina diária do ticket 03 não mudaram: o quinto dia (liberado com aviso até lá, bloqueio gravado no quinto dia, com a data) já estava coberto no pgTAP 65 e é percorrido de ponta a ponta no 68.
- **Webhook.** Sem mudança de código: ele já repassava o status que o Mercado Pago devolveu. Ganhou 4 testes Deno com o provedor falso (recusa datada pela criação do pagamento, estorno e contestação com a data da aprovação, recusa de upgrade). `mercadopago-webhook` não precisa de novo deploy; só a migration.
- **Front.** A faixa do painel do Gerente diz "Pagamento recusado. Atualize o cartão até DD/MM para não ter o acesso bloqueado.", com a data do bloqueio no fuso da barbearia (`FaixaDeAviso` recebe `timezone`, `GerenteLayout` passa o da barbearia). A tela de bloqueio ganhou os motivos `refunded` e `charged_back` (título e explicação).
- **Testes.** pgTAP 68 (novo, 42/42) e 67 (55/55, duas asserções ajustadas ao comportamento novo); Deno `billing` + `mercadopago-webhook` + `_shared` 58/58; Vitest das mensagens, da faixa e do layout (incluindo o fuso).
- **DEV.** Com a "Barbearia MP Teste", a recusa simulada pela função do banco deixou a barbearia `past_due` (data da recusa gravada), o painel abriu com a faixa "…até 04/10…" (o bloqueio caiu em 05/10 00:36 UTC, 04/10 no fuso de Brasília) e a contestação simulada levou à tela de bloqueio com o título "Um pagamento da assinatura foi contestado". A barbearia voltou ao estado anterior (ativa) e a cobrança simulada foi apagada.

### Limites conhecidos
- Não reproduzi uma recusa real do Mercado Pago no sandbox: a recusa, o estorno e a contestação foram simulados chamando a função do banco com o mesmo formato que o webhook manda (`status`, `date_created`, `date_approved` do recurso `payment`). Não sei se o Mercado Pago avisa cada retentativa recusada como `payment`; vale olhar o primeiro caso real.
- **Só publicar em prod com os tickets 09 e 12 (ou depois deles).** Quem está recusado ou bloqueado por estorno/contestação ainda não consegue resolver sozinho: o "Pagar" recebe a recusa 409 enquanto a assinatura anterior estiver `authorized` no Mercado Pago (ticket 05), e trocar o cartão é o ticket 09; cancelar a assinatura antiga é o ticket 12. Até lá o Proprietário resolve à mão. O estorno ou a contestação também não cancelam a assinatura no Mercado Pago, que segue cobrando no mês seguinte.
- A contestação de qualquer pagamento (mesmo antigo, mesmo de upgrade) bloqueia, e o estorno também, menos o de pagamento antigo numa assinatura ativa; o ticket 10 (upgrade) pode querer tratar o estorno da diferença de plano de outro jeito.
- Em teste com cartão autorizado, a folga de 1 dia antes do fim do teste para a primeira cobrança vem de `record_subscription_authorization`, que estende o teste até a cobrança que o Mercado Pago calculou mais 1 hora. Se o Mercado Pago cobrar mais de 1 dia antes disso, a recusa só entra no histórico.
- O e-mail do dia da recusa é o ticket 08.

