# Especificação Técnica: Fechar o token da Instância WhatsApp no navegador

## Problem Statement

O token da Instância WhatsApp (`whatsapp_instances.instance_token`) é a credencial da instância na Uazapi, e o navegador consegue lê-lo e regravá-lo. O domínio diz o contrário: a ADR 010 (decisão 4) manda o token existir "somente para uso server-side", nunca selecionado nem retornado ao frontend, e o `CONTEXT.md` lista "token no frontend" entre os termos a evitar para Instância WhatsApp.

**1. A proteção foi desfeita por GRANT de tabela.** A migration 009 (2026-08-01) fechou a tabela (`revoke all ... from anon, authenticated`) e abriu só colunas: SELECT em doze colunas, sem o token, e UPDATE em sete. A 010 criou `provider_instance_id` e a deixou, de propósito, fora dos grants do navegador. A 023 manteve o desenho ao acrescentar os modelos de mensagem. Depois, a 036 (2026-08-23) e a 051 (2026-08-26) fizeram `GRANT SELECT, UPDATE ON public.whatsapp_instances TO authenticated`, na tabela. Em Postgres, o privilégio de tabela vale para todas as colunas, as de hoje e as futuras, e nenhum `REVOKE` de coluna o tira. As colunas que a 009 deixou de fora ficaram abertas.

A origem provável (indício do histórico; a mensagem do commit não registra o motivo): a 036 nasceu no commit `34bfb2e`, o mesmo em que a tela passou a ler e gravar `auto_reply_keywords`, coluna criada pela migration 032 sem grant de coluna. Conceder a tabela inteira foi o caminho mais curto para a tela voltar a funcionar. A 051 repetiu o atalho para cinco colunas novas, e o ticket 13 da spec 052 acrescentou `environment` a uma tabela que já estava aberta.

**2. Confirmado no DEV (2026-10-01), só com consultas de leitura.**

- A ACL da tabela é `authenticated=rw` (SELECT e UPDATE de tabela). `anon` não tem nada.
- `authenticated` tem SELECT e UPDATE nas 26 colunas, incluindo `instance_token`, `provider_instance_id`, `instance_name`, `status`, `qr_code` e `environment`. Dezessete colunas ainda trazem o resíduo do GRANT por coluna da 009 e da 023, que o privilégio de tabela torna inócuo.
- A policy de leitura e a de escrita (`whatsapp_instances_select_policy` e `whatsapp_instances_update_policy`, com RLS forçada) liberam a linha só para o Gerente do próprio tenant ou para o Proprietário (`private.is_saas_admin()`). **O Barbeiro não lê a linha**: como o barbeiro de teste do DEV (papel `authenticated` e a identidade dele), a consulta devolve 0 linhas. A exposição, portanto, não é entre usuários da barbearia: é do Gerente (da própria barbearia) e do Proprietário (de todas).
- Prova em execução, como `authenticated`, numa transação com rollback: o Gerente lê o token (36 caracteres) e `environment`; o Proprietário lê o token de todas as linhas; o Barbeiro e um usuário sem perfil leem 0 linhas.
- A tabela está na publicação `supabase_realtime` com todas as colunas e `REPLICA IDENTITY FULL`. A `realtime.apply_rls` instalada no DEV entrega ao assinante toda coluna em que ele tem SELECT, então o token também viaja no `record` e no `old_record` de cada evento que a tela do Gerente recebe.
- A PROD, conferida em 2026-10-01 só com leitura e com autorização do usuário, está no mesmo estado: mesma ACL de tabela, mesmas policies, mesma publicação e as mesmas funções do Realtime (hash igual ao do DEV). Só difere por ainda não ter `environment` (25 colunas). Hoje o token das 2 instâncias da PROD é legível pelo Gerente de cada barbearia e pelo Proprietário.

**3. O que isso permite.**

