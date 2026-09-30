# 08: Avisos por e-mail

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** o Gerente é avisado por e-mail, e não só pela faixa do painel, antes de perder o acesso.

- E-mails pelo Resend, no mesmo padrão dos e-mails de autenticação com React Email:
  - 3 dias antes do fim do teste
  - dia da recusa do pagamento
  - 3º dia da recusa
  - 4º dia da recusa: "amanhã o acesso será bloqueado"
  - bloqueio efetivado, com o motivo e o caminho para voltar
- A rotina diária dispara os e-mails de prazo. O webhook dispara o e-mail do dia da recusa.
- Cada e-mail enviado fica registrado por tenant e tipo, para não repetir no mesmo dia.
- Os e-mails vão para o e-mail do Gerente do tenant. No DEV, seguem a regra atual dos e-mails do ambiente.

**Blocked by:** 07 (Pagamento recusado e bloqueio no 5º dia)

**Status:** done

- [x] Teste dos templates (render): cada e-mail tem o texto, as datas e o link certos
- [x] pgTAP ou teste Deno: a rotina escolhe quem recebe cada aviso no dia certo e não repete no mesmo dia
- [x] Conferido no DEV: um tenant de teste recebe o e-mail de fim de teste e o do dia da recusa
- [x] `npm run lint`, `npm test` e `npm run build` passam

## Resultado (2026-09-30)

Implementado, testado e conferido no DEV com envio real pelo Resend.

- **Banco** (migrations `052_ticket08_avisos_por_email`, `20260930114413`, e `052_ticket08_fuso_invalido_e_bloqueio_manual`, `20260930123242`, da revisão de código, ambas aplicadas no DEV). `billing_notices` (fila e registro, chave única por tenant, tipo e evento); `private.enqueue_billing_notices` (rotina diária: fim do teste, 3º e 4º dia da recusa, bloqueio dos últimos 3 dias, no dia local da barbearia); `claim_billing_notices`, `finish_billing_notice` e `verify_billing_notices_secret` (só do `service_role`); `apply_subscription_payment` grava o aviso do dia da recusa e o do bloqueio por estorno ou contestação. Dois cron jobs: `enqueue-billing-notices` (12:00 UTC) e `send-billing-notices` (a cada 5 minutos, só se há pendente). O segredo do cron (`billing_notices_secret`) é criado pela própria migration no Vault, então não há secret novo para cadastrar no painel.
- **Função `send-billing-email`** (nova, `verify_jwt` desligado; o cron prova quem é com o segredo do Vault). Templates React Email em `emails/avisos.tsx`, com o mesmo layout dos e-mails de autenticação, que agora mora em `supabase/functions/_shared/emails/layout.tsx` e é importado pelas duas funções (a `send-auth-email` foi republicada no DEV, v7, sem mudar comportamento). Usa os secrets que já existem: `RESEND_API_KEY`, `AUTH_EMAIL_FROM` (ou `BILLING_EMAIL_FROM`, se um dia existir) e `APP_URL`. Uma mensagem por destinatário, com chave de idempotência por destinatário; falha passageira (429, 5xx, sem rede) volta para a fila; recusa definitiva falha o aviso. Script de preview: `npm run email:avisos`.
- **Testes.** pgTAP 69 (novo, 52/52); pgTAP 67 (55/55) e 68 (42/42) reexecutados depois da mudança em `apply_subscription_payment`; Deno da função nova 34/34 (18 dos templates, 16 do handler; mutação: sem a conferência do segredo, um teste falha) e da `send-auth-email` 11/11 depois de mover o layout. As suítes Vitest não mudaram.
- **DEV, envio real.** Barbearia "Barbearia Aviso Teste 08", Gerente `resplandesjonathas+navalhado08@gmail.com` (o Gmail sem alias já é a conta do Proprietário no DEV, e `public.users.email` é único; o alias cai na mesma caixa). A rotina diária enfileirou o aviso de fim de teste e o envio saiu (`claimed 1, sent 1`); em seguida a recusa simulada pelo mesmo caminho do webhook gravou o aviso do dia da recusa e o segundo e-mail saiu. O Resend marcou os dois como entregues (`delivered`; assuntos "Seu período de teste do Navalhado termina em 3 dias" e "O pagamento da sua assinatura do Navalhado foi recusado"; o segundo com "até 05/10", plano Máquina, R$ 89,90 e o link `https://dev.navalhado.com.br/configuracoes`). A barbearia, o Gerente e a cobrança de teste foram apagados depois.

