# 05 — Validar correções integralmente em DEV

**What to build:** uma versão candidata validada no ambiente DEV, com banco, frontend e Edge Functions coerentes com a spec e com os snapshots de regressão.

**Blocked by:** 02 — Corrigir grade temporal por tenant; 03 — Tornar templates e palavras-chave persistentes; 04 — Corrigir renderização do link e matching do primeiro contato.

**Status:** in-progress

- [x] Não foram necessárias migrations para esta correção; nenhuma alteração de schema foi introduzida.
- [x] Nenhuma migration existente foi editada, renomeada ou reaplicada.
- [x] A Edge Function validada foi publicada em DEV (versão 47) sem alterar secrets, autenticação ou o adapter UAZAPI.
- [x] Testes focados de Agenda, templates e primeiro contato passam.
- [x] Suítes existentes de frontend e Edge Function passam, sem regressão nos itens funcionais dos snapshots.
- [x] Lint, typecheck, build e verificação de whitespace passam, considerando apenas avisos já conhecidos.
- [ ] Smoke funcional em DEV confirma Agenda desktop/mobile, templates, palavras-chave, Canal do Cliente e fluxos WhatsApp aplicáveis.
- [x] Banco DEV e código candidato estão registrados com evidência suficiente para a promoção, sem dados operacionais de DEV serem copiados para PROD.
- [x] Como o smoke funcional de navegador ainda não foi executado, a promoção permanece bloqueada até sua execução e revalidação.

## Result

- DEV Supabase: projeto `selvxobcjbkligxighlp` (`Navalhado-dev`), Edge Function `whatsapp-integration` publicada na versão 47.
- Código candidato: commit `0bf4898` na branch `dev`.
- Validações: frontend completo 53 arquivos/295 testes; Agenda/WhatsApp 58 testes; lint; typecheck/build; Edge Function 67 testes; whitespace.
- Avisos observados são preexistentes e limitados a hooks/mocks e ao tamanho do bundle.
- Nenhuma migration nova foi criada ou aplicada; não houve qualquer alteração em PROD.
