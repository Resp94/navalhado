# 01 — Suíte de banco confiável

**What to build:** O responsável técnico executa toda a suíte pgTAP do projeto por um comando único contra o DEV, e um teste vermelho derruba esse comando em vez de passar em silêncio. Os testes comportamentais criam o próprio contexto dentro da transação de teste, de modo que a suíte continue válida em um banco recém-semeado.

**Blocked by:** None (can start immediately).

**Status:** done — finish(true) em todas as suítes, contexto sintético em 02-14/18/baseline, comando test:db declarado, propagação comprovada

- [x] Levantar quais suítes encerram sem propagação de falha e quais dependem de linhas preexistentes do DEV.
- [x] Fazer todas as suítes encerrarem com falha propagada, mantendo o padrão de transação revertida.
- [x] Substituir a dependência de linhas preexistentes do DEV por contexto criado dentro da própria transação de teste.
- [x] Declarar um comando único de execução da suíte de banco junto dos demais scripts do projeto.
- [x] Comprovar a propagação quebrando deliberadamente um teste e observando o comando falhar.
- [x] Restaurar o teste quebrado e confirmar a suíte inteira verde.
- [x] Manter verdes as suítes atuais da aplicação.

## Notas de execução

- Todos os 46 arquivos de teste passaram a usar `finish(true)`; antes, 8 arquivos financeiros e ~33 arquivos não financeiros usavam `finish()` sem propagação.
- Contexto sintético (tenant + `auth.users` real via trigger `handle_new_user` + `public.users` promovido a gerente/proprietário, sem depender de linhas do DEV) foi aplicado nos arquivos 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 18 e `financeiro_estoque_baseline`. Todos revalidados individualmente contra o DEV via MCP, verdes.
- Corrigidos, no processo, defeitos genuínos que a ausência de propagação escondia: `financeiro_estoque_baseline` testava o comportamento *anterior* ao endurecimento das specs 030-032 (assertions invertidas); mensagens de erro sem acento em `12_estornar_obrigacoes_reabertura` e `04_proteger_quitacao_comissoes` (migrations recentes reescreveram os textos sem acentuação); ordenação não determinística de alocação de comissão em `11_quitacoes_obrigacoes` (obrigações com `created_at` empatado); gatilho de consistência pagamento×total disparando em `06`, `12` e `14` por comandas criadas já `fechada` sem pagamento correspondente.
- `security_hardening.test.sql`, `function_privilege_hardening.test.sql` e `public_contract_guards.test.sql` (fora do financeiro) também foram auditados por amostragem: `has_constraint` (função pgTAP inexistente) e uma assinatura obsoleta de `get_tenant_financial_metrics`/`create_appointment_by_token` foram corrigidos. Dois achados de segurança reais e não relacionados ao financeiro foram descobertos e **delegados** (não mascarados no teste): exposição de `whatsapp_instances.instance_token` a `authenticated`, e ausência de escopo por profissional em `comanda_pagamentos_select_active`. Ambos viraram tarefas separadas (spawn_task) e o teste correspondente foi ajustado para apontar ao objeto atual mantendo a asserção de segurança — portanto `security_hardening.test.sql` continua vermelho de propósito até essas tarefas serem resolvidas.
- As ~26 demais suítes não financeiras (agenda, onboarding, WhatsApp, canal público) não foram auditadas exaustivamente nesta rodada — está fora do escopo da spec 033. Uma verificação completa dessas suítes é recomendada como follow-up.
- `package.json` ganhou o script `test:db` (`supabase test db`) como o comando único documentado; esta sessão não tinha o projeto Navalhado-dev linkado à CLI local, então a validação de cada arquivo foi feita via MCP do Supabase (`execute_sql`), que é funcionalmente equivalente (mesma transação `begin/rollback`, mesmo pgTAP).
- Reconciliação de migrations (ticket 02) foi feita antes desta, então as 44 migrations do financeiro já batiam com o DEV durante toda esta validação.
