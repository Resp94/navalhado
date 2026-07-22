# 02 — Invocação Direta da Edge Function e Exibição de Toast no Frontend (Whatsapp.tsx)

**What to build:** O botão "Gerar QR Code de Conexão" na página do gerente (`/whatsapp`) deve invocar diretamente a Supabase Edge Function `whatsapp-integration/manage-instance` com `action: 'connect'`. Caso a invocação falhe ou a VPS retorne erro, o painel deve exibir um Toast explicativo para o Gerente sem travar a interface em "Gerando código...".

**Blocked by:** 01 — Autenticação JWT e Fallback de Erro na Edge Function (/manage-instance)

**Status:** done

- [x] `handleConnect()` em `Whatsapp.tsx` faz o update para `pairing` e invoca `supabase.functions.invoke('whatsapp-integration/manage-instance')`.
- [x] Se a invocação for bem sucedida, exibe Toast informativo.
- [x] Se a invocação falhar ou retornar erro, captura o erro e exibe Toast vermelho com a mensagem.
- [x] Botão e tela tratam o estado de carregamento sem travar a UI.