- *Leitura.* No adaptador da Uazapi (`whatsapp_provider.ts`), o token autentica `send/text`, `webhook`, `instance/connect`, `instance/disconnect` e `DELETE instance`, e é a credencial que o `/webhook` aceita. Quem o lê (sessão roubada, XSS, extensão do navegador) comanda a instância fora das regras do Navalhado, por exemplo enviando mensagens de uma barbearia bloqueada por falta de pagamento, desde que conheça o endereço do servidor da Uazapi. No caso do Proprietário, uma única consulta `select=instance_token` à API de dados devolve a credencial de todas as barbearias: uma sessão de administrador comprometida expõe o WhatsApp de toda a base.
- *Escrita.* O Gerente consegue regravar tudo o que o backend trata como verdade: `instance_token`, `instance_name`, `provider_instance_id`, `provider`, `status`, `qr_code` e `environment`. Com a exclusão da Instância no 7º dia de bloqueio (spec 052, ticket 13), `environment` e o par nome e token decidem se a rotina exclui e o que ela exclui no provedor. Um Gerente de barbearia bloqueada pode se marcar como outro ambiente (a rotina nunca exclui instância sem marca ou de outro ambiente) ou trocar o token (a rotina usa o token gravado na linha), e a vaga na Uazapi continua ocupada.

**4. Os testes que deviam ter avisado não rodam.** A asserção 7 de `security_hardening.test.sql` ("token da instância não é legível pelo navegador") e as de `whatsapp_neutral_persistence.test.sql` (linhas 161 a 178: token não legível e não gravável) pedem o fechamento, mas ninguém roda pgTAP a cada migration. O segundo arquivo nem chega às asserções: para na linha 15 com `function has_constraint(unknown, unknown, unknown, unknown) does not exist`, porque o pgTAP 1.3.3 do DEV não tem `has_constraint`. São oito chamadas nesse arquivo e duas em `whatsapp_balcao_outbox.test.sql`. O arquivo está quebrado desde que foi escrito.

**5. A tela grava `status` e `qr_code` direto.** `handleConnect` e `handleDisconnect` (`src/pages/gerente/Whatsapp.tsx`, linhas 397 e 494) fazem `.update({ status, qr_code, updated_at })`. A Edge Function `manage-instance` já grava os mesmos campos: no `disconnect`, e pela sincronização com o provedor no `connect` e no `status`. No desconectar, a escrita do navegador é redundante. No conectar, é uma pré-gravação de que a janela de pareamento da Edge Function (`isRecentPairing`) depende. Fechar o UPDATE só em configuração exige tirar essas duas escritas da tela.

## Solution

O navegador passa a ler e gravar `whatsapp_instances` só por colunas liberadas uma a uma, e um teste de guarda com a lista exata das colunas falha se a tabela voltar a ser aberta.

**Contrato de colunas.** A lista de leitura é exatamente a que a tela já usa (`WHATSAPP_INSTANCE_COLUMNS`). A lista de escrita é o que o Gerente edita, mais `updated_at`, que a tela envia em toda gravação.

| Coluna | Navegador lê | Navegador grava | Observação |
|---|---|---|---|
| `id` | sim | não | Chave primária. O Realtime exige SELECT nela; sem isso responde 401. |
| `tenant_id` | sim | não | Filtro da assinatura Realtime e do `WHERE` das gravações. |
| `instance_name` | sim | não | A tela mostra o nome e o envia à Edge Function. |
| `status`, `qr_code` | sim | passo 1: sim; passo 2: não | Hoje a tela os grava ao conectar e ao desconectar. |
| `send_confirmation`, `send_reminders`, `send_cancellation`, `send_welcome_balcao`, `reminder_hours` | sim | sim | Configuração dos envios. |
| `template_confirmation`, `template_reschedule`, `template_cancellation`, `template_reminder`, `template_welcome_balcao`, `template_first_contact`, `template_professional_created`, `template_professional_rescheduled`, `template_professional_cancelled` | sim | sim | Modelos de mensagem. |
| `auto_reply_keywords` | sim | sim | Palavras-chave da resposta automática. |
| `updated_at` | não | sim | A tela envia; ninguém lê. |
| `instance_token` | não | não | Credencial da instância. |
| `provider_instance_id` | não | não | Vínculo com a Uazapi. |
| `environment` | não | não | Marca que a rotina de exclusão do 7º dia usa (spec 052, ticket 13). |
| `provider`, `created_at` | não | não | Ninguém lê. A 009 permitia ler; a lista passa a ser igual à da tela. |

São 20 colunas de leitura e 18 de escrita no passo 1 (16 no passo 2). Ninguém no navegador insere ou exclui linha, como hoje.

**Em dois passos.**

