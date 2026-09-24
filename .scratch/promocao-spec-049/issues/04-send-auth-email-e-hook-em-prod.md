# 04: `send-auth-email` e Send Email Hook em prod

**What to build:** a função publicada em prod e o hook ligado, com chave e secrets próprios de prod, sem que nenhum valor sensível passe pela conversa.

**Blocked by:** 03

**Status:** done

- [x] `send-auth-email` publicada em `boakqstrdfqmsrwnjore` com os arquivos da `main` (sem testes, sem `deno.lock`, sem `emails/static/`), entrada `index.tsx`, mapa `deno.json`, `verify_jwt: false`
- [x] Usuário cria a chave `hook.prod` no Resend ("Sending access", domínio `app.navalhado.com.br`); existência conferida pelo conector, sem ver o valor
- [x] Usuário cadastra `RESEND_API_KEY` e `AUTH_EMAIL_FROM` (`Navalhado <noreply@app.navalhado.com.br>`) nos secrets de prod
- [x] Usuário cria o Send Email hook (HTTPS, URL da função de prod), gera o secret e o cadastra em `SEND_EMAIL_HOOK_SECRET`
- [x] SMTP, templates do dashboard e chave `prod.nav` intocados
- [x] Resultado registrado na spec 050

## Resultado (2026-09-24)

Deploy da `send-auth-email` em prod (`boakqstrdfqmsrwnjore`), versão 1, `ACTIVE`. `ezbr_sha256` idêntico ao publicado no dev (`4ad20617...`) — mesmo conteúdo, sem diferença.

Usuário criou a chave `hook.prod` no Resend (confirmada pelo conector, `list-api-keys`, criada às 12:44 UTC) e cadastrou os 3 secrets e o hook. Conferido sem ver nenhum valor: chamada de teste à função com assinatura propositalmente errada devolveu `400 "Assinatura inválida."`, não `"Serviço temporariamente indisponível."` — prova que os 3 secrets (`RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `SEND_EMAIL_HOOK_SECRET`) estão cadastrados, sem disparar e-mail nenhum. Se algum estivesse faltando, a resposta teria sido a de configuração ausente.

SMTP, templates do dashboard e `prod.nav` não foram tocados.

**Ainda não provado:** se o hook do dashboard está de fato apontando para essa função (só um envio real confirma, no ticket 05).
