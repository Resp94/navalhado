# 01 — Validação Estrita de Role (Somente Gerente) e Fallback com Rollback na Edge Function

**What to build:** A rota `/manage-instance` na Supabase Edge Function `whatsapp-integration` (`selvxobcjbkligxighlp`) deve validar autorização via segredo `whatsapp_db_trigger_secret` ou JWT do usuário logado exigindo estritamente `profile.role === 'gerente'` e pertencimento ao mesmo tenant da instância. Requisições de outros perfis devem ser rejeitadas com HTTP 403. Caso a chamada para a VPS falhe no pareamento (`connect`), a função deve reverter o status da instância para `disconnected` no banco de dados e retornar HTTP 502 descritivo.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Rota `/manage-instance` valida o header `x-db-trigger-secret` (`whatsapp_db_trigger_secret`) ou Bearer JWT.
- [ ] Valida no banco `public.users` que `profile.role === 'gerente'` e `profile.tenant_id === instanceRow.tenant_id`.
- [ ] Rejeita qualquer outro perfil com HTTP 403 Forbidden ("Apenas gerentes possuem permissão para gerenciar a integração de WhatsApp.").
- [ ] Cria função auxiliar `revertInstanceToDisconnected` para atualizar `status = 'disconnected'` e `qr_code = null` no banco em caso de erro da VPS.
- [ ] Retorna resposta de erro estruturada com mensagem descritiva em HTTP 502.