1. **Passo 1: banco, sem mudar a tela.** O fechamento acima, com `status` e `qr_code` ainda graváveis (o contrato que a 009 e a 023 já davam). Fecha a leitura do token e a escrita de `instance_token`, `instance_name`, `provider_instance_id`, `provider` e `environment`. A tela atual funciona sem nenhuma mudança, então o banco pode ir primeiro em cada ambiente.
2. **Passo 2: tela e Edge Function, depois banco.** A tela deixa de gravar `status` e `qr_code`: a Edge Function `connect` passa a gravar o início do pareamento (o `disconnect` já grava). Só então o UPDATE perde essas duas colunas, e o navegador passa a gravar apenas configuração.

**Guarda e convenção.** Uma coluna nova de `whatsapp_instances` nasce fechada ao navegador. Para a tela lê-la, a migration que a cria concede `grant select (coluna)`; para gravá-la, `grant update (coluna)`. A lista do teste de guarda muda no mesmo commit. Conceder a tabela nunca é a correção de um erro 42501.

## User Stories

1. As a Gerente, I want que o token da instância da minha barbearia nunca chegue ao meu navegador, so that uma sessão roubada ou uma extensão maliciosa não controle o WhatsApp da barbearia.
2. As a Proprietário, I want não conseguir ler o token de todas as barbearias pela API de dados, so that uma sessão de administrador comprometida não exponha o WhatsApp de toda a base.
3. As a Gerente, I want que a tela do WhatsApp continue funcionando igual (carregar, conectar e ler o QR code, desconectar, ligar e desligar os envios, editar modelos e palavras-chave), so that o fechamento não atrapalhe meu dia a dia.
4. As a Gerente, I want que a tela continue recebendo em tempo real as mudanças de status e de QR code, so that eu não precise recarregar a página.
5. As a Proprietário, I want que Admin > Tenants continue mostrando o status do WhatsApp de cada barbearia, so that o suporte não perca informação.
6. As a Barbeiro, I want continuar sem nenhum acesso à instância, so that a credencial da barbearia fique com quem a administra.
7. As a Proprietário, I want que nenhum Gerente consiga regravar `environment`, nome, token ou vínculo da instância, so that a exclusão do 7º dia aja só sobre o que o backend marcou.
8. As a Gerente, I want que `status` e `qr_code` reflitam o que o servidor soube do provedor, e não o que o navegador gravou, so that a tela nunca mostre um estado que não é o da instância.
9. As a Desenvolvedor, I want um teste de guarda com a lista exata de colunas que o navegador lê e grava, so that um GRANT de tabela, como os das migrations 036 e 051, quebre o teste na hora.
10. As a Desenvolvedor, I want que uma coluna nova da tabela nasça fechada ao navegador, so that conceder a tabela inteira deixe de ser o caminho mais curto para a tela voltar a funcionar.
11. As a Desenvolvedor, I want que os testes pgTAP legados da instância rodem de novo, so that as asserções de token que eles já têm sejam executadas.
12. As a Desenvolvedor, I want a prova, com o Gerente de `tenant_id` nulo, de que o bloqueio vale por privilégio de coluna e não depende da policy, so that o padrão da auditoria de 2026-09-13 cubra também este fechamento.
13. As a Desenvolvedor, I want um roteiro de promoção para a PROD que respeite a ordem banco, tela e Edge Function, e banco de novo, so that nenhuma versão da tela fique sem poder conectar o WhatsApp.

## Implementation Decisions

### Migration de fechamento

A migration do ticket 02 é idempotente e independe do estado de partida (a PROD pode ter resíduos diferentes dos do DEV). Usa o mesmo idioma da migration 044 (ticket 08), que fechou a autoria do cancelamento em `appointments`: revoga o privilégio da tabela inteira e reconcede só as colunas permitidas, porque um `REVOKE` de coluna sozinho não tira o que foi concedido na tabela. Primeiro fecha a tabela, depois abre por coluna:

