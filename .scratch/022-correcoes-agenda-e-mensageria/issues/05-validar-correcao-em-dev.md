# 05 — Validar correções integralmente em DEV

**What to build:** uma versão candidata validada no ambiente DEV, com banco, frontend e Edge Functions coerentes com a spec e com os snapshots de regressão.

**Blocked by:** 02 — Corrigir grade temporal por tenant; 03 — Tornar templates e palavras-chave persistentes; 04 — Corrigir renderização do link e matching do primeiro contato.

**Status:** ready-for-agent

- [ ] Todas as migrations necessárias, se houver, são novas, versionadas, aplicadas primeiro em DEV e verificadas após a aplicação.
- [ ] Nenhuma migration existente foi editada, renomeada ou reaplicada.
- [ ] A Edge Function validada é publicada em DEV sem alterar secrets, autenticação ou o adapter UAZAPI.
- [ ] Testes focados de Agenda, templates e primeiro contato passam.
- [ ] Suítes existentes de frontend, Edge Function e banco passam, sem regressão nos itens funcionais dos snapshots.
- [ ] Lint, typecheck, build e verificação de whitespace passam, considerando apenas avisos já conhecidos.
- [ ] Smoke funcional em DEV confirma Agenda desktop/mobile, templates, palavras-chave, Canal do Cliente e fluxos WhatsApp aplicáveis.
- [ ] Banco DEV e código candidato são registrados com evidência suficiente para a promoção, sem dados operacionais de DEV serem copiados para PROD.
- [ ] Se qualquer gate falhar, a promoção fica bloqueada até a causa ser corrigida e revalidada.
