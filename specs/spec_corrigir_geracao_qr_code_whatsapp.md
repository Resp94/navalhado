# Especificação Técnica: Correção da Geração de QR Code do WhatsApp (Ambiente Dev)

## Problem Statement

Na página de gerenciamento do WhatsApp do gerente (`/whatsapp`), ao clicar no botão "Gerar QR Code de Conexão", a aplicação não conclui a geração do QR Code nem conecta a **Instância WhatsApp** do tenant.

Atualmente, o botão executa apenas um `UPDATE` na tabela `evolution_api_instances` alterando o status para `pairing`, confiando que uma trigger assíncrona do Postgres (`pg_net`) invoque a Edge Function `whatsapp-integration`. Caso essa trigger falhe, demore ou o segredo do Vault não seja validado, o frontend fica sem feedback direto e o usuário permanece travado com a indicação de *"Gerando código..."*.

## Solution

Permitir que a **Supabase Edge Function** (`whatsapp-integration/manage-instance`) seja invocada diretamente pela ação do Gerente no frontend (`supabase.functions.invoke`) ao clicar em "Gerar QR Code de Conexão", mantendo o isolamento no **Ambiente Dev Completo e Isolado**.

Ao ser acionada:
1. A Edge Function autentica a requisição (via JWT do Gerente ou segredo de trigger).
2. A Edge Function faz preflight e solicita o QR Code base64 à **Evolution Dev** / VPS (`GET /instance/qr`).
3. O QR Code gerado é salvo na coluna `qr_code` da tabela `evolution_api_instances`.
4. Caso a VPS retorne erro ou esteja indisponível, a Edge Function restaura o status da instância para `disconnected` no banco de dados e retorna o erro para que a UI exiba um Toast informativo ao Gerente.

## User Stories

1. Como **Gerente da Barbearia**, quero clicar em "Gerar QR Code de Conexão" e visualizar o QR Code da Evolution API Go em poucos segundos na tela, para que eu possa escanear o código pelo meu aplicativo de WhatsApp.
2. Como **Gerente da Barbearia**, quero receber um aviso claro (Toast de erro) se a integração com a VPS falhar ou se a instância já estiver conectada, para que eu saiba exatamente o motivo e possa tentar novamente sem a tela congelar em "Gerando código...".
3. Como **Gerente da Barbearia**, quero que o status da **Instância WhatsApp** seja revertido para `desconectado` caso a VPS não consiga gerar o código, garantindo que o painel reflita o estado real do serviço.

## Implementation Decisions

- **Autorização na Edge Function (`/manage-instance`)**: Expandir a validação do endpoint para aceitar tanto o segredo interno de trigger (`x-db-trigger-secret`) quanto o token de sessão JWT do Gerente (`Authorization: Bearer <token>`).
- **Chamada Direta no Frontend (`Whatsapp.tsx`)**: Atualizar o manipulador `handleConnect` para chamar `supabase.functions.invoke('whatsapp-integration/manage-instance', { body: { action: 'connect', instance_id, instance_name } })`.
- **Tratamento de Falha e Reversão no Backend**: No manipulador `action === 'connect'` da Edge Function, caso a VPS retorne um erro diferente de "instância já conectada", efetuar um `UPDATE` para `status = 'disconnected'` e `qr_code = null` antes de responder com HTTP status 502.
- **Respeito aos ADRs de Domínio**: Toda a alteração e execução dos testes serão aplicadas no banco de desenvolvimento, conforme definido no [CONTEXT.md](file:///c:/Users/respl/OneDrive/Aptus%20Flow/saas-navalhado/CONTEXT.md) e na ADR de ambiente dev.

## Testing Decisions

- **Testes de Unidade Frontend (`Whatsapp.test.tsx`)**:
  - Validar que o clique em "Gerar QR Code de Conexão" aciona `supabase.functions.invoke('whatsapp-integration/manage-instance')` com os parâmetros corretos.
  - Validar a exibição de Toast de erro e a ausência de travamento caso a função retorne um erro.
- **Testes de Integração Backend (`supabase/functions/whatsapp-integration/index_test.ts`)**:
  - Testar a rota `/manage-instance` com `action: 'connect'` fornecendo token de usuário autenticado.
  - Verificar a resposta de tratamento quando a VPS simula erro de comunicação.

## Out of Scope

- Alteração da rota `/webhook` de sincronização reativa de status.
- Mudanças na infraestrutura da VPS Evolution API Go.
- Alterações no ambiente de produção.

## Further Notes

- A especificação foi gerada via `/to-spec` sintetizando as decisões alinhadas com Jonathas.