```sql
-- Spec 053, ticket 02 (passo 1): o navegador le e grava so as colunas da tela.
-- O privilegio de tabela vale para todas as colunas e nenhum REVOKE de coluna o tira:
-- por isso a tabela e fechada primeiro (isso tambem apaga os privilegios de coluna antigos).
revoke all on table public.whatsapp_instances from anon, authenticated;

grant select (
  id, tenant_id, instance_name, qr_code, status,
  send_confirmation, send_reminders, send_cancellation, send_welcome_balcao, reminder_hours,
  template_confirmation, template_reschedule, template_cancellation, template_reminder,
  template_welcome_balcao, template_first_contact,
  template_professional_created, template_professional_rescheduled, template_professional_cancelled,
  auto_reply_keywords
) on public.whatsapp_instances to authenticated;

grant update (
  qr_code, status, -- passo 1; saem no ticket 04
  send_confirmation, send_reminders, send_cancellation, send_welcome_balcao, reminder_hours,
  template_confirmation, template_reschedule, template_cancellation, template_reminder,
  template_welcome_balcao, template_first_contact,
  template_professional_created, template_professional_rescheduled, template_professional_cancelled,
  auto_reply_keywords,
  updated_at
) on public.whatsapp_instances to authenticated;
```

O passo 2 (ticket 04) é uma linha: `revoke update (status, qr_code) on public.whatsapp_instances from authenticated;`.

Não mexe em `service_role` (privilégios próprios, usados pela Edge Function e pelas rotinas), na RLS, nas policies, na publicação do Realtime nem na `REPLICA IDENTITY`.

**Validado no DEV em transação com rollback (2026-10-01).** O fechamento acima, aplicado dentro de `begin; ... rollback;`, deu o resultado esperado em 28 sondagens (mais 8 leituras de catálogo), e depois do rollback a ACL voltou idêntica (`authenticated=rw/postgres`, 17 colunas com resíduo, nenhum usuário de teste restante):

- A tabela fica sem nenhum privilégio de tabela para `authenticated` e `anon`. Leitura em 20 colunas e escrita em 18 (16 depois do passo 2). Nenhum INSERT. `anon` sem nada.
- Como Gerente do tenant: lê as 20 colunas (1 linha); `select instance_token` e `select *` dão 42501; `update ... returning` das 20 colunas funciona; atualizar modelo, flags e `updated_at` funciona; atualizar `instance_token`, `environment`, `instance_name`, `provider_instance_id` ou `tenant_id` dá 42501; atualizar `status` e `qr_code` funciona no passo 1 e dá 42501 no passo 2.
- Como Gerente com `tenant_id` nulo: `select instance_token` dá 42501 (bloqueio por privilégio, antes da policy); as 20 colunas devolvem 0 linhas; `update instance_token` dá 42501; `update` de modelo afeta 0 linhas.
- Como Barbeiro: `select instance_token` dá 42501; as 20 colunas devolvem 0 linhas.
- Como Proprietário: `select instance_token` e `update instance_token` dão 42501; as 20 colunas funcionam; `view_tenants_management` continua devolvendo o status.
- Como `anon`: `select id` dá 42501.

### Realtime

A `realtime.apply_rls` instalada no DEV e a trigger de validação das assinaturas (`subscription_check_filters`) tratam privilégio por coluna, então o fechamento por coluna não exige SELECT na tabela inteira:

- Para cada papel assinante, `has_column_privilege(papel, tabela, coluna, 'SELECT')` marca quais colunas ele pode ver. Sem SELECT na chave primária (`id`), o evento vira "Error 401: Unauthorized".
- A checagem de RLS de cada evento é feita só pela chave primária (`build_prepared_statement_sql`: `exists(select 1 ... where id = ...)`, executada como o papel do assinante).
- O filtro da assinatura (`tenant_id=eq...`) só é aceito se o papel tem SELECT na coluna filtrada.
- O `record` e o `old_record` entregues levam só as colunas selecionáveis. Depois do fechamento, o token, `provider_instance_id`, `environment`, `provider` e `created_at` deixam de viajar pelo WebSocket.

Por isso o contrato de leitura inclui `id` e `tenant_id`. O desenho por coluna já foi o contrato vigente de 2026-08-01 a 2026-08-23, e a ADR 010 já descreve a tela acompanhando status e QR code pelo Realtime "sem expor credenciais". A publicação segue com todas as colunas e `REPLICA IDENTITY FULL`, o que mantém o token dentro do servidor do Realtime, que filtra por papel antes de entregar. Restringir a publicação por lista de colunas exigiria trocar a `REPLICA IDENTITY` e fica fora desta spec.

### Tela e Edge Function (passo 2)

