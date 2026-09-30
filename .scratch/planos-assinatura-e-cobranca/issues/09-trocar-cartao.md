# 09: Trocar cartão

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** o Gerente troca o cartão da assinatura pela tela Assinatura, digitando o cartão nos campos seguros do Mercado Pago. A próxima cobrança sai no cartão novo.

- Componente de cartão com os campos seguros do Mercado Pago, carregado com a Public Key. Ele gera o token do cartão no navegador e entrega só o token. O número do cartão nunca passa pelo Navalhado. O componente é reaproveitado no ticket 10.
- A Edge Function de cobrança ganha a ação "trocar cartão": só para o Gerente do tenant; atualiza o cartão da assinatura no provedor, sem cobrança imediata; grava a bandeira e o final do cartão novo.
- Com a assinatura em "pagamento recusado", a cobrança pendente passa a ser tentada no cartão novo.
- A tela Assinatura mostra o final do cartão novo depois da troca.

**Blocked by:** 06 (Tela Assinatura e histórico de cobranças, 05b)

**Status:** in-progress

- [x] Teste Deno com o provedor falso: a ação manda só o token; grava bandeira e final; recusa quem não é Gerente do tenant
- [x] Teste do front: o fluxo de troca gera o token pelo componente (falso no teste) e chama a ação; a tela mostra o final novo
- [ ] Roteiro manual no DEV com cartão de teste: trocar o cartão não cobra nada; a próxima cobrança sai no cartão novo
- [x] `npm run lint`, `npm test` e `npm run build` passam

## Resultado (2026-09-30)

Implementado, testado e revisado. Falta o roteiro manual no DEV com o SDK real: ele precisa do secret `MP_PUBLIC_KEY` no Supabase do DEV (a Public Key, no formato `APP_USR-<uuid>`, do mesmo app do Mercado Pago do `MP_ACCESS_TOKEN`; não o Access Token).

