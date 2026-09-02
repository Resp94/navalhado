# Relatório de auditoria Supabase e segurança

Data da auditoria: 2026-09-01  
Escopo: ambientes Supabase de desenvolvimento (`selvxobcjbkligxighlp`) e produção (`boakqstrdfqmsrwnjore`).

## Resumo executivo

Não foram aplicadas alterações no banco, migrations, Edge Functions ou aplicação. Os dois ambientes estão funcionalmente muito próximos e o schema efetivo está alinhado, mas existe um problema real de privilégio: `public.find_or_create_whatsapp_customer` é uma função `SECURITY DEFINER` executável por `public`, `anon` e `authenticated`, embora a migration de hardening determine que ela seja exclusiva de `service_role`. Como o corpo aceita `p_tenant_id`, telefone e nome sem validar o usuário chamador, uma chamada RPC direta pode criar clientes provisórios arbitrários em qualquer tenant conhecido.

Também foi identificado um registro de idempotência preso em `processing` na produção e diferenças de versão entre funções Edge, extensões e histórico de migrations. Essas diferenças não alteraram o schema efetivo auditado, mas reduzem a previsibilidade entre os ambientes.

### Atualização pós-auditoria — 2026-09-01

O achado `SEC-001` foi corrigido primeiro no Supabase dev pela migration versionada `092_revoke_public_whatsapp_customer_rpc_execute`. A chamada legítima com `service_role` foi validada e os indicadores de dados permaneceram inalterados.

Na sequência, a mesma migration foi aplicada no Supabase prod. A função agora está restrita a `service_role` nos dois ambientes; o advisor específico deixou de aparecer em ambos, e as chamadas controladas com `service_role` foram validadas sem inserção de dados.

## Inventário e paridade

- Ambos os projetos estão ativos e saudáveis, na região `sa-east-1`.
- Ambos possuem as mesmas 26 tabelas públicas, todas com RLS habilitado.
- Ambos possuem 85 políticas, 130 índices, 13 triggers e 37 funções públicas.
- Hashes de políticas, índices, triggers e RLS são iguais.
- As 37 funções públicas têm a mesma semântica após normalização de comentários e formatação; as diferenças observadas nos hashes brutos são de apresentação.
- A única diferença de colunas é a ordem de `created_at` e `ip_address` em `audit_logs`; tipos, nulabilidade e defaults são iguais.
- `pg_net`: dev `0.20.4`; prod `0.20.3`.
- Edge Function `public-customer-session`: dev versão 2; prod versão 1. O código normalizado é igual e ambas estão com `verify_jwt=false`.
- Edge Function `whatsapp-integration`: dev versão 50; prod versão 51. Os cinco arquivos e o código normalizado são iguais; o hash de implantação é diferente.
- O histórico de migrations não é espelhado: dev possui 69 registros e prod 92, embora o schema efetivo consultado esteja alinhado.

## Achados críticos e altos

### SEC-001 — Execução pública indevida de função SECURITY DEFINER

**Severidade:** Alta  
**Status:** Confirmado na captura original; corrigido em dev e prod pela migration `092`.

**Evidência:** `public.find_or_create_whatsapp_customer(uuid, text, text)` é `SECURITY DEFINER`, possui `search_path=""` e `proacl` concedendo `EXECUTE` a `public`, `anon`, `authenticated` e `service_role`. O corpo da função localiza ou insere um cliente pelo `tenant_id`, telefone e nome, sem verificar `auth.uid()`, JWT, role ou vínculo do chamador ao tenant.

A migration [`20260816080000_016_security_hardening_rls_granular_and_advisors_fix.sql`](supabase/migrations/20260816080000_016_security_hardening_rls_granular_and_advisors_fix.sql) nas linhas 49–50 determina o `REVOKE` para `PUBLIC`, `anon` e `authenticated` e o `GRANT` somente para `service_role`, mas o privilégio efetivo remoto não corresponde a essa intenção.

**Impacto:** um chamador que alcance o RPC pode inserir clientes provisórios arbitrários em um tenant informado. Isso permite poluição de dados, criação de registros falsos, possível aumento de custo operacional e interferência em fluxos de primeiro contato.

**Recomendação:** em uma mudança futura, revogar explicitamente `EXECUTE` de `PUBLIC`, `anon` e `authenticated` nos dois ambientes e manter somente `service_role`; confirmar que apenas a Edge Function de integração usa essa função. Depois, testar o webhook real e adicionar um teste de privilégio negativo. A correção deve ser uma migration versionada.