- **`handleConnect`** deixa de chamar `.update` e invoca `manage-instance`. A tela não marca `connecting` localmente: o banco só passa a `connecting` dentro do pedido, e a consulta de pareamento da tela (que roda enquanto o estado é `connecting`) tem de começar depois disso. Se começasse antes, veria `disconnected` no banco e poderia gravá-lo por cima da gravação do pedido. O estado da tela muda com a resposta do pedido ou com o evento do Realtime, o que chegar primeiro. A Edge Function, na ação `connect` e antes de chamar o provedor, grava `status = 'connecting'`, `qr_code = null` e `updated_at = now()`. A sincronização da mesma chamada (`syncProviderStatus`) precisa enxergar a linha já gravada, porque a janela de pareamento (`isRecentPairing`: status `connecting` e `updated_at` com menos de 150 segundos) decide se um `disconnected` transitório do provedor é ignorado. A ação `resume` não grava a pré-gravação. Se o provedor falha, `revertInstanceToDisconnected` (já existe) volta o estado.
- **`handleDisconnect`** deixa de chamar `.update`: a Edge Function `disconnect` já grava `status = 'disconnected'`, `qr_code = null` e `updated_at` depois de o provedor confirmar. A tela atualiza o estado local (`disconnected`, QR nulo) depois da confirmação e mostra o mesmo aviso.
- `handleUpdateConfig` e `handleSaveTemplate` não mudam: os payloads (uma chave de configuração ou um modelo, mais `auto_reply_keywords` na aba de primeiro contato, mais `updated_at`) já cabem na lista de escrita.
- A tela continua enviando `instance_id` e `instance_name` à Edge Function. A Edge Function usa o nome do corpo da requisição, não o da linha; isso fica registrado como achado vizinho, fora desta spec.

### Teste de guarda (pgTAP 77)

Um arquivo novo, `77_colunas_da_instancia_whatsapp_no_navegador.test.sql` (o 75 é do ticket 13 e o 76, do ticket 14, os dois da spec 052), com a lista exata como fonte única:

- Nenhum privilégio de tabela para `authenticated` (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER) nem para `anon`.
- O conjunto de colunas com SELECT para `authenticated` é exatamente as 20 do contrato (`set_eq` contra `pg_attribute` + `has_column_privilege`). O conjunto com UPDATE é exatamente as 18 (16 depois do ticket 04). Nenhuma coluna com INSERT. Nenhuma coluna com qualquer privilégio para `anon`. A comparação por conjunto pega os dois erros: coluna aberta a mais, e a que faltou abrir.
- Asserção nominal, com mensagem que diz o que fazer, de que `instance_token`, `provider_instance_id`, `provider` e `environment` não têm SELECT nem UPDATE (a de `environment` passa vazia onde a coluna ainda não existe, como na PROD antes do ticket 13).
- Comportamento por perfil, com RLS e papel reais (`request.jwt.claim.sub` e `set local role authenticated`, como o pgTAP 32): Gerente do tenant, **Gerente com `tenant_id` nulo**, Barbeiro, Proprietário e `anon`. Os casos são os da lista validada acima e usam `throws_ok(..., '42501', null, ...)`, sem depender do texto da mensagem.
- A asserção do Gerente com `tenant_id` nulo prova que o bloqueio é de privilégio e não da policy: o `select instance_token` dele dá 42501 (não 0 linhas), e a leitura das 20 colunas e o `update` de modelo devolvem 0 linhas, sem erro.
- O token e `environment` do Proprietário e do Gerente nunca aparecem em saída de teste: as asserções comparam privilégio e contagem, não o valor.

### Testes legados

`whatsapp_neutral_persistence.test.sql` e `whatsapp_balcao_outbox.test.sql` trocam cada `has_constraint(schema, tabela, nome, descrição)` por `ok(exists(select 1 from pg_constraint where conrelid = 'tabela'::regclass and conname = 'nome'), descrição)`. É uma troca por uma, então o plano de cada arquivo não muda. Ao rodar de ponta a ponta, duas asserções velhas que o `has_constraint` escondia apareceram: a 40 de `whatsapp_neutral_persistence` (inseria `provider = 'uazapi'`, que é válido, em vez de um provedor inválido) e a 12 de `whatsapp_balcao_outbox` (procurava `search_path = ''` no texto da função, mas o Postgres imprime `SET search_path TO ''`). O ticket 01 corrige as duas, só no teste. As asserções de token desses arquivos e a 7 de `security_hardening.test.sql` já pedem o fechamento certo: ficam como estão e passam no ticket 02. A 12 de `security_hardening.test.sql` (leitura de `comanda_pagamentos`) é o achado antigo e conhecido, fora desta spec.

