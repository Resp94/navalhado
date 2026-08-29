# Snapshot operacional — hardening da mensageria WhatsApp

**Data:** 28/08/2026 22:20 (America/Manaus)
**Commit de referência:** `55029a8`.
**Working tree:** alterações locais da correção dos achados do code review; nenhum push remoto realizado.

## Ambiente da validação

- Repositório local `C:\Projetos\navalhado`.
- Banco Supabase remoto do Navalhado consultado e atualizado por migrations versionadas.
- Edge Function `whatsapp-integration` publicada na versão 46, mantendo `verify_jwt: false` e autenticação própria das rotas.

## ✅ Funcional

### Mensageria e idempotência

- Primeira mensagem do dia usa a chave determinística por tenant e mensagem externa, separando os registros inbound/outbound sem perder deduplicação.
- Webhooks UAZAPI com token ou payload legado somente com nome da instância continuam compatíveis.
- Renderização inválida registra a causa no ledger e não chama o provedor.
- Envio manual, boas-vindas, notificações de agendamento e lembretes passam pelo dispatcher comum, com retry e observabilidade sanitizada.

### Outbox e banco

- Cadastro de cliente de balcão cria item durável no outbox; worker periódico processa a boas-vindas.
- Eventos de agendamento confirmados, cancelados e reagendados entram no outbox durável.
- Gatilhos privilegiados vivem em `private`, sem `net.http_post`, e são executáveis somente por `service_role`.
- RPCs operacionais da outbox são `SECURITY INVOKER`, sem execução para `anon` ou `authenticated`.

## Regras críticas de preservação

- Não substituir o fluxo UAZAPI nem alterar seu contrato de envio.
- Não editar migrations já aplicadas; correções de banco devem usar uma migration nova.
- Manter o isolamento por tenant e por direção (`inbound`/`outbound`) no ledger.
- Manter retry para timeout, 429 e 5xx; falhas permanentes do provedor não devem ser reprocessadas automaticamente.
- Não registrar conteúdo de mensagem ou telefone completo na observabilidade operacional.

## ⚠️ Limitações e pendências conhecidas

- `supabase test db --linked` não pôde ser executado localmente porque o CLI não está vinculado ao projeto; as invariantes de banco foram verificadas por SQL remoto e pelos testes versionados.
- O advisor de segurança ainda lista avisos históricos de outras funções públicas do projeto e informa que o outbox possui RLS sem policy; o comportamento é deny-by-default para clientes e o worker usa `service_role`.
- O build mantém o aviso existente de bundle JavaScript grande.

## Verificações executadas

- `deno test --allow-env --allow-net supabase/functions/whatsapp-integration/index_test.ts supabase/functions/whatsapp-integration/message_dispatcher_test.ts` — **72 aprovados**.
- `npm test` — **52 arquivos e 290 testes aprovados**.
- `npm run build` — **aprovado**.
- `npm run lint` — **código 0**, somente avisos preexistentes.
- `git diff --check` — sem erro de whitespace.
- SQL remoto — migrations `whatsapp_private_triggers_and_appointment_outbox` e `whatsapp_private_trigger_privileges` aplicadas; privilégios, triggers ativos e ausência de `net.http_post` confirmados.

## Alterações desde o snapshot anterior

- Dispatcher único para os fluxos produtivos de envio.
- Outbox durável para boas-vindas e eventos de agendamento.
- Compatibilidade de webhook e idempotência de primeiro contato corrigidas.
- Contrato de aliases de templates centralizado.
- Triggers e funções operacionais endurecidos com migrations novas.
- Cobertura de RPC, retry 429/5xx, timeout, renderização, outbox e observabilidade ampliada.
