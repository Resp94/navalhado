# 02 — Ativação Real na VPS, Invocação Direta do QR Code e Toasts no Frontend (Whatsapp.tsx)

**What to build:** No componente `Whatsapp.tsx`:
1. O botão "Ativar Integração do WhatsApp" insere a linha no banco local e invoca a Edge Function (`action: 'create'`) para criar a instância de fato na VPS da Evolution API Go. Em caso de erro na VPS, o registro é removido (rollback) e um Toast de erro é exibido.
2. O botão "Gerar QR Code de Conexão" invoca a Edge Function (`action: 'connect'`) diretamente. Em caso de erro na VPS, exibe Toast vermelho com a mensagem descritiva sem travar a interface em "Gerando código...".
3. O botão "Cancelar Pareamento / Desconectar" invoca a Edge Function (`action: 'disconnect'`), encerrando a sessão física na VPS.

**Blocked by:** 01 — Validação Estrita de Role (Somente Gerente) e Fallback com Rollback na Edge Function

**Status:** ready-for-agent

- [ ] `handleCreateInstance()` em `Whatsapp.tsx` faz o insert local e chama `manage-instance` (`action: 'create'`).
- [ ] Se a criação na VPS falhar, deleta a linha recém-inserida do banco local e exibe Toast de erro.
- [ ] `handleConnect()` em `Whatsapp.tsx` faz o update para `pairing` e invoca `manage-instance` (`action: 'connect'`).
- [ ] Prioriza a mensagem de erro retornada no corpo da Edge Function no Toast vermelho.
- [ ] `handleDisconnect()` em `Whatsapp.tsx` chama `manage-instance` (`action: 'disconnect'`).
