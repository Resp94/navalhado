# Snapshot operacional — smoke test das correções de agenda e mensageria

**Data:** 29/08/2026 11:30 (America/Manaus)  
**Commit de referência:** `5bbf7db` (`dev`).  
**Working tree:** o commit contém somente as correções desta sessão; permanecem fora do escopo alterações documentais/relatórios e `.playwright-mcp/` já existentes.

## Ambiente da validação

- Branch `dev`, sem merge para `main` e sem promoção para PROD.
- Smoke test funcional executado em DEV e informado pelo usuário como aprovado nos cinco blocos.
- Auditoria de banco realizada separadamente, somente leitura, nos projetos Supabase DEV (`Navalhado-dev`) e PROD (`Navalhado`).
- Navegador integrado usado para reproduzir o defeito do date picker no link público; o ambiente publicado ainda apresentava o input nativo com área mínima e `pointer-events: none`, confirmando a causa corrigida no código da `dev`.

## ✅ Funcional — smoke test aprovado

### 1. Agenda desktop

- Grade temporal, intervalo por tenant, sábado e remoção de bloqueio foram aprovados manualmente.

### 2. Agenda mobile

- Navegação entre dias, horários, bloqueios e remoção com modal de confirmação foram aprovados manualmente.

### 3. Link público

- Date picker ao tocar no campo no mobile, seleção de data, serviço/profissional, agendamento e fluxo público foram aprovados manualmente.

### 4. Mensagens

- Persistência de modelos, comportamento do link opcional, palavras-chave e fluxos de mensagens foram aprovados manualmente.

### 5. WhatsApp

- Instância, envios e rastreabilidade dos fluxos WhatsApp foram aprovados manualmente.

Todos os envios WhatsApp implementados permanecem no escopo funcional: boas-vindas, primeiro contato, palavras-chave, confirmação, cancelamento, reagendamento, lembretes e envio manual.

## Correções registradas

- O bloqueio de horário passou a exigir confirmação por `ConfirmSoftDeleteModal` antes da exclusão.
- O input nativo `type="date"` do Canal do Cliente passou a ocupar toda a área do campo, com transparência visual e captura direta do toque no mobile.
- Foram adicionados testes de regressão para a confirmação de remoção e para o alvo de toque do date picker.
- Nenhuma migration foi criada, editada ou aplicada; não houve alteração de schema.

## Evidências automatizadas

- Suíte completa: **53 arquivos e 296 testes aprovados**.
- Lint: **código 0**, somente avisos preexistentes.
- Typecheck/build: **aprovados**, com aviso preexistente de bundle grande.
- `git diff --check`: **aprovado**.
- Commit local: `5bbf7db` — `corrige date picker publico e confirmacao de bloqueio`.

## Evidências de banco — testes 8 e 9

- Isolamento por tenant: tabelas críticas com RLS forçado, policies baseadas em `private.get_auth_tenant_id()` e sem registros com `tenant_id` nulo ou órfão em DEV/PROD.
- Persistência e rastreabilidade: templates, estado de palavras-chave, `last_first_contact_at`, idempotência e outbox persistidos por tenant; registros do outbox consultados estavam `succeeded`.
- Os motivos de skip observados estavam sanitizados; nenhum conteúdo de mensagem ou segredo foi exposto.
- PROD mantém um registro antigo de idempotência `appointment_cancelled` em `processing`, atualizado aproximadamente 604 minutos antes da auditoria. O registro não foi alterado e permanece como investigação separada.

## Regras críticas de preservação

- Não alterar o contrato de envio da UAZAPI.
- Manter todos os eventos WhatsApp no dispatcher e no outbox durável.
- Preservar retry, idempotência, opt-out, isolamento por tenant e observabilidade sanitizada.
- Toda alteração de banco deve ser feita em nova migration versionada.
- Não considerar o smoke aprovado como autorização automática para merge; a promoção DEV → `main` → PROD continua dependendo da decisão e do fluxo de release.

## Resultado

**Smoke funcional dos itens 1 a 5: ✅ aprovado pelo usuário.**

As correções estão registradas na `dev`. `main` e PROD ainda não foram alterados nesta etapa.