### Riscos de regressão do front e como o plano os cobre

1. **A tela grava `status` e `qr_code`** (`Whatsapp.tsx:397` e `:494`). Com o UPDATE fechado nessas duas colunas, conectar e desconectar dariam 42501. O passo 1 as mantém graváveis; o ticket 03 tira as escritas da tela antes de o ticket 04 revogá-las.
2. **A pré-gravação de `connecting` alimenta a janela de pareamento** da Edge Function. Ao mover a gravação para a Edge Function, a sincronização da mesma chamada tem de ver o estado já gravado. Cobertura: testes Deno novos para o `connect` e os existentes da janela de pareamento (`index_test.ts`).
3. **`select *` e `.select()` sem lista** passam a dar 42501 (provado). A tela já lista colunas (`WHATSAPP_INSTANCE_COLUMNS`), e o teste "deve buscar somente colunas nao secretas da instancia" fixa a lista. Código novo precisa listar.
4. **Coluna nova que a tela lê ou grava sem grant** dá 42501. Foi isso que levou à migration 036. Cobertura: a convenção e o teste de guarda, cuja mensagem de falha diz para conceder a coluna.
5. **Realtime.** Precisa de SELECT em `id` e `tenant_id`, e o payload perde as colunas fechadas. A tela só usa os campos da lista (`toWhatsappInstance`), e o teste do Realtime já passa um payload com `instance_token` para provar que ele não entra no estado. Cobertura: roteiro manual no DEV. Na PROD, a `apply_rls` tem o mesmo hash que a do DEV (conferido em 2026-10-01), então filtra por coluna do mesmo jeito.
6. **`view_tenants_management`** é `security_invoker` e lê `status` e `tenant_id` da tabela. Os dois ficam liberados; provado para Gerente e Proprietário. A tela Admin > Tenants faz `select('*')` da view (`Tenants.tsx:95`), não da tabela.
7. **Funções e policies que leem a tabela com o privilégio de quem chama.** Nenhuma no DEV: as três funções que citam a tabela são as da exclusão do ticket 13, todas `SECURITY DEFINER` e sem execute para `authenticated`; nenhuma policy de outra tabela a cita; a chave estrangeira da idempotência é checada pelo dono da tabela. Conferido na PROD em 2026-10-01: nenhuma função SQL, policy de outra tabela ou rotina agendada a cita; só a view `view_tenants_management` e a mesma chave estrangeira.
8. **Edge Functions** usam um único cliente com `service_role` (`createClient(supabaseUrl, supabaseServiceRoleKey)`), com privilégios próprios que o fechamento não toca.
9. **Aba aberta com a tela antiga depois do passo 2** dá 42501 ao conectar ou desconectar até recarregar. O passo 2 só vai depois de a tela nova estar no ar no ambiente.
10. **Corrigir um 42501 depois do fechamento** é conceder a coluna certa, nunca a tabela. O cabeçalho da migration e o ticket de promoção dizem isso.
11. **PostgREST** não precisa de recarga de schema: o Postgres confere o privilégio por requisição, e o desenho por coluna já foi o contrato desta tabela de 2026-08-01 a 2026-08-23 e é o de `appointments` desde a 044.
12. O pgTAP 75 (ticket 13) e os demais testes que gravam como `postgres` não são afetados.

### Ordem de entrega e promoção

- No DEV: ticket 01, depois o 02 (passo 1). O 03 (tela e Edge Function) é independente do 02 e passa com os dois estados de GRANT. O 04 (passo 2) vem depois do 02 e do 03.
- A ordem entre esta spec e a migration do ticket 13 (que cria `environment`) é indiferente: se `environment` nasce depois do fechamento, nasce fechada; se já existe, o fechamento a cobre. A migration do ticket 13 está em `dev` (integrada em 2026-10-02) e a coluna existe no DEV; na PROD ela ainda não existe.
- Na PROD: o passo 1 pode ir antes de qualquer outra coisa, porque a tela que está lá só lê e grava colunas da lista (conferido: `main` tem o mesmo `Whatsapp.tsx` e o mesmo `MobileMaisDrawer.tsx` do `dev`). O passo 2 só depois de a tela e a Edge Function novas estarem publicadas. Nada altera a PROD sem comando do usuário. A conferência de leitura já foi autorizada e feita em 2026-10-01.