- **Banco** (2 migrations, aplicadas no DEV). `052_ticket09_trocar_cartao` (`20260930125423`): `record_card_change(p_tenant_id, p_card_brand, p_card_last4)`, só do `service_role`, grava a bandeira e o final e nada mais (não mexe na situação, no período pago nem no id da assinatura no Mercado Pago) e confere o formato (final com 4 dígitos, bandeira com letras, números e sublinhado; SQLSTATE `22023`). `052_ticket09_cartao_mantem_bandeira` (`20260930133541`, da revisão): a bandeira que o provedor não devolve continua a que estava, porque é ela que marca, em teste, o cartão autorizado; o final continua sendo o que o provedor devolveu ou vazio, para o final do cartão antigo não ficar ao lado de um cartão que pode ser outro.
- **Provedor de pagamento.** `changeCard(subscriptionId, cardToken)` de verdade no Mercado Pago (`PUT /preapproval/{id}` só com `{ card_token_id }`) e na versão falsa; a interface ganha `ChangedCard` (bandeira e final que o provedor devolver). `notImplementedOperations` fica só com as três operações dos tickets 10 a 12.
- **Função `billing`** (v7 no DEV, `verify_jwt` ligado). Duas ações novas, ambas só do Gerente do tenant. `chave_publica` devolve o secret `MP_PUBLIC_KEY`, mas só se ele tiver o formato de Public Key (`APP_USR-<uuid>` ou `TEST-<uuid>`); qualquer outro valor é erro 500 com o motivo no log (prefixo e tamanho, nunca o valor). `trocar_cartao`: o token precisa ter 16 a 64 caracteres de `[A-Za-z0-9_-]`, senão 400; só assinatura em teste, ativa, recusada ou bloqueada e já criada no Mercado Pago, senão 409; 400 e 422 do Mercado Pago viram 422 ("não aceitou o cartão") e qualquer outra falha do provedor vira 502 com texto neutro; a bandeira e o final que o provedor devolve fora do formato são descartados antes de gravar por `record_card_change`; se o banco falha depois de o Mercado Pago trocar, a resposta diz que a troca aconteceu e pede para recarregar. Nenhum log leva o token.
- **Front.** Módulo `src/modules/cartao/`: repositório que confere nome e documento do titular, adaptador dos campos seguros do MercadoPago.js e adaptador em memória para os testes; `montarCampos` devolve os campos daquele formulário (`gerarToken` e `desmontar`), cada um numa instância própria do SDK. `FormularioDeCartao`: número, validade e código nos campos seguros do Mercado Pago; nome e CPF ou CNPJ do titular nos campos do Navalhado; sem `<form>`, porque a tela Assinatura fica dentro do formulário de Configurações; é a peça que o ticket 10 reaproveita. `TrocarCartao`: o botão, o formulário no lugar dele e o aviso depois da troca (com "Fechar", que devolve o botão para trocar de novo). `useTrocarCartao`, `assinaturaRepository.trocarCartao` e `obterChavePublica` (mais os adaptadores Supabase e em memória). A tela Assinatura oferece a troca na assinatura ativa, com pagamento recusado ou em teste com o cartão já autorizado; a tela de bloqueio por pagamento recusado a oferece no lugar do "Pagar".
- **CSP** (`public/_headers`). O SDK do Mercado Pago só roda com: `script-src` `https://sdk.mercadopago.com`; `connect-src` `https://api.mercadopago.com`, `https://api-static.mercadopago.com`, `https://secure-fields.mercadopago.com`, `https://api.mercadolibre.com` e `https://www.mercadolibre.com`; `frame-src` `https://secure-fields.mercadopago.com`. A lista saiu do código do SDK e foi corrigida na prática: numa página servida por `npm run preview:pages` (que aplica o `_headers`), o SDK bloqueava o `connect-src` para `secure-fields` e para `www.mercadolibre.com` (o código do SDK sozinho não mostrava os dois), e os três campos ficavam em branco; com os hosts liberados, os campos carregam e o navegador não reporta mais violação. A geração do token ainda não foi vista com esse CSP (falta a Public Key real).
- **Testes.** Deno 99/99 (`billing` 58, provedor e webhook; `deno check` limpo, inclusive nos arquivos de teste; sem as correções da revisão, 11 testes novos do `billing` falham); pgTAP 70 (14/14, no DEV); Vitest das pastas do ticket 275/275 em 17 arquivos e Vitest completo 1699/1699 em 139 arquivos; `tsc -b` limpo; oxlint sem erro e sem aviso nas pastas do ticket; `npm run build` passa.
- **DEV.** As duas migrations aplicadas e `billing` v7 publicada (conferida contra o repositório). A `mercadopago-webhook` não foi republicada: divide os arquivos de `_shared` com a `billing`, mas nada do que ela usa mudou de comportamento.

### Decisões
- **Só o token passa pelo Navalhado.** O número, a validade e o código ficam em iframes do Mercado Pago; o front manda à função só o token (a função rejeita qualquer coisa que não tenha a forma de um token, inclusive um número de cartão) e nenhum log leva o token.
- **A Public Key vem da função, não de variável do build.** Cada ambiente tem a sua em secret do Supabase, e o mesmo build serve os dois. Ela precisa ser do mesmo app do `MP_ACCESS_TOKEN`: o token do cartão só vale para a conta que o gerou.
- **Na tela de bloqueio por pagamento recusado, "Trocar cartão" no lugar de "Pagar".** O "Pagar" cria outra assinatura, e a anterior continua ativa no Mercado Pago (a função `billing` recusa: cobraria em dobro). Os demais bloqueios continuam com o "Pagar".
- **O Mercado Pago é quem tenta a cobrança de novo.** Não há endpoint para forçar: uma parcela recusada fica em `recycling` e é tentada até 4 vezes numa janela de 10 dias, e a troca do cartão só muda o cartão usado nessas tentativas (e nas cobranças seguintes). O aviso depois da troca diz que isso pode levar alguns dias, sem prometer prazo.
- **O SDK entra sem SRI.** O endereço `https://sdk.mercadopago.com/js/v2` não tem versão fixa (o conteúdo muda a cada publicação do Mercado Pago), então um hash quebraria o formulário. O risco fica limitado pelo CSP, que só libera esse host, e o SDK só é carregado quando o Gerente abre o formulário.
- **Sem `<form>` no componente do cartão.** Enter no nome ou no documento envia; o botão chama a mesma função.

