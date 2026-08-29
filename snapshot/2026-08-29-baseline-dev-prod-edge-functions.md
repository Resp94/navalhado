# Snapshot operacional — baseline DEV/PROD e Edge Functions

**Data e horário da validação:** 29/08/2026 11:52 (America/Manaus)  
**Commit de referência em DEV:** `ccb3f5ff0ba1540ca6849536eea0e38e8826ea9b` (`alinha default do audit logs`)  
**Estado do Git:** branch `dev`, dois commits à frente de `origin/dev`; o diretório `.playwright-mcp/` permanece fora do escopo como artefato local não versionado.

## Ambientes

- DEV: projeto Supabase `Navalhado-dev` (`selvxobcjbkligxighlp`).
- PROD: projeto Supabase `Navalhado` (`boakqstrdfqmsrwnjore`).
- `main` local contém o merge `9c79eca` de DEV; a sessão foi devolvida para a branch `dev`.

## ✅ Edge Functions — código alinhado

A listagem do Supabase confirmou uma única Edge Function publicada em cada projeto:

- `whatsapp-integration`: `ACTIVE` em DEV e PROD.
- `verify_jwt`: `false` em ambos, preservando o contrato atual de webhook/autenticação própria.
- DEV está na versão 47.
- PROD foi republicada a partir dos arquivos versionados da DEV e está na versão 48.

Os quatro arquivos publicados foram comparados por conteúdo canônico, ignorando somente diferenças de quebra de linha:

- `index.ts` — igual em conteúdo; a diferença de bytes é CRLF/LF.
- `whatsapp_provider.ts` — igual.
- `message_dispatcher.ts` — igual.
- `whatsapp_template_contract.ts` — igual.

Os hashes de bundle e os números de versão podem ser diferentes porque cada projeto mantém seu próprio artefato e a publicação em PROD criou uma nova versão. Isso não representa divergência funcional do código.

## ✅ Banco — equivalência estrutural do escopo

A migration versionada `20260829120000_reconcile_audit_logs_created_at_default.sql` foi aplicada em DEV e PROD. O default de `public.audit_logs.created_at` está alinhado com `now()` nos dois projetos.

Comparação registrada:

- Tabelas: 25 em cada projeto, fingerprints equivalentes.
- Colunas: 310 em cada projeto; tipos, defaults e nulidade equivalentes para o escopo.
- Constraints: 165 em cada projeto, equivalentes.
- Índices: 127 em cada projeto, equivalentes.
- Policies/RLS: 85 em cada projeto, equivalentes.
- Triggers: 19 em cada projeto, equivalentes.
- Functions/RPCs relevantes: assinaturas e comportamento verificados como equivalentes.

Limitação conhecida: a ordem física das colunas de `audit_logs` ainda é diferente entre os projetos. Essa diferença não altera o contrato da tabela nem foi corrigida com reconstrução destrutiva. Os históricos remotos de migrations também possuem nomes/timestamps diferentes em alguns registros, mas os objetos efetivos relevantes estão alinhados.

## ✅ Validações de código

- Suíte geral: 53 arquivos e 296 testes aprovados.
- Lint: código 0; somente avisos preexistentes.
- Typecheck/build: aprovados; permanece apenas o aviso preexistente de bundle grande.
- `git diff --check`: aprovado.
- Não foi enviado teste real de WhatsApp após a republicação para não gerar mensagens externas; a confirmação realizada foi de publicação, conteúdo, status e configuração da função.

## Funcionalidades que devem ser preservadas

- Todos os envios WhatsApp: boas-vindas, primeiro contato, palavras-chave, confirmação, cancelamento, reagendamento, lembretes e envio manual.
- Dispatcher, outbox durável, retry, idempotência, opt-out e observabilidade sanitizada.
- Isolamento por tenant, RLS e regras de agenda.
- Grade temporal configurada por tenant, incluindo sábado.
- Remoção de bloqueio com modal de confirmação.
- Date picker do link público funcionando por toque no mobile.
- Fluxos públicos de agendamento, cancelamento e reagendamento.
- Nenhum segredo, token ou API key deve ser registrado no snapshot.

## Procedimento para próximas alterações

1. Começar sempre em `dev`.
2. Consultar este snapshot antes de alterar código, banco ou Edge Functions.
3. Validar código e banco em DEV.
4. Aplicar migrations versionadas em PROD somente após a validação de DEV.
5. Publicar as Edge Functions em PROD usando exatamente os arquivos versionados validados.
6. Comparar DEV x PROD novamente.
7. Só então promover `dev` para `main` e validar o resultado final.
8. Criar um novo snapshot datado; nunca editar ou apagar snapshots anteriores.

## Resultado

**DEV e PROD estão alinhados no código publicado da Edge Function e na estrutura funcional do banco para o escopo validado.** A diferença física de ordem de coluna em `audit_logs` e as diferenças de versão/hash do artefato devem ser consideradas limitações conhecidas, não divergências funcionais.
