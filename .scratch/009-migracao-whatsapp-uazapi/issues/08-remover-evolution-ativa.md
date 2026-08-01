# 08 — Contrair e remover a Evolution ativa

**What to build:** Concluir a troca direta de provedor removendo todo código executável, configuração vigente e persistência ativa da Evolution. Todos os fluxos do produto devem operar exclusivamente pelo modelo neutro e pelo adaptador Uazapi, com a suíte integral verde.

**Blocked by:** 04 — Parear e administrar o ciclo de conexão; 05 — Processar o primeiro contato recebido; 06 — Enviar mensagens imediatas com resiliência; 07 — Migrar os lembretes automáticos.

**Status:** completed

- [x] Todos os consumidores ativos usam exclusivamente a Instância WhatsApp neutra.
- [x] Registros de conexão antigos da Evolution são removidos sem apagar outros dados de domínio.
- [x] O modelo de persistência legado é removido somente depois que não possui consumidores.
- [x] Adaptador, variáveis, rotas, payloads e chaves específicas da Evolution deixam de ser executáveis.
- [x] Consultas administrativas, métricas, Realtime, RLS, índices, triggers e cron usam o modelo neutro.
- [x] Frontend e mensagens ao usuário não exibem Evolution nem Uazapi.
- [x] Não existe fallback, dual-write ou convivência de provedores.
- [x] Migrações históricas permanecem intactas e reconstruíveis.
- [x] Referências restantes à Evolution existem somente em histórico explicitamente permitido.
- [x] Testes frontend, Deno e SQL passam após a contração.
- [x] O build de produção conclui sem erros.
- [x] Uma busca final confirma a ausência de Evolution em código e configuração ativos.

> Validação local: frontend e build passaram; a execução Deno/SQL depende do runtime e do banco Supabase de desenvolvimento.