### Da revisão de código
Dez achados, todos aplicados:
- **A troca zerava a bandeira** quando o Mercado Pago não a devolvia, e a bandeira é o que marca o cartão autorizado em teste (sem ela, uma primeira cobrança recusada não abre o prazo de 5 dias e a tela volta a oferecer "Assinar"). Migration `052_ticket09_cartao_mantem_bandeira`; pgTAP 70 cobre.
- **`chave_publica` entregava o que estivesse no secret** a qualquer Gerente. Um Access Token colado ali por engano (começa igual, `APP_USR-`) iria para o navegador. Agora só sai valor com o formato de Public Key. Se a Public Key real do DEV não tiver esse formato, o log da função diz o prefixo e o tamanho e o padrão (`PUBLIC_KEY_PATTERN`, em `billing/index.ts`) se ajusta numa linha.
- **Bloqueado que troca o cartão espera o Mercado Pago.** O usuário não escolheu entre avisar o prazo e cobrar na hora; ficou a primeira opção (o aviso diz que pode levar alguns dias) e a segunda, uma cobrança imediata com o cartão novo, segue como decisão de produto (Limitações).
- **Todo 4xx do provedor virava "cartão não aceito".** Agora só 400 e 422 são recusa do cartão; credencial (401, 403), limite (429), queda e o resto viram 502 neutro ("Não foi possível trocar o cartão agora"). O 404 não virou 409: o Mercado Pago usa 404 para mais de um caso (token de outro app, por exemplo) e a documentação não diz qual; o roteiro deve conferir que status ele devolve para um token usado ou de outro app.
- **Bandeira e final do provedor sem validar** faziam a função do banco recusar (22023) e a troca já feita virava erro 500. Agora o que vier fora do formato é descartado.
- **Um adaptador só para todos os formulários.** `montarCampos` devolve os campos daquele formulário, cada um em uma instância do SDK; conferido no navegador com o SDK real (Public Key falsa): dois conjuntos de campos convivem e desmontar um não mexe no outro. O formulário que fecha antes de os campos chegarem desmonta os que chegam depois, e um campo que falha ao montar desmonta os que já tinha montado.
- **Aviso de sucesso.** Em Configurações diz "a assinatura volta ao normal"; na tela de bloqueio, "o acesso volta ao normal".
- **Painel de sucesso.** Tem "Fechar", que volta ao botão e deixa trocar de novo; fechar também esquece a recusa anterior.
- **pgTAP 70** ganhou a asserção do Gerente sem barbearia (`tenant_id` nulo), como a regra do `CLAUDE.md` pede.
- **Alternância duplicada.** O botão, o formulário e o aviso ficaram dentro do `TrocarCartao`; a tela Assinatura e a tela de bloqueio só o posicionam (`destaque` na tela de bloqueio).

### Limitações
- **Bloqueado que troca o cartão espera o Mercado Pago.** Quem já foi bloqueado (quinto dia da recusa) e troca o cartão volta quando a próxima tentativa do Mercado Pago (dentro dos 10 dias da recusa) ou a próxima parcela (no ciclo seguinte) for aprovada. Se isso for pouco para quem já resolveu o cartão, o caminho é uma cobrança imediata da parcela pendente com o cartão novo (`chargeOnce`, dos tickets 10 a 12), conciliada com a tentativa do Mercado Pago: decisão de produto, fora deste ticket.
- **Assinatura cancelada no Mercado Pago** (depois de 3 parcelas recusadas, segundo a documentação do Mercado Pago) não aceita troca de cartão, e a tela de bloqueio por pagamento recusado não oferece "Pagar". O aviso de cancelamento vira `canceled` no ticket 12, e aí a tela oferece "Assinar de novo".

### Para publicar em prod
Migrations `052_ticket09_trocar_cartao` e `052_ticket09_cartao_mantem_bandeira`, nessa ordem; função `billing` (com `verify_jwt` ligado, `_shared/payment_provider.ts` e `_shared/mercadopago_provider.ts`); secret `MP_PUBLIC_KEY` de prod (Public Key, `APP_USR-<uuid>`, do mesmo app do `MP_ACCESS_TOKEN` de prod); front com o `public/_headers` novo (CSP), tudo pelo mesmo deploy do Cloudflare Pages; republicar também a `mercadopago-webhook` para manter as cópias de `_shared` iguais. Publicar junto com os tickets 07, 08 e 12.
