# 08 — Contrair e remover a Evolution ativa

**What to build:** Concluir a troca direta de provedor removendo todo código executável, configuração vigente e persistência ativa da Evolution. Todos os fluxos do produto devem operar exclusivamente pelo modelo neutro e pelo adaptador Uazapi, com a suíte integral verde.

**Blocked by:** 04 — Parear e administrar o ciclo de conexão; 05 — Processar o primeiro contato recebido; 06 — Enviar mensagens imediatas com resiliência; 07 — Migrar os lembretes automáticos.

**Status:** ready-for-agent

- [ ] Todos os consumidores ativos usam exclusivamente a Instância WhatsApp neutra.
- [ ] Registros de conexão antigos da Evolution são removidos sem apagar outros dados de domínio.
- [ ] O modelo de persistência legado é removido somente depois que não possui consumidores.
- [ ] Adaptador, variáveis, rotas, payloads e chaves específicas da Evolution deixam de ser executáveis.
- [ ] Consultas administrativas, métricas, Realtime, RLS, índices, triggers e cron usam o modelo neutro.
- [ ] Frontend e mensagens ao usuário não exibem Evolution nem Uazapi.
- [ ] Não existe fallback, dual-write ou convivência de provedores.
- [ ] Migrações históricas permanecem intactas e reconstruíveis.
- [ ] Referências restantes à Evolution existem somente em histórico explicitamente permitido.
- [ ] Testes frontend, Deno e SQL passam após a contração.
- [ ] O build de produção conclui sem erros.
- [ ] Uma busca final confirma a ausência de Evolution em código e configuração ativos.

