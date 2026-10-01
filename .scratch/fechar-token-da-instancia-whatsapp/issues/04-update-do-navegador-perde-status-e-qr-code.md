# 04: O UPDATE do navegador perde `status` e `qr_code` (passo 2)

Parte da spec 053 (Fechar o token da Instância WhatsApp no navegador).

**What to build:** o navegador passa a gravar só configuração em `whatsapp_instances`. `status` e `qr_code` ficam por conta do servidor.

- **Migration** `053_ticket04_update_do_navegador_so_configuracao`, no DEV: `revoke update (status, qr_code) on public.whatsapp_instances from authenticated;`. Funciona porque o ticket 02 concedeu essas duas colunas por coluna, e não pela tabela.
- **pgTAP 76** atualizado: o conjunto de colunas com UPDATE passa a ser exatamente as 16 de configuração (flags, `reminder_hours`, os nove modelos, `auto_reply_keywords` e `updated_at`); como Gerente, atualizar `status` e `qr_code` dá 42501; atualizar modelo continua funcionando; ler `status` e `qr_code` continua funcionando; as asserções do Gerente com `tenant_id` nulo, do Barbeiro, do Proprietário e do `anon` continuam valendo.
- A migration só vai depois de a tela e a Edge Function do ticket 03 estarem no ar no ambiente: uma aba aberta com a tela antiga daria 42501 ao conectar ou desconectar até recarregar.

**Blocked by:** 02 (Fechar as colunas da instância no banco), 03 (A tela deixa de gravar `status` e `qr_code`)

**Status:** ready-for-agent

- [ ] Ticket 03 publicado no DEV (tela e Edge Function) e conferido antes de aplicar a migration
- [ ] pgTAP 76 atualizado e visto falhar antes da migration
- [ ] Migration aplicada no DEV; `has_column_privilege` de UPDATE para `authenticated` = as 16 colunas de configuração
- [ ] pgTAP 76 passa; `whatsapp_neutral_persistence.test.sql` e a asserção 7 de `security_hardening.test.sql` continuam passando
- [ ] Roteiro manual no DEV: "Gerar QR Code de Conexão" mostra o QR, o status muda em tempo real, salvar modelo e ligar ou desligar um envio funcionam, Admin > Tenants mostra o status
- [ ] `npm run lint`, `npm test` e `npm run build` passam
