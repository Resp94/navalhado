# 05: Assinar pelo Mercado Pago (05a)

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** o Gerente clica em "Assinar" (ou em "Pagar", na tela de bloqueio), paga na página do Mercado Pago, e a barbearia vira assinatura ativa quando o pagamento é aprovado.

- **Provedor trocável:** o acesso ao Mercado Pago fica atrás de uma interface, no mesmo padrão do provedor de WhatsApp. Ela cobre criar assinatura, trocar cartão, mudar valor, cancelar, cobrar avulso, buscar pagamento e buscar assinatura. Há uma versão real e uma falsa para os testes. Nesta fatia, só criar assinatura, buscar pagamento e buscar assinatura precisam existir de verdade.
- **Edge Function de cobrança**, ação "assinar":
  - só para o Gerente do próprio tenant; recusa Gerente sem tenant
  - cria a assinatura pendente com o e-mail do Gerente, o valor do plano, ciclo mensal e referência externa igual ao id do tenant
  - em teste, o início é o fim do teste; bloqueado, o início é imediato
  - grava o id da assinatura e devolve o link de pagamento do Mercado Pago
  - se já existe assinatura cancelada, a nova é criada e a antiga fica como está
- **Edge Function do webhook**, pública:
  - confere a assinatura secreta do aviso, com o segredo em secret do Supabase
  - grava cada aviso numa tabela de eventos com chave única e ignora aviso repetido
  - busca o recurso no Mercado Pago e decide pelo que ele responde, nunca pelo corpo do aviso
  - responde rápido
  - pagamento aprovado da assinatura: a situação vira ativa e o período pago é preenchido ou avançado
- **Histórico de cobranças:** cada pagamento vira uma linha com valor, data, situação, tipo e final do cartão. A tela que mostra o histórico é o ticket 06.
- **Tela:** um botão "Assinar" numa seção Assinatura mínima em Configurações, e o "Pagar" da tela de bloqueio, os dois abrindo o link do Mercado Pago.
- **Credenciais:**
  - DEV: o token de produção da conta de teste vendedora e a Public Key correspondente
  - o webhook configurado no app da conta de teste vendedora, apontando para o DEV
  - tudo em secret do Supabase; nada de token no front
- O `CONTEXT.md` ganha o termo Assinatura no Mercado Pago, se ainda não houver termo equivalente.

**Blocked by:** 03 (Período de teste, Estado de Acesso e bloqueio do painel)

**Status:** done

- [x] Teste Deno da ação "assinar" com o provedor falso: em teste manda o início no fim do teste; bloqueado manda início imediato; grava o id da assinatura; recusa Barbeiro, anônimo e Gerente sem tenant
- [x] Teste Deno do webhook com o provedor falso: recusa assinatura secreta inválida; ignora aviso repetido; busca o recurso no provedor; pagamento aprovado vira ativa com período pago e linha no histórico
- [x] pgTAP: histórico de cobranças e tabela de eventos legíveis só pelo próprio tenant (o histórico) ou por ninguém do front (os eventos)
- [x] Teste do front: "Assinar" e "Pagar" chamam a ação e abrem o link devolvido
- [x] Roteiro manual no DEV com o ambiente de teste do Mercado Pago: assinar em teste mostra "N dias grátis" e não cobra; assinar bloqueado cobra na hora e o webhook libera o acesso
- [x] `npm run lint`, `npm test` e `npm run build` passam

## Resultado (2026-09-29)

Implementado, testado com o provedor falso e **validado no DEV com o ambiente de teste do Mercado Pago** (roteiro manual feito).

