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

**Status:** done

- [x] Teste Deno com o provedor falso:
  - a diferença proporcional é calculada certo, inclusive no primeiro e no último dia do período
  - com aprovação, troca plano e valor e grava no histórico
  - com recusa, não muda nada
  - abaixo do mínimo, troca sem cobrar
  - em teste, troca sem cobrar
  - recusa com pagamento recusado, bloqueada ou cancelada
  - recusa quem não é Gerente do tenant
- [x] pgTAP: depois do upgrade, o limite novo vale na hora para cadastrar profissional
- [x] Teste do front: mostra a diferença e o novo valor antes de confirmar; com recusa mostra a mensagem e mantém o plano
- [x] Roteiro manual no DEV com cartão de teste: a diferença é cobrada na hora e a próxima cobrança sai com o valor novo
- [x] `npm run lint`, `npm test` e `npm run build` passam

## Resultado (2026-09-30)

Implementado, testado, revisado e conferido no DEV com o Mercado Pago de verdade (roteiro abaixo). O Gerente sobe de plano pela tela Assinatura: vê a diferença proporcional e o valor mensal novo, paga a diferença no cartão digitado nos campos seguros, e o plano e o limite de profissionais trocam na hora.

- **Banco** (2 migrations, aplicadas no DEV). `052_ticket10_subir_de_plano` (`20260930163905`): `get_plan_change_context(p_tenant_id, p_plan_id)` devolve situação, plano atual e de destino, preços, limite, período pago e profissionais ativos; `apply_plan_change(...)` troca o plano de forma atômica (trava o tenant e a assinatura, limpa a descida agendada, grava a cobrança `upgrade` no histórico e não mexe no cartão da assinatura) e responde `changed` ou `duplicate`. Erros: `55000` (a assinatura não troca de plano agora), `22023` (plano inexistente, formato do cartão, mesmo plano, plano que não é mais alto), `53400` (os profissionais ativos não cabem no plano de destino). As duas funções são só do `service_role`. `052_ticket10_upgrade_aprovado_depois_e_estorno` (`20260930175349`, da revisão): `billing_charges.plan_applied_at` marca a cobrança de upgrade que já trocou o plano (`apply_plan_change` não aplica duas vezes a mesma), `get_plan_change_context` passa a contar as tentativas de upgrade não aprovadas do período (`failed_upgrade_attempts`), e o estorno de uma cobrança de upgrade só entra no histórico, sem bloquear a barbearia.
- **Provedor de pagamento.** `changeAmount` (`PUT /preapproval/{id}` só com o valor) e `chargeOnce` (`POST /v1/payments`, 1 parcela, `external_reference` do tenant, `metadata.kind = upgrade` e `plan_id`) de verdade no Mercado Pago e na versão falsa; `ProviderPayment` ganha `statusDetail` e `planId`. `notImplementedOperations` fica só com `cancelSubscription` (ticket 12). `changeAmount` tenta até três vezes (Decisões).
- **Função `billing`** (v20 no DEV, `verify_jwt` ligado). `cotar_troca_de_plano` mostra a diferença sem cobrar; `trocar_plano` refaz a conta no servidor, confere o valor que o Gerente viu (`expectedAmount`, senão 409), cobra no cartão do token e só com o pagamento aprovado chama `apply_plan_change` e depois `changeAmount`. `chave_publica` aceita `uso: "cobranca"` (a Public Key do app que faz a cobrança avulsa). A cobrança avulsa usa `MP_CHARGE_ACCESS_TOKEN`, `MP_CHARGE_PUBLIC_KEY` e `MP_CHARGE_PAYER_EMAIL` quando existem e, sem eles, os de sempre (caso de prod).
- **Webhook** (`mercadopago-webhook`, v15 no DEV). Toda cobrança de upgrade aprovada com `metadata.plan_id` chama `apply_plan_change` e, se o plano trocou, `changeAmount`: cobre o pagamento em análise que o Mercado Pago aprova depois, a falha do banco depois da cobrança e o timeout.
- **Front.** `MudarDePlano` (botão, planos com `aria-pressed`, resumo "Você paga agora R$ X…", `FormularioDeCartao` com "Pagar R$ X"; em teste ou abaixo do mínimo, "Trocar para {plano}"); `useTrocarDePlano` (descarta cotação velha); `cartaoDaCobrancaRepository` pede a chave com `uso: "cobranca"`; `SecaoAssinatura` o mostra para assinatura ativa ou em teste; `DetalhesDaAssinatura.plano` traz o id.
- **Testes.** Deno 234/234 (`billing` 163, webhook 45, `_shared` 26; `deno check` limpo); pgTAP 71 (38/38) e 72 (15/15) no DEV; Vitest completo 1777/1777 em 140 arquivos; `tsc -b` limpo; oxlint sem erro (os avisos que restam são de arquivos que o ticket não tocou); `npm run build` passa.

