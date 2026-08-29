# 06 — Promover para main e PROD

**What to build:** a promoção controlada da versão aprovada em DEV para `main` e PROD, mantendo equivalência estrutural e funcional no escopo da correção.

**Blocked by:** 05 — Validar correções integralmente em DEV.

**Status:** ready-for-agent

- [ ] O HEAD de `dev`, o estado limpo e a sincronização remota são registrados antes do merge.
- [ ] O estado anterior de `main` é registrado e o merge `dev → main` ocorre sem force e sem resolução automática de conflitos.
- [ ] Conflitos, se existirem, são analisados individualmente antes da conclusão do merge.
- [ ] Testes, lint, typecheck, build e verificações relevantes passam novamente em `main` após o merge.
- [ ] PROD recebe apenas migrations ausentes e já validadas em DEV, na ordem correta e sem alterações manuais não versionadas.
- [ ] A mesma versão aprovada da Edge Function é publicada em PROD, preservando UAZAPI, secrets, tenant isolation, retry e idempotência.
- [ ] DEV e PROD são comparados em tabelas, colunas, constraints, índices, RPCs, functions, triggers, RLS/policies e objetos relacionados ao escopo.
- [ ] Smoke funcional pós-promoção confirma Agenda, templates, palavras-chave e fluxos WhatsApp sem regressão dos snapshots.
- [ ] O resultado final registra hashes, migrations, deploys, validações, divergências encontradas e situação de PROD.