- **Migrations** aplicadas no DEV (`selvxobcjbkligxighlp`): `052_ticket05_assinar_pelo_mercado_pago` (`20260929211658`), `052_ticket05_pagamento_aprovado_nao_volta_atras` (`20260929213606`, da revisão de código) `052_ticket05_autorizacao_da_assinatura` (`20260929231901`, do roteiro manual) e `052_ticket05_historico_de_cobrancas_sobrevive_ao_tenant` (`20260929234006`, da revisão de código).
- **Banco.** `billing_events` (aviso do webhook, chave única `event_key`, sem policy: só o `service_role` lê) e `billing_charges` (histórico, `mp_payment_id` único; só o Gerente do próprio tenant e o Proprietário leem, ninguém do front escreve; excluir o tenant não apaga a cobrança: a linha fica com `tenant_id` nulo, `on delete set null`, e só o Proprietário a lê). Funções só do `service_role`: `get_billing_context` (uma linha só para o Gerente ativo com tenant; Barbeiro, Gerente sem tenant, inativo e desconhecido recebem zero linhas), `record_mp_subscription`, `record_billing_event` (`new`, `retry` ou `duplicate`), `finish_billing_event`, `apply_subscription_payment`, `record_subscription_authorization`, `get_tenant_by_mp_subscription`.
- **Pagamento aprovado.** Só a mensalidade aprovada (`recurring`) ativa a barbearia e avança o período: pagamento perto do fim do período (3 dias antes a 7 depois) renova a partir do fim dele, qualquer outro caso (primeira cobrança, volta depois de bloqueio) começa na data do pagamento. Toda cobrança, qualquer situação, vira uma linha do histórico. Um pagamento aprovado ou estornado só anda para frente: um aviso atrasado (`pending`) ou um aprovado repetido depois do estorno vira `duplicate`, para o período nunca avançar duas vezes.
- **Autorização da assinatura.** `record_subscription_authorization` grava a bandeira do cartão (o final só chega no primeiro pagamento) e estende o acesso até a primeira cobrança que o Mercado Pago calculou, mais 1 hora: em teste, o fim do teste avança; cancelada que assina de novo, o fim do período pago avança. Só avança, nunca encurta.
- **Provedor** (`supabase/functions/_shared/`): `payment_provider.ts` (interface com as 7 operações), `mercadopago_provider.ts` (real: criar assinatura, buscar assinatura, buscar pagamento; trocar cartão, mudar valor, cancelar e cobrar avulso ficam declarados e falham com "não implementado" até os tickets 09 a 12) e `fake_payment_provider.ts` (testes).
- **Função `billing`, ação `assinar`.** Exige JWT do Gerente; o contexto vem do banco. Em teste, `start_date` é o fim do teste; bloqueado, cobrança imediata; cancelada com período pago pela frente, a primeira cobrança é no fim dele. Recusa 401 (sem token ou token inválido), 403 (Barbeiro, Gerente sem tenant, inativo), 409 (assinatura ativa, cobrança pendente ou assinatura anterior ainda ativa no Mercado Pago), 502 (provedor). Sem `MP_ACCESS_TOKEN`, ou com `APP_URL` que não seja https, responde 500 sem chamar o provedor. O `APP_URL` é limpo como na `whatsapp-integration` (tira um prefixo `APP_URL=` colado por engano e a barra final).
- **Função `mercadopago-webhook`** (pública, `verify_jwt` desligado no deploy). Confere o `x-signature` (HMAC-SHA256 do manifesto `id:<data.id em minúsculas>;request-id:<x-request-id>;ts:<ts>;`, o que não veio sai do manifesto), com o segredo em secret; sem segredo configurado, recusa tudo. Grava o aviso com chave única, busca o recurso no Mercado Pago e decide por ele, nunca pelo corpo do aviso. Falha nossa responde 500 para o Mercado Pago reenviar (o aviso volta como `retry`). Trata `payment` (aprovado ativa; a validação de cartão e os pagamentos sem barbearia são gravados e ignorados, com o motivo no `detail`) e `subscription_preapproval` (autorizada: grava bandeira e primeira cobrança). `subscription_authorized_payment` e tópicos desconhecidos são gravados e ignorados.
- **Front.** `assinar()` no repositório (só aceita link `https`), no adaptador Supabase (chama `billing`) e no InMemory; `useAssinar` e `BotaoAssinar` (um clique só, mensagem de recusa, `pageshow` religa o botão ao voltar do Mercado Pago pelo navegador); `SecaoAssinatura` em Configurações (situação, dias do teste, "Assinar" ou "Assinar de novo", "Pagamento confirmado" quando volta do Mercado Pago com a assinatura ativa); o "Pagar" da tela de bloqueio agora funciona; `useRetornoDoPagamento` relê o estado a cada 5 s por 2 minutos quando o Gerente volta em `?assinatura=retorno` e a barbearia continua bloqueada; `useEstadoDeAcesso` ganhou `recarregar`.
- **Testes.** pgTAP 67 (novo, 55 asserções, 55/55). Deno: `_shared` 11, `billing` 20, `mercadopago-webhook` 23 (mutação: com a conferência da assinatura desligada, 3 dos testes falham); whatsapp-integration segue com 99. Vitest: adaptador, repositório, hooks, `BotaoAssinar`, `SecaoAssinatura`, `TelaDeBloqueio`, `GerenteLayout`, `Configuracoes`.
- `CONTEXT.md` ganhou Assinatura no Mercado Pago.

### Roteiro manual no DEV (2026-09-29)

Contas de teste criadas pelo MCP na conta do app "Navalhado SaaS": vendedor `3726971584` e comprador `3726966124` (com R$ 1.000 de saldo). O token de produção do vendedor de teste (`APP_USR`) e o segredo do webhook foram colocados nos secrets do DEV pelo usuário; o webhook do app do vendedor aponta para `…/functions/v1/mercadopago-webhook` (eventos Planos e assinaturas e Pagamentos). Barbearia de teste "Barbearia MP Teste" (plano Tesoura), com o Gerente no e-mail do comprador de teste. O front rodou local (`npm run dev`, `.env` aponta para o DEV).

- **Em teste (assinar).** O checkout mostrou "Você terá 15 dias grátis!" e a primeira cobrança de R$ 59,90 no dia 14/10, sem cobrar na hora. A assinatura ficou `authorized`, o webhook recebeu os avisos com a assinatura secreta aceita e `billing_charges` ficou vazio.
- **Bloqueado (pagar).** A assinatura anterior foi cancelada no Mercado Pago e a barbearia posta como bloqueada; o "Pagar" criou uma assinatura nova (a checagem da anterior cancelada passou) com cobrança imediata. O pagamento aprovado chegou pelo webhook (`payment.created`, `activated`): a barbearia voltou a ativa, com período de 29/09 a 29/10, cartão `visa 5682`, marca de bloqueio limpa e uma linha `approved`, `recurring`, R$ 59,90 em `billing_charges`.