### Decisões
- **A diferença é calculada no servidor** e a tela só a mostra: (preço novo − preço atual) × dias que faltam ÷ dias do período, com os dias que faltam contados para cima e limitados ao período, em centavos. No primeiro dia inteiro paga a diferença inteira; no último, um dia; depois do fim, nada.
- **Na assinatura ativa só se sobe.** Em teste a troca é livre, nos dois sentidos, sem cobrança, se os profissionais ativos couberem. Pagamento recusado, bloqueada, cancelada e cortesia recebem 409 com o motivo.
- **Cobra no cartão digitado, não no salvo.** O cartão salvo na assinatura não serve para outra cobrança do vendedor, e só o token passa pelo Navalhado.
- **O plano só troca com o pagamento aprovado**, e a troca é uma transação do banco. Recusado ou em análise: nada muda, a tentativa entra no histórico e a mensagem diz o motivo (saldo, código de segurança, validade, banco).
- **Mínimo da cobrança avulsa: R$ 1,00.** A documentação do Mercado Pago não traz o piso do pagamento avulso; abaixo de R$ 1,00 o plano troca sem cobrar. É um palpite conservador: um piso abaixo do real faria a cobrança falhar justo quando o Gerente quer subir.
- **A chave de idempotência é da tentativa, não do cartão.** Leva o tenant, o plano, o fim do período pago e o número de tentativas de upgrade não aprovadas já gravadas: o reenvio depois de um timeout repete a chave e o Mercado Pago devolve o pagamento que já fez; uma tentativa recusada ou em análise gravada muda a chave da seguinte. Com o token do cartão na chave (uso único), o Gerente que digita de novo depois de um timeout seria cobrado duas vezes.
- **O webhook é a rede de segurança.** Aplicar o upgrade aprovado é idempotente no banco; o webhook o completa quando a resposta da função não chegou a aplicá-lo. Recusa por regra de negócio vira aviso processado; falha de infraestrutura responde 500 e o Mercado Pago reenvia.
- **Estorno de upgrade só entra no histórico.** O plano fica como está (reverter é decisão do Proprietário); a contestação continua bloqueando.
- **`changeAmount` tenta até três vezes** (pausas de 1 s e 3 s) em 429, erro 5xx e falha de rede; recusa do pedido sobe na hora. O pedido só repete o valor, então repeti-lo é seguro.
- **Credenciais do DEV.** A API de pagamentos avulsos (`/v1/payments`) só aceita no DEV o par `TEST-` de um app de Checkout API, com e-mail de pagador que não seja de conta de teste. Por isso três secrets opcionais (`MP_CHARGE_*`) e um app só para isso, "Navalhado Teste Cobranca" (`7294549166684322`, Checkout API, Payments API). Em prod os três ficam em branco e a credencial do app de produção serve para tudo.

### Da revisão de código
Nove achados. Aplicados (os três primeiros, por decisão do usuário):
- **Upgrade aprovado depois da resposta ficava sem aplicar** (em análise aprovado mais tarde, falha do banco depois da cobrança, timeout). Migration `20260930175349` e o webhook acima.
- **O estorno de uma cobrança de upgrade bloqueava a barbearia** que paga em dia. Agora só entra no histórico.
- **A chave de idempotência levava o token do cartão** (de uso único): depois de um timeout, o reenvio com outro token cobrava a diferença outra vez. Agora é da tentativa.

Mantidos como estão, por decisão do usuário (viram Limitações):
- **4. `MINIMUM_CHARGE` de R$ 1,00 é palpite**, sem base na documentação.
- **5. Secrets `MP_CHARGE_*` pela metade** (por exemplo só o token): o erro do cartão que o Gerente vê engana, e o motivo está só no log.
- **6. Falha do `changeAmount` só vai para o log.** Aconteceu de verdade no roteiro (429) e levou ao retry acima; sem reconciliação automática (Limitações).
- **7. `PUT` do valor numa assinatura ainda pendente no Mercado Pago** (em teste, antes de autorizar) não foi verificado.
- **8. "Mudar de plano" some sem aviso** quando a lista de planos falha ao carregar.
- **9. A lista de planos é buscada** mesmo com o painel fechado.