### SEC-002 — Superfície ampla de funções SECURITY DEFINER para o papel authenticated

**Severidade:** Média, com partes de alto impacto se houver falha de autorização interna.  
**Status:** Advisor presente igualmente em dev e prod.

O advisor encontrou 29 funções `SECURITY DEFINER` executáveis por `authenticated`. Como o fluxo público usa login anônimo do Supabase, o papel de banco do usuário anônimo também é `authenticated`. Muitas funções são intencionais e possuem validação no corpo: `start_public_customer_session`, `get_public_customer_session`, `get_public_customer_appointments`, cancelamento e reagendamento por sessão pública, além das funções por token.

A auditoria confirmou validações de sessão anônima, expiração, tenant e propriedade nas funções do portal público e validações de role/tenant nas operações administrativas principais. O risco residual é de manutenção: qualquer função nova ou alteração futura que esqueça essa validação ficará alcançável pelo fluxo anônimo.

**Recomendação:** manter públicas somente as RPCs explicitamente necessárias ao portal; revogar `EXECUTE` de funções internas e administrativas não utilizadas pelo cliente; criar uma matriz de funções × papel (`anon`, `authenticated`, `service_role`) e testes negativos.

## Achados médios

### REL-001 — Registro de idempotência preso em `processing` na produção

**Severidade:** Média.  
**Status:** Confirmado somente em prod.

Existe um registro de `appointment_cancelled` outbound com status `processing`, uma tentativa, criado em `2026-08-29 05:03:01+00` e sem erro registrado. O dev não possui registros `processing`.

**Impacto:** o evento pode não ser reenviado nem finalizado, deixando uma notificação sem resolução e dificultando a reconciliação da fila.

**Recomendação:** verificar a política de lease/retry e criar rotina segura de recuperação de registros antigos, com limite de tentativas e observabilidade. Não apagar o registro sem confirmar o evento externo.

### PAR-001 — Ambientes não são totalmente equivalentes como artefatos de execução

**Severidade:** Média/baixa.  
**Status:** Confirmado.

O schema efetivo está alinhado, mas as versões implantadas das Edge Functions, a versão patch de `pg_net` e o histórico de migrations diferem. As funções Edge comparadas possuem código normalizado igual, então não foi comprovada divergência funcional nesse código.

**Impacto:** uma nova implantação, rollback ou migration pode produzir resultados diferentes entre dev e prod, mesmo que o estado atual pareça equivalente.

**Recomendação:** definir um processo de promoção único, registrar migrations versionadas nos dois ambientes e comparar versões/artefatos antes de promover. Não fazer sincronização automática durante esta auditoria.

### SEC-003 — Webhook desabilita a validação JWT padrão e aceita fallback por nome da instância

**Severidade:** Média para revisão; não confirmado como exploração.

`whatsapp-integration` está com `verify_jwt=false` nos dois ambientes, necessário para receber webhook externo. O código valida o token da instância quando presente, mas também tenta localizar a instância pelo `instanceName` quando o token não foi encontrado (`supabase/functions/whatsapp-integration/index.ts`, rota `/webhook` iniciada na linha 1013).

**Impacto potencial:** se o nome da instância puder ser descoberto ou adivinhado, o fallback por identificador não secreto pode reduzir a garantia de autenticidade do webhook.

**Recomendação:** exigir sempre um segredo/token de webhook validado, usar comparação segura quando aplicável e remover o fallback por nome isolado, após confirmar o contrato da Uazapi. Validar isso em ambiente de desenvolvimento antes da promoção.

## Achados baixos e informativos

### PERF-001 — Duas foreign keys sem índice de cobertura

**Severidade:** Baixa/Informativa.

O advisor apontou as FKs de `public_customer_sessions.tenant_id` e `whatsapp_message_outbox.customer_id` em ambos os ambientes. O impacto é de performance em joins, deletes/updates do pai ou consultas específicas; não é vulnerabilidade.

