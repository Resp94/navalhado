# 04: `send-auth-email` e Send Email Hook em prod

**What to build:** a função publicada em prod e o hook ligado, com chave e secrets próprios de prod, sem que nenhum valor sensível passe pela conversa.

**Blocked by:** 03

**Status:** needs-human (chave no Resend, secrets e hook no dashboard)

- [ ] `send-auth-email` publicada em `boakqstrdfqmsrwnjore` com os arquivos da `main` (sem testes, sem `deno.lock`, sem `emails/static/`), entrada `index.tsx`, mapa `deno.json`, `verify_jwt: false`
- [ ] Usuário cria a chave `hook.prod` no Resend ("Sending access", domínio `app.navalhado.com.br`); existência conferida pelo conector, sem ver o valor
- [ ] Usuário cadastra `RESEND_API_KEY` e `AUTH_EMAIL_FROM` (`Navalhado <noreply@app.navalhado.com.br>`) nos secrets de prod
- [ ] Usuário cria o Send Email hook (HTTPS, URL da função de prod), gera o secret e o cadastra em `SEND_EMAIL_HOOK_SECRET`
- [ ] SMTP, templates do dashboard e chave `prod.nav` intocados
- [ ] Resultado registrado na spec 050