### Roteiro no DEV (2026-09-30)
Front local (`npm run dev`, porta 5173, a única origem que o `billing` libera no CORS além das de produção) contra o Supabase DEV, logado como o Gerente da "Barbearia MP Teste" (ativa, plano Tesoura, período de 29/09 a 29/10, Visa final 5682). O usuário entrou e digitou o CPF; o resto foi feito no navegador embutido.
- **Credencial errada, duas vezes: `401 Unauthorized use of live credentials`.** Com os secrets `MP_CHARGE_*` do app "Navalhado SaaS" (credenciais `APP_USR-`, as de teste do painel), o Mercado Pago tratou a cobrança como credencial real. A função respondeu o texto neutro (502), nada foi cobrado e o plano não mudou. A descrição da ferramenta do Mercado Pago explica: o prefixo do par de teste depende do produto do app (`TEST-` para Checkout API e Payments API; `APP_USR-` para Checkout Pro e Orders). Criei o app "Navalhado Teste Cobranca" (Checkout API, Payments API) e o usuário regravou os dois secrets com o par `TEST-` dele; a chave pública de cobrança passou a `TEST-…`.
- **Aprovado, Tesoura → Máquina, R$ 30,00** (Mastercard `5031 7557 3453 0604`, nome `APRO`). A tela cotou "R$ 30,00 … (30 de 30 dias)" e mostrou "Plano trocado para Máquina. Cobramos R$ 30,00 da diferença… O valor mensal passa a ser R$ 89,90." No banco: plano Máquina (limite 5), período e cartão da assinatura (Visa 5682) iguais, cobrança `upgrade` `approved` de R$ 30,00 (Mastercard 0604) com `plan_applied_at` preenchido, e "Diferença de plano · Paga" no histórico da tela. Sem erro no log.
- **Recusado, Máquina → Bancada, R$ 70,00** (Visa `4235 6477 2802 5682`, nome `FUND`): "O cartão não tem saldo suficiente. O plano continua o mesmo."; cobrança `rejected` no histórico; plano intacto.
- **Em análise** (nome `CONT`): "O Mercado Pago ainda está analisando o pagamento. O plano só troca quando ele for aprovado…"; cobrança `in_process` no histórico; plano intacto.
- **Aprovado depois de duas tentativas não aprovadas** (nome `APRO`): o plano trocou para Bancada (limite 10) e a cobrança foi nova, não a repetição da anterior (a chave mudou com as tentativas gravadas). O histórico mostrou as quatro cobranças de diferença e a mensalidade.
- **`429 local_rate_limited` no `changeAmount` da segunda subida**, cerca de 3 minutos depois da primeira: o plano trocou, a tela avisou "Não conseguimos atualizar o valor da próxima cobrança no Mercado Pago agora…" e a assinatura no Mercado Pago ficou em R$ 89,90 com o plano em Bancada. Foi o que levou ao retry (commit `48f12ea`), publicado depois. **Não reproduzi o 429 com o retry no DEV**: Bancada é o plano mais alto e não há nova subida a fazer; o retry é coberto pelos testes com `fetch` falso (429, 5xx, rede, recusa sem retry). Se a janela do limite do Mercado Pago for maior que uns 4 segundos, o retry não basta (Limitações).
- **Não exercitado no DEV:** o webhook completando um upgrade (o app de teste de cobrança não tem webhook configurado; coberto por 12 testes do webhook e pelo pgTAP 72), a diferença abaixo do mínimo e a troca livre em teste (a barbearia do roteiro está ativa; cobertos por testes do `billing`, do front e pgTAP 71).
- **Estado em que o DEV ficou:** a "Barbearia MP Teste" está no plano Bancada, e o valor da assinatura no Mercado Pago segue R$ 89,90 (sandbox, sem efeito real).

### Limitações
- **Falha do `changeAmount` depois das tentativas não tem reparo automático.** O plano já trocou e a assinatura fica com o valor antigo no Mercado Pago (próxima mensalidade abaixo do devido) até alguém corrigi-lo; a tela avisa e o log diz o motivo. O caminho é uma reconciliação durável ("valor pendente" na assinatura, corrigido na próxima ação ou numa rotina), a pensar junto do descer de plano (ticket 11), que reusa o mesmo `changeAmount`.
- **Pagamento em análise e nova tentativa com outro cartão** pode cobrar duas vezes, se a primeira cobrança for aprovada depois. A mensagem já diz para falar com o suporte se a cobrança aparecer sem o plano mudar.
- **A tentativa recusada ou em análise só aparece no histórico da tela** depois de recarregar a página ou de uma troca bem-sucedida (o histórico já está no banco).
- **O mínimo de R$ 1,00 é um palpite**; se o real for menor, no último dia do período o plano troca sem cobrar mais do que precisaria.
- **Secrets `MP_CHARGE_*` pela metade** dão um erro de cartão enganoso na tela (achado 5).

### Para publicar em prod
Migrations `052_ticket10_subir_de_plano` e `052_ticket10_upgrade_aprovado_depois_e_estorno`, nessa ordem; funções `billing` e `mercadopago-webhook` republicadas juntas (elas dividem `_shared/payment_provider.ts`, `_shared/mercadopago_provider.ts`, com o retry, e `_shared/card_format.ts`, arquivo novo), com `verify_jwt` ligado na `billing` e desligado no webhook; front no mesmo deploy do Cloudflare Pages. Os secrets `MP_CHARGE_*` ficam **sem valor** em prod: a credencial do app de produção (`MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`) serve para a assinatura e para a cobrança avulsa. Conferir na primeira subida de plano em prod que a credencial de produção aceita `POST /v1/payments` (no DEV isso só passou com o par `TEST-` de um app de Checkout API). Publicar junto com os tickets 07, 08, 09 e 12.
