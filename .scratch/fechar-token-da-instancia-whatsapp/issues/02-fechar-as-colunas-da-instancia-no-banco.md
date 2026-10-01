# 02: Fechar as colunas da Instância WhatsApp no banco (passo 1)

Parte da spec 053 (Fechar o token da Instância WhatsApp no navegador).

**What to build:** o navegador deixa de ler e de regravar o token da instância e as colunas que o backend trata como verdade, sem nenhuma mudança na tela. Um teste de guarda com a lista exata de colunas impede que o GRANT de tabela volte.

- **Migration** `053_ticket02_fechar_colunas_da_instancia_whatsapp`, aplicada no DEV (`selvxobcjbkligxighlp`) por `apply_migration`. O SQL é o da seção "Migration de fechamento" da spec: `revoke all on table public.whatsapp_instances from anon, authenticated`, depois `grant select (...)` nas 20 colunas da tela e `grant update (...)` nas 18 (as 16 de configuração mais `status` e `qr_code`, que a tela ainda grava até o ticket 04). O cabeçalho da migration explica o porquê (as migrations 036 e 051 concederam a tabela), cita o idioma da 044 e registra a convenção: coluna nova nasce fechada, a tela a abre com `grant select (coluna)` e `grant update (coluna)` na mesma migration, e um erro 42501 se corrige concedendo a coluna, nunca a tabela. O arquivo local leva a versão que o `apply_migration` registrar (consultar `supabase_migrations.schema_migrations` por `execute_sql`; `list_migrations` despeja o histórico inteiro).
- **pgTAP 76** (`76_colunas_da_instancia_whatsapp_no_navegador.test.sql`; o 75 é do ticket 13, na branch dele), escrito antes da migration e visto falhar:
  - nenhum privilégio de tabela para `authenticated` (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER) e nenhuma coluna com qualquer privilégio para `anon`
  - o conjunto de colunas com SELECT para `authenticated` é exatamente as 20 do contrato, e o de UPDATE exatamente as 18 (`set_eq` contra o catálogo, que pega coluna aberta a mais e coluna esquecida); nenhuma coluna com INSERT
  - asserção nominal, com mensagem que diz o que fazer, de que `instance_token`, `provider_instance_id`, `provider` e `environment` não têm SELECT nem UPDATE (a de `environment` passa vazia onde a coluna não existe)
  - `id` e `tenant_id` com SELECT, que é o que o Realtime exige
  - como Gerente do tenant, com RLS e papel reais (`request.jwt.claim.sub` e `set local role authenticated`, como o pgTAP 32): lê as 20 colunas; `select instance_token` e `select *` dão 42501; `update ... returning` das 20 colunas funciona; atualizar modelo, flags, `reminder_hours`, `auto_reply_keywords` e `updated_at` funciona; atualizar `instance_token`, `instance_name`, `provider_instance_id`, `environment`, `tenant_id` e `id` dá 42501; atualizar `status` e `qr_code` funciona
  - **como Gerente com `tenant_id` nulo** (mesma preparação do pgTAP 32): `select instance_token` dá 42501 (bloqueio por privilégio, e não 0 linhas por causa da policy); a leitura das 20 colunas devolve 0 linhas; `update ... set instance_token` dá 42501; `update` de modelo afeta 0 linhas
  - como Barbeiro do tenant: `select instance_token` dá 42501 e as 20 colunas devolvem 0 linhas
  - como Proprietário: `select instance_token` e `update ... set instance_token` dão 42501; as 20 colunas funcionam; `select whatsapp_status from public.view_tenants_management` devolve a linha
  - como `anon`: `select id` dá 42501
  - todas as comparações são de privilégio e de contagem, nunca do valor do token; o `throws_ok` usa o código `42501` e mensagem `null`
  - tenant, usuários e instância de teste nascem na transação e somem no rollback; a instância do teste nunca é conectada
- **Documentação.** O termo Instância WhatsApp do `CONTEXT.md` ganha o contrato (o navegador lê e grava só as colunas liberadas uma a uma, nunca por tabela; coluna nova nasce fechada). Os dois comentários de `docs/modelagem_banco.md` sobre os grants de `whatsapp_instances` passam a listar o contrato.
- **Roteiro manual no DEV** (o usuário digita a senha do Gerente): a tela do WhatsApp carrega; ligar e desligar um envio e recarregar mostra o valor salvo; salvar um modelo; "Gerar QR Code de Conexão" mostra o QR; uma segunda aba recebe a mudança em tempo real; nos quadros do WebSocket do navegador não aparecem `instance_token` nem `environment`; como Proprietário, Admin > Tenants mostra o status do WhatsApp. Usar a instância de teste do DEV sem agendamento ativo, para nenhuma mensagem real sair.

**Blocked by:** 01 (Testes pgTAP legados da Instância WhatsApp voltam a rodar)

**Status:** ready-for-agent

- [ ] pgTAP 76 escrito antes da migration e visto falhar no DEV (lista, token, Gerente com `tenant_id` nulo)
- [ ] Migration aplicada no DEV; `has_column_privilege` por coluna igual ao contrato (20 de leitura, 18 de escrita, nenhum privilégio de tabela para `authenticated` e `anon`)
- [ ] pgTAP 76 passa
- [ ] `whatsapp_neutral_persistence.test.sql` passa inteiro (45/45) e a asserção 7 de `security_hardening.test.sql` passa (a 12 segue como o achado antigo)
- [ ] O pgTAP 75, do ticket 13, rodado a partir do arquivo da branch dele, continua passando
- [ ] `get_advisors` de segurança no DEV sem alerta novo em relação a antes da migration
- [ ] Roteiro manual no DEV feito e registrado
- [ ] `CONTEXT.md` e `docs/modelagem_banco.md` atualizados
- [ ] `npm run lint`, `npm test` e `npm run build` passam (nenhum código de tela muda neste ticket)
