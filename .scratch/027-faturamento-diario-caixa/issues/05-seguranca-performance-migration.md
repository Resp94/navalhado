# 05 — Segurança, performance e migration versionada

**What to build:** O novo resumo financeiro fica protegido por tenant e papel, consulta o banco com plano adequado e recebe somente as migrations necessárias, todas versionadas e verificadas primeiro em desenvolvimento.

**Blocked by:** 01 — MVP de faturamento diário no Caixa; 03 — Detalhamento de sessões que atravessam dias

**Status:** ready-for-agent

- [ ] Confirmar autenticação, papel financeiro e pertencimento ao tenant na consulta privilegiada, caso uma RPC seja necessária.
- [ ] Revogar acesso para `PUBLIC` e `anon` quando aplicável e manter `search_path` seguro.
- [ ] Confirmar que RLS e grants continuam compatíveis com o acesso do gerente e proprietário.
- [ ] Executar `EXPLAIN` em desenvolvimento para a consulta diária antes de criar índices.
- [ ] Criar índices somente se houver evidência de necessidade, considerando tenant e timestamp.
- [ ] Criar migration com numeração alinhada à linha cronológica vigente se houver alteração de schema, RPC ou índice.
- [ ] Aplicar a migration primeiro em dev usando MCP e verificar o resultado com consultas de leitura.
- [ ] Consultar advisors antes e depois e confirmar que nenhum novo problema relevante foi introduzido.
- [ ] Não remover índices existentes somente por aparecerem como não utilizados.
- [ ] Não alterar dados de produção durante os testes.