### Da revisão de código
- **Fuso inválido:** `tenants.timezone` é texto livre; `private.valid_timezone` devolve Brasília para valor inválido, vazio ou nulo, e a fila diária e o `claim` passam por ela (um fuso ruim não derruba mais a fila de todos).
- **Layout em `_shared`:** o layout saiu da pasta da `send-auth-email` para `_shared/emails/layout.tsx`. A `send-auth-email` foi republicada no DEV (v7): sobe e chega até a checagem da assinatura (400 "Assinatura inválida" sem assinatura), e os 11 testes dela passam; o render dela no runtime real não foi exercitado (o hook exige a assinatura do Supabase), o do layout foi, pela `send-billing-email` v2 (`delivered@resend.dev`, sem escrever para caixa nenhuma).
- **Data ausente:** a frase do e-mail continua inteira (sem "até DD/MM") se a data do bloqueio ou do fim do teste não vier.
- **Bloqueio manual:** não manda e-mail (ver Decisões).
- **Falhas visíveis:** aviso que falha de vez sai como `console.error` e o que volta para a fila como `console.warn` nos logs da função; a lista de avisos `failed` para o Proprietário foi registrada no ticket 15.

### Decisões
- **O registro é por evento, não por dia.** "Não repetir no mesmo dia" vira "uma vez por evento": o fim do teste, a primeira recusa e o bloqueio têm cada um o seu aviso. Rodar a rotina duas vezes no mesmo dia (ou no dia seguinte) não repete nada, e uma recusa nova depois de pagar recebe outro aviso.
- **Destinatários: todos os Gerentes ativos** do tenant, cada um numa mensagem só sua.
- **Fila com cron, não envio direto no webhook.** O webhook e a rotina só gravam; a função envia em até 5 minutos, com nova tentativa se o Resend falhar e sem o risco de o webhook demorar ou falhar por causa do e-mail.
- **Fim do teste com a assinatura já autorizada** (bandeira gravada) diz quando a primeira cobrança sai e não pede para assinar; sem cartão, convida a assinar.
- **Só avisa o bloqueio de quem foi bloqueado nos últimos 3 dias**, para a primeira rodada em prod não escrever para barbearias bloqueadas há semanas. O bloqueio manual do Proprietário (sem motivo) não manda e-mail: é decisão dele, por outro motivo, e um "seu acesso foi bloqueado" sem contexto só confunde.
- O botão dos avisos de recusa diz "Atualizar cartão" e leva a Configurações, onde o Gerente ainda não tem como trocar o cartão (ticket 09): mesma condição de publicação do ticket 07.

### Para publicar em prod
Migration `052_ticket08_avisos_por_email` (cria o segredo do cron no Vault e os dois cron jobs; exige o Vault `project_url`, que os cron jobs de WhatsApp já usam), depois as funções `send-billing-email` (sem verificação de JWT) e `send-auth-email` (republicar: o layout mudou de lugar; incluir `_shared/emails/layout.tsx` nas duas e publicar a `send-auth-email` com `send-auth-email/index.tsx` como entrypoint e `send-auth-email/deno.json` como import map, como no DEV v7), com `RESEND_API_KEY`, `AUTH_EMAIL_FROM` e `APP_URL` de prod. Publicar junto com os tickets 07, 09 e 12.