**Consulta de conferência** (só leitura; serve ao DEV antes e depois de cada migration e à PROD depois da autorização). Devolve uma linha por coluna e a ACL da tabela:

```sql
select a.attname,
  has_column_privilege('authenticated', 'public.whatsapp_instances', a.attname, 'SELECT') as auth_select,
  has_column_privilege('authenticated', 'public.whatsapp_instances', a.attname, 'UPDATE') as auth_update,
  has_column_privilege('anon', 'public.whatsapp_instances', a.attname, 'SELECT') as anon_select
from pg_attribute a
where a.attrelid = 'public.whatsapp_instances'::regclass and a.attnum > 0 and not a.attisdropped
order by a.attnum;

select relacl::text from pg_class where oid = 'public.whatsapp_instances'::regclass;
```

Hoje, no DEV, a primeira devolve `true` em `auth_select` e `auth_update` para as 26 colunas, e a segunda devolve `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=rw/postgres}`. Depois do passo 1, a ACL perde o `authenticated=rw/postgres` e a primeira passa a bater com o contrato de colunas.

## Testing Decisions

- **Bom teste aqui** olha de fora, com o papel real: quem lê ou grava qual coluna, e o que a tela e a Edge Function fazem. Não olha como o GRANT foi escrito: a comparação é com o conjunto de colunas, não com o texto da migration.
- **Banco (pgTAP no DEV, dentro de `begin; ... rollback;`).** O arquivo 76 (lista exata, privilégio de tabela, comportamento por perfil, Gerente com `tenant_id` nulo) e os legados consertados. Precedentes: pgTAP 32 (Gerente com `tenant_id` nulo), 56 (guarda por privilégio de coluna em `appointments`, com `42501`) e 75 (instância de teste com `environment`). Cada tenant, usuário e instância do teste nasce na transação e some no rollback. Instância de teste nunca conectada, para nada sair pelo WhatsApp.
- **Tela (Vitest).** `Whatsapp.test.tsx`: conectar e desconectar não chamam `.update` em `whatsapp_instances`; a lista do `select` continua a mesma; os payloads de configuração e de modelo continuam iguais; o teste do Realtime com `instance_token` no payload continua. Precedente: o próprio arquivo.
- **Edge Function (Deno).** `index_test.ts`: o `connect` grava `connecting`, QR nulo e `updated_at` antes de chamar o provedor; falha do provedor reverte para `disconnected`; a janela de pareamento continua valendo; `resume` não grava a pré-gravação. Precedente: os testes de `manage-instance` do mesmo arquivo.
- **Roteiro manual no DEV** (o usuário digita a senha do Gerente): a tela carrega; ligar e desligar um envio; salvar um modelo; "Gerar QR Code" mostra o QR; uma segunda aba recebe a mudança em tempo real; nos quadros do WebSocket do navegador não aparecem `instance_token` nem `environment`; "Desconectar Aparelho" volta ao estado inicial; Admin > Tenants mostra o status. Ao conectar, usar a instância de teste do DEV sem agendamento ativo, para nenhuma mensagem real sair.
- **Conferência por consulta** antes e depois de cada migration: `has_column_privilege` por coluna e `relacl`, no DEV e (com autorização) na PROD.

## Out of Scope

- Mover o token para outra tabela ou para o Vault. O fechamento por coluna basta para o desenho atual e já foi o contrato da 009. Vale rever se aparecerem outros segredos na tabela.
- Restringir a publicação do Realtime por lista de colunas e trocar a `REPLICA IDENTITY`.
- Rotacionar os tokens existentes. Ver as decisões em aberto.
- Fazer a Edge Function `manage-instance` usar o `instance_name` da linha em vez do do corpo da requisição. As chamadas à Uazapi autenticam pelo token, mas vale fechar.
- O fallback do `/webhook` por nome da instância (SEC-003 da auditoria de 2026-09-01).
- `customers.token_acesso` e `customers.token_expirado_em` (credencial do Canal do Cliente): qualquer usuário `authenticated` do tenant, Gerente ou Barbeiro, lê e grava pelo GRANT de tabela e pela policy do tenant, e a migration 051 também deu `SELECT, UPDATE, INSERT` na tabela `customers`. Não foi avaliado se isso é intencional. Merece spec própria.
- Um gatilho que preencha `updated_at` no banco, em vez de a tela enviá-lo.
- Generalizar o teste de guarda para as outras tabelas fechadas por coluna. `appointments` (migration 044) usa o mesmo idioma, e um `GRANT UPDATE ON public.appointments TO authenticated` futuro a reabriria do mesmo jeito; o pgTAP 56 cobre a autoria, não a lista inteira.

