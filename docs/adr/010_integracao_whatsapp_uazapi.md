# ADR 010: Integração WhatsApp neutra com Uazapi

## Status

Aceita em 2026-08-01. Substitui as ADRs 001, 008 e 009 quanto ao provedor e à operação da integração WhatsApp.

## Contexto

O Navalhado é multi-tenant: cada barbearia possui no máximo uma Instância WhatsApp, mas o código do produto não deve carregar o nome ou o modelo de nenhum provedor. Dev e Prod possuem bancos, secrets, Edge Functions, triggers e rotinas separados. A instância piloto será validada primeiro no Dev; a promoção para Prod somente ocorrerá mediante comando explícito do responsável.

## Decisão

1. O domínio usa exclusivamente `public.whatsapp_instances` e o contrato interno `WhatsAppProvider`.
2. O adaptador vigente é Uazapi, conforme a [documentação oficial da Uazapi WhatsApp API v2.1.1](https://docs.uazapi.com/).
3. O gateway `supabase/functions/whatsapp-integration` é a única fronteira com o provedor. O frontend chama apenas o gateway e recebe estados neutros: `connected`, `connecting`, `disconnected` e `hibernated`.
4. O `UAZAPI_ADMIN_TOKEN` e o `UAZAPI_BASE_URL` são secrets de backend. O `instance_token` individual é persistido somente para uso server-side; nunca é selecionado ou retornado ao frontend.
5. Cada instância possui webhook individual configurado pelo backend, com eventos de conexão e mensagens e filtros para mensagens enviadas pela API, próprias ou de grupos.
6. As credenciais e migrações do Dev são aplicadas e validadas antes de qualquer alteração equivalente em Prod. Não há fallback, dual-write ou promoção automática.

## Segurança e operação

- Endpoints administrativos da Uazapi usam `admintoken`; endpoints da instância usam `token`.
- A autorização da aplicação continua multi-tenant: somente o Gerente do tenant administra a instância, e os gatilhos internos exigem `DB_TRIGGER_SECRET`.
- O Realtime publica `whatsapp_instances` para que a tela de WhatsApp acompanhe status e QR Code sem expor credenciais.
- O status `disconnected` indica ausência de sessão autenticada. `hibernated` indica sessão pausada com credenciais preservadas e pode ser retomado sem novo pareamento.

## Rollback

O rollback de código deve apontar para o commit anterior somente em uma branch de desenvolvimento. A migration 011 é destrutiva para a tabela legada e não deve ser desfeita por recriação automática: a recuperação de dados antigos depende de backup e de uma decisão operacional explícita. Em Prod, interromper a promoção, preservar os secrets atuais e restaurar a versão anterior da Edge Function exige autorização do responsável.

## Consequências

- A troca de provedor fica localizada no adaptador, mantendo o fluxo multi-tenant e a interface neutra.
- Migrations históricas podem mencionar Evolution para reconstrução, mas não são fonte de configuração vigente.
- Novos provedores só podem ser adicionados por outro adaptador que implemente o contrato neutro e por uma nova ADR.
