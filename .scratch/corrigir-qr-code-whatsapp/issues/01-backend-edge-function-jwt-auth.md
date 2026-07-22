# 01 — Autenticação JWT e Fallback de Erro na Edge Function (/manage-instance)

**What to build:** A rota `/manage-instance` na Supabase Edge Function `whatsapp-integration` deve aceitar autenticação via JWT Bearer do usuário Gerente logado além do segredo da trigger Postgres. Caso a chamada para a VPS falhe na ação `connect`, a Edge Function deve reverter o status da instância para `disconnected` no banco de dados e retornar um erro descritivo HTTP 502.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Rota `/manage-instance` valida autorização por token JWT do usuário Supabase ou segredo da trigger.
- [x] Ao receber ação `connect`, tenta obter o QR Code da VPS Evolution API Go.
- [x] Se a VPS falhar ou retornar status não-200 (exceto se já conectada), atualiza `status = 'disconnected'` e `qr_code = null` no banco de dados.
- [x] Retorna resposta de erro estruturada com mensagem descritiva em HTTP 502.
