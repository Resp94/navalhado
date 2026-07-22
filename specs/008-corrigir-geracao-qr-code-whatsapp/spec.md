# Especificação Técnica: Gerenciamento e Pareamento Real de Instâncias WhatsApp (Ambiente Dev: selvxobcjbkligxighlp)

## Problem Statement

Na página de gerenciamento do WhatsApp do gerente (`/whatsapp`), a integração apresentava duas falhas fundamentais:

1. **Instância Fantasma no Banco**: Ao clicar em *"Ativar Integração do WhatsApp"*, a aplicação criava um registro apenas no banco de dados local (`evolution_api_instances`), sem invocar a VPS para criar a instância fisicamente na Evolution API Go. Ao tentar gerar o QR Code posteriormente, a VPS recusava a busca porque a instância não existia no servidor.
2. **Autorização Imprecisa e Tratamento de Erros Incompleto**: A rota `/manage-instance` na Edge Function não validava estritamente o perfil exclusivo de `gerente` do tenant. Além disso, quando a VPS respondia com erro (ex: 502/404), a UI ficava congelada no spinner *"Gerando código..."* sem realizar o rollback de status no banco de dados.

## Environment & Secrets (Dev Project)

- **Supabase Dev Project ID**: `selvxobcjbkligxighlp`
- **Database Vault Secret Name**: `whatsapp_db_trigger_secret`
- **Public Dev App URL**: `https://dev.navalhado.com.br`

## Solution

Reestruturar o ciclo de vida completo da **Instância WhatsApp** no frontend e na Supabase Edge Function `whatsapp-integration/manage-instance`:

1. **Restrição Estrita de Segurança (Somente Gerente)**: A Edge Function valida que a requisição é originada do segredo da trigger do banco (`whatsapp_db_trigger_secret`) ou de um usuário autenticado com perfil estritamente igual a `gerente` do mesmo `tenant_id` da instância (`profile.role === 'gerente'`). Qualquer outro perfil (ex: proprietário sem role de gerente, barbeiro, cliente) é rejeitado com **HTTP 403 Forbidden**.
2. **Ativação Real com Rollback (Ativar Integração)**: O botão *"Ativar Integração"* insere a instância no banco local e dispara a ação `create` na Edge Function para criar a instância na VPS. Em caso de falha na VPS, a inserção local é removida (rollback) e o gerente é notificado via Toast de erro vermelho, permanecendo no estado desativado (*"WhatsApp desativado no momento"*).
3. **Geração Direta de QR Code (Gerar QR Code de Conexão)**: O botão *"Gerar QR Code"* invoca a Edge Function com `action: 'connect'`. A função valida a presença da instância na VPS e obtém o QR Code. Em caso de erro na VPS, o status é revertido para `disconnected` no banco e uma mensagem de erro clara é retornada no corpo da resposta (HTTP 502).
4. **Desconexão Física na VPS (Cancelar Pareamento / Desconectar)**: O botão de desconexão aciona a Edge Function com `action: 'disconnect'`, chamando `POST /instance/disconnect` na VPS e atualizando o banco para `status = 'disconnected'` e `qr_code = null`.

## User Stories

1. Como **Gerente da Barbearia**, quero clicar em *"Ativar Integração do WhatsApp"* e ter certeza de que a **Instância WhatsApp** foi criada fisicamente na VPS, para que o serviço esteja pronto para ser pareado.
2. Como **Gerente da Barbearia**, quero receber um aviso imediato (Toast vermelho) caso a VPS esteja indisponível ao tentar ativar ou gerar o QR Code, garantindo que o painel não congele no estado de pareamento.
3. Como **Gerente da Barbearia**, quero poder clicar em *"Cancelar Pareamento"* ou *"Desconectar Aparelho"* e ter a certeza de que a ligação com a VPS foi encerrada e o QR Code removido da tela.
4. Como **Sistema de Segurança**, quero bloquear com HTTP 403 qualquer tentativa de gerenciamento da integração de WhatsApp que não seja feita exclusivamente pelo Gerente do respectivo tenant.

## Implementation Decisions

- **Autorização na Edge Function (`validateManageInstanceAuth`)**:
  - Valida segredo do Vault `whatsapp_db_trigger_secret` via header `x-db-trigger-secret` ou Bearer JWT do Gerente logado.
  - Exige estritamente `profile.role === 'gerente'` no banco de dados e pertencimento ao mesmo `tenant_id` da instância (`profile.tenant_id === instanceRow.tenant_id`). Rejeita outros perfis com HTTP 403.
- **Fluxo de Ativação (`handleCreateInstance` em `Whatsapp.tsx`)**:
  - Insere registro local em `evolution_api_instances`.
  - Chama `supabase.functions.invoke('whatsapp-integration/manage-instance', { body: { action: 'create', ... } })`.
  - Se a chamada falhar, deleta o registro recém-inserido (`.delete().eq('id', data.id)`) e exibe o Toast de erro.
- **Fluxo de Conexão (`handleConnect` em `Whatsapp.tsx`)**:
  - Atualiza status local para `pairing` e chama `manage-instance` com `action: 'connect'`.
  - Captura a resposta e exibe Toast formatado, priorizando a mensagem de erro retornada no corpo da Edge Function (`funcData?.error || funcError?.message`).
- **Fluxo de Desconexão (`handleDisconnect` em `Whatsapp.tsx`)**:
  - Chama `manage-instance` com `action: 'disconnect'`.
  - A Edge Function executa `POST /instance/disconnect` na VPS e limpa o banco de dados.
- **Auxiliar de Reversão Backend (`revertInstanceToDisconnected`)**:
  - Função utilitária no backend que atualiza `status = 'disconnected'` e `qr_code = null` no banco em caso de exceções na VPS durante o pareamento.

## Testing Decisions

- **Testes Unitários Frontend (`Whatsapp.test.tsx`)**:
  - Testar a criação de instância verificando a chamada `manage-instance` com `action: 'create'` e rollback em caso de erro.
  - Testar a solicitação de QR Code com a ação `connect` e tratamento de mensagens de erro HTTP 502/403.
  - Testar a desconexão da instância acionando a ação `disconnect`.
- **Testes Unitários Backend (`index_test.ts`)**:
  - Testar `validateManageInstanceAuth` garantindo que apenas usuários com `role === 'gerente'` do mesmo tenant passem.
  - Testar rejeição HTTP 403 para usuários não-gerentes.
  - Testar a reversão de status em caso de falha de conexão na VPS.

## Out of Scope

- Alterações na estrutura do banco de dados (tabelas/colunas já existentes).
- Alterações em rotas de notificação por webhook ou lembretes por pg_cron.
- Permissão de acesso a outros perfis no gerenciamento do WhatsApp (restrito estritamente a gerentes).

## Further Notes

- Especificação atualizada com as credenciais reais do ambiente de Dev (`selvxobcjbkligxighlp`), o nome do segredo no Vault (`whatsapp_db_trigger_secret`) e o alinhamento de segurança estrita por role.