**Recomendação:** adicionar índices somente após verificar consultas e planos reais. A regra relevante é [Unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

### PERF-002 — Índices sem uso observado

**Severidade:** Informativa.

O advisor apontou 32 índices no dev e 37 no prod. Esse diagnóstico depende das estatísticas e do período observado; não justifica remoção em massa.

**Recomendação:** medir uso e planos de consulta por um período representativo antes de remover qualquer índice. A regra relevante é [Unused index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

### SEC-004 — RLS habilitado sem policies em duas tabelas internas

**Severidade:** Informativa/Esperada.

`public.public_customer_sessions` e `public.whatsapp_message_outbox` têm RLS habilitado e zero policies. Como são tabelas de sessão/fila de backend, o resultado é deny-by-default para acesso direto da API; as Edge Functions usam `service_role`.

**Recomendação:** manter assim se o contrato continuar sendo backend-only e registrar essa decisão. A regra relevante é [RLS enabled no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

### SEC-005 — Proteção contra senhas vazadas desabilitada

**Severidade:** Baixa.

O advisor informa que a proteção de senha vazada do Auth está desabilitada. Isso não explica falhas no agendamento público, mas reduz a proteção caso o login por senha esteja habilitado.

**Recomendação:** habilitar após validar o impacto nos usuários existentes e no provedor de e-mail.

## Comportamentos esperados confirmados

- Login anônimo está habilitado para o portal público; isso é esperado, mas torna indispensável a autorização no corpo das RPCs.
- A policy anônima explícita encontrada é leitura de `plans`, compatível com catálogo/consulta pública.
- Todas as 26 tabelas públicas estão com RLS habilitado.
- A view pública `view_tenants_management` usa `security_invoker=true` e não possui leitura anônima.
- As funções do portal por slug, sessão anônima e token são públicas por desenho e possuem validações de sessão/token; o advisor, isoladamente, não significa que sejam vulnerabilidades.

## Integridade dos dados auditada

| Indicador | Dev | Prod | Avaliação |
|---|---:|---:|---|
| Clientes | 5 | 41 | volume esperado para os ambientes |
| Clientes provisórios | 1 | 10 | nenhum com mais de 7 dias |
| Grupos duplicados por telefone normalizado | 0 | 0 | sem duplicidade detectada |
| Agendamentos sem cliente | 2 | 2 | compatível com o fluxo de encaixe/atendimento sem cliente |
| Outbox pendente/em processamento | 0 | 0 | sem pendência na outbox |
| Idempotência em `processing` | 0 | 1 | pendência antiga somente em prod |
| Idempotência em `failed` | 2 | 19 | histórico; requer acompanhamento, não apagamento automático |
| Sessões expiradas | 0 | 0 | sem acúmulo expirado |

Os erros de primeiro contato encontrados na produção são históricos; as falhas terminam em `2026-08-31 16:18:57 UTC` e há sucessos posteriores até `2026-09-01 11:48:30 UTC`. O comportamento `skipped: already sent today without keyword` é deduplicação esperada, não falha.

## Varredura complementar da aplicação React

- Não foram encontrados `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `document.write` ou `postMessage` no código da aplicação auditado.
- Não foi encontrada chave `SUPABASE_SERVICE_ROLE` sendo usada no código entregue ao navegador. As variáveis `VITE_SUPABASE_*` e `VITE_TURNSTILE_SITE_KEY` são públicas por natureza.
- O fluxo legado mantém token de cliente em `localStorage` em `src/modules/canal-cliente/adapters/SupabaseCanalClienteAdapter.ts`, linhas 95–113. Isso é compatível com a retrocompatibilidade do canal por token, mas significa que um eventual XSS poderia ler esse token; manter a limpeza em sessão inválida e priorizar a sessão anônima do portal.
- `public/_headers` define CSP, clickjacking, `nosniff` e `Referrer-Policy`, mas usa `'unsafe-inline'` para scripts e estilos. Isso é um ponto de hardening de baixa prioridade; não foi validado aqui se o header publicado na borda é exatamente esse arquivo.

## Conclusão e ordem recomendada

1. Corrigir primeiro o privilégio de `find_or_create_whatsapp_customer` com migration versionada e teste negativo em dev/prod.
2. Reconciliar o registro `processing` antigo da produção sem apagar evidência.
3. Formalizar paridade de versões das Edge Functions, `pg_net` e migrations.
4. Revisar a matriz de `EXECUTE` das RPCs públicas e administrativas.
5. Revisar o fallback de autenticação do webhook.
6. Só depois avaliar índices e proteção contra senhas vazadas.

Nenhuma correção foi aplicada nesta auditoria.
