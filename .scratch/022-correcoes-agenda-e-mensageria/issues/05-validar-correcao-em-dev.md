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
- [x] Date picker do link público foi corrigido para receber o toque diretamente no input nativo em mobile, com teste de regressão passando.
- [ ] Smoke funcional em DEV confirma Agenda desktop/mobile, templates, palavras-chave, Canal do Cliente e fluxos WhatsApp aplicáveis.
- [x] Banco DEV e código candidato estão registrados com evidência suficiente para a promoção, sem dados operacionais de DEV serem copiados para PROD.
- [x] Teste 8 (isolamento por tenant) auditado somente no banco em DEV e PROD: tabelas críticas possuem RLS forçado, políticas com `get_auth_tenant_id()` e não há registros com `tenant_id` nulo ou órfão.
- [x] Teste 9 (persistência e rastreabilidade) auditado somente no banco em DEV e PROD: templates personalizados, estado de palavras-chave, `last_first_contact_at`, idempotência e outbox estão persistidos por tenant; os registros do outbox estão `succeeded` e os motivos de skip estão sanitizados.
- [x] Como o smoke funcional de navegador ainda não foi executado, a promoção permanece bloqueada até sua execução e revalidação.

## Result

- DEV Supabase: projeto `selvxobcjbkligxighlp` (`Navalhado-dev`), Edge Function `whatsapp-integration` publicada na versão 47.
- Código candidato: commit `0bf4898` na branch `dev`.
- Validações: frontend completo 53 arquivos/295 testes; Agenda/WhatsApp 58 testes; lint; typecheck/build; Edge Function 67 testes; whitespace.
- Avisos observados são preexistentes e limitados a hooks/mocks e ao tamanho do bundle.
- O diagnóstico no link publicado confirmou o defeito anterior: o `input[type=date]` tinha área mínima e `pointer-events: none`; a correção local transforma o controle nativo transparente no alvo de toque de toda a área do campo.
- Nenhuma migration nova foi criada ou aplicada; não houve qualquer alteração em PROD.
- Auditoria DB-only dos testes 8 e 9: DEV (`Navalhado-dev`) e PROD (`Navalhado`) mantêm isolamento estrutural por tenant e persistência dos fluxos WhatsApp. PROD possui um registro antigo de idempotência `appointment_cancelled` ainda em `processing` (atualizado há aproximadamente 604 minutos), que fica registrado para investigação separada e não foi alterado nesta validação.