## Further Notes

- **Correção da premissa do achado.** O achado inicial dizia que Gerente e Barbeiro leem o token. Pelas policies e pela prova em execução no DEV, quem lê é o Gerente (da própria barbearia) e o Proprietário (de todas); o Barbeiro lê 0 linhas.
- **O acesso do Proprietário às linhas não muda.** A policy com `private.is_saas_admin()` fica como está: o acesso dele às barbearias é intencional. O que fecha é a coluna da credencial, que nenhuma tela do Admin lê (Admin > Tenants usa só o status, pela view).
- **Estado da PROD (`boakqstrdfqmsrwnjore`, consultado em 2026-10-01 com autorização do usuário, só `SELECT` em catálogo).** Nenhum token foi lido, e nada foi alterado.
  - A ACL da tabela é a mesma do DEV: `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=rw/postgres}`. RLS forçada, `REPLICA IDENTITY FULL`, `anon` sem nada.
  - São 25 colunas (o DEV tem 26, por causa de `environment`). `authenticated` tem SELECT e UPDATE nas 25, incluindo `instance_token` e `provider_instance_id`. As mesmas 17 colunas trazem o resíduo do GRANT por coluna da 009 e da 023.
  - As duas policies são idênticas às do DEV: só o Gerente do próprio tenant e o Proprietário leem e gravam a linha. O Barbeiro não lê, como no DEV.
  - A publicação `supabase_realtime` leva as 25 colunas, sem filtro de linha.
  - As funções `realtime.apply_rls`, `subscription_check_filters`, `build_prepared_statement_sql` e `is_visible_through_filters` têm o mesmo hash do DEV. A `apply_rls` de lá também usa `has_column_privilege` e tem o ramo 401 para chave primária sem SELECT.
  - Nenhuma função SQL, policy de outra tabela ou rotina agendada cita a tabela. Dependem dela só a view `view_tenants_management` (`security_invoker`, lendo `status` e `tenant_id`) e a chave estrangeira de `whatsapp_message_idempotency`.
  - Há 2 instâncias. Não há a coluna `environment` nem as funções e a rotina do ticket 13. Na data da consulta elas não estavam em `dev` nem em `main`; desde 2026-10-02 estão em `dev`, e ainda não em `main`.
  - A tela publicada (`main`) tem o mesmo `Whatsapp.tsx` e o mesmo `MobileMaisDrawer.tsx` do `dev`, com a mesma lista de leitura e as mesmas escritas.
- **Numeração.** O teste de guarda é o pgTAP 77. Nasceu como 76 e foi renumerado quando o ticket 14 da spec 052 entrou em `dev` com o 76 dele (o 75 é do ticket 13, também em `dev`).
- **Decisões que dependem do usuário.**
  1. Consultar a PROD (só leitura). Autorizada e feita em 2026-10-01; o resultado está acima. Confirmou a exposição e que a `apply_rls` de lá é a mesma do DEV.
  2. Seguir os dois passos (recomendado, porque entrega primeiro o que fecha a credencial sem mexer na tela) ou parar no passo 1 e deixar `status` e `qr_code` graváveis, como a 009 e a 023 deixavam.
  3. Rotacionar os tokens. O token esteve legível pelo navegador do Gerente e do Proprietário desde a migration 036 em cada ambiente; não há sinal de uso indevido. Rotacionar exige recriar a instância e reler o QR code de cada barbearia. A recomendação é não rotacionar, salvo indício de uso indevido.
  4. Abrir a spec do `customers.token_acesso`.
  5. `provider` e `created_at` deixam de ser legíveis (a 009 deixava; nada lê). Reabrir é uma linha de GRANT, se alguma tela futura precisar.
- **Tickets** (em `.scratch/fechar-token-da-instancia-whatsapp/issues/`): 01 Testes pgTAP legados voltam a rodar; 02 Fechar as colunas da instância no banco (passo 1); 03 A tela deixa de gravar `status` e `qr_code`; 04 O UPDATE do navegador perde `status` e `qr_code` (passo 2); 05 Promoção para a PROD.