**Riscos que o roteiro fechou**
- **Tenant do pagamento.** O pagamento da mensalidade chega **sem** `metadata.preapproval_id` e com `external_reference` igual ao id do tenant, que é o que o webhook usa (por isso `billing_charges.mp_subscription_id` fica nulo). Funciona.
- **E-mail do pagador.** A assinatura com o e-mail do Gerente foi aceita e o pagamento com "Cartão" (sem conta Mercado Pago) passou; o Mercado Pago ligou o pagador ao comprador de teste pelo e-mail.
- **Horário da primeira cobrança.** O Mercado Pago converte o `start_date` em `free_trial` de dias inteiros contados da hora da autorização, e o `next_payment_date` caiu 10 minutos depois do fim do teste (podia chegar a quase 1 dia). Coberto pela `record_subscription_authorization`, que estende o acesso até a primeira cobrança mais 1 hora.

**Formatos reais do Mercado Pago que o código passou a tratar**
- Ao autorizar, o Mercado Pago cria um pagamento de **validação do cartão** (`operation_type: card_validation`, valor 0, sem `external_reference`): ignorado.
- A assinatura autorizada traz só `payment_method_id` e `card_id`; o final do cartão só vem no pagamento (`card.last_four_digits`).
- O Mercado Pago pode responder `429 local_rate_limited` a duas buscas quase simultâneas: o aviso fica `failed`, a função responde 500 e o Mercado Pago reenvia.

### Decisões que valem lembrar

- **Sem reaproveitar link.** Cada clique cria uma assinatura pendente, com chave de idempotência estável (tenant, valor, início e dia), então um clique repetido no mesmo dia volta com a mesma assinatura. Assinatura pendente que nunca foi autorizada não cobra.
- **Assinar de novo com a anterior ainda ativa é recusado (409).** Se o `mp_subscription_id` atual está `authorized` ou `paused` no Mercado Pago, criar outra cobraria a barbearia duas vezes (bloqueio por cartão recusado, por exemplo). Cancelar no provedor é o ticket 12; ele (ou o 09) precisa tirar essa recusa cancelando a antiga antes de criar a nova.
- **Só o pagamento decide.** Criar ou autorizar a assinatura durante o teste não muda a situação: a barbearia continua em teste até o primeiro pagamento aprovado.
- **Sem tolerância de tempo no `x-signature`, de propósito.** O Mercado Pago reenvia um aviso que falhou por dias (o `429` do roteiro é o caso comum), e não se sabe se cada reenvio traz `ts` novo; rejeitar `ts` antigo descartaria reenvios legítimos. Repetir um aviso é inofensivo: o recurso é sempre buscado no Mercado Pago e aplicar é idempotente. Pelo mesmo motivo o id do recurso lido do corpo (quando não vem na URL) não é um risco: quem decide é a resposta do Mercado Pago.
- **Provedor: as quatro operações não construídas têm uma definição só** (`notImplementedOperations`, em `payment_provider.ts`), usada pela versão real e pela falsa.
- **Processamento no próprio webhook.** A resposta sai depois de gravar, buscar e aplicar (poucas chamadas). Se o Mercado Pago cobrar tempo de resposta, o passo seguinte é responder antes e processar em segundo plano.

### Pendências para o ticket 07 e seguintes

- O aviso `subscription_authorized_payment` traz o `preapproval_id`; se o ticket 07 precisar ligar um pagamento à assinatura (recusa, estorno), é por ele.
- O `billing_charges` ainda guarda `mp_subscription_id` nulo para a mensalidade; a guarda "pagamento de outra assinatura" só vale quando o Mercado Pago manda o id.

### Para publicar em prod

- Deploy das funções `billing` (com JWT) e `mercadopago-webhook` (**sem verificação de JWT**, ou o Mercado Pago recebe 401), incluindo a pasta `_shared` (o deploy pelo MCP aceita `nome/index.ts` + `_shared/*.ts`). Não há `supabase/config.toml` no repositório: a opção de JWT vai no comando de deploy.
- Secrets no projeto de prod: `MP_ACCESS_TOKEN` (app "Navalhado", credenciais de produção ativadas), `MP_WEBHOOK_SECRET` (chave do webhook do app) e `APP_URL`. `MP_PUBLIC_KEY` só entra nos tickets de trocar cartão. Webhook do app no painel do Mercado Pago apontando para a função de prod.
- Ordem: migrations, depois as funções, e só então o front. Junto, publicar também a função `whatsapp-integration` do ticket 04 (migration primeiro); no DEV ela foi publicada em 2026-09-29 (v57).
- Comando dos testes Deno: `cd supabase/functions && deno test --allow-env --allow-net --allow-read billing mercadopago-webhook _shared`.
- No DEV ficou uma função `mp-debug` desativada (só responde 410): pode ser excluída no painel do Supabase.
