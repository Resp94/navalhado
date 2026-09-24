# 02: "Esqueci minha senha" chega com o e-mail novo no DEV

**What to build:** quem pede "Esqueci minha senha" no DEV recebe o e-mail "Redefina sua senha" com a marca do Navalhado, enviado pela Edge Function do Send Email Hook, e o botão leva à tela de redefinição. É a primeira fatia completa: layout compartilhado, template de redefinição, handler inteiro (assinatura, envio, respostas, idempotência, logs), preview local, logo publicada, deploy e hook configurado. Nesta fatia só `recovery` é suportado; qualquer outro tipo devolve erro explícito.

**Blocked by:** 01; configuração manual do usuário (chave `hook.dev` no Resend, secrets e hook no dashboard do Supabase)

**Status:** done

- [x] Template de redefinição e layout com o visual e o texto da spec 049, conferidos no preview local em largura de celular e de desktop
- [x] Testes Deno no handler cobrem: `recovery` com 200 e a chamada certa ao Resend (remetente, assunto, link com `type=recovery`, `redirect_to` codificado, logo pela origem de `redirect_to`), tipo não suportado, assinatura inválida, secret ausente, Resend 5xx/429 com 503 e `retry-after`, Resend 4xx sem retry, `Idempotency-Key` igual ao `webhook-id`, logs sem token
- [x] Logo publicada: merge na `dev` e push feitos, deploy da Cloudflare confirmado (~90s); `dev.navalhado.com.br/email/logo.png` responde 200 com `image/png`
- [x] Usuário criou a chave `hook.dev` e cadastrou `RESEND_API_KEY`, `AUTH_EMAIL_FROM` e `SEND_EMAIL_HOOK_SECRET`; existência da chave conferida pelo conector do Resend, sem ver o valor
- [x] Função publicada no DEV sem verificação de JWT e sem os arquivos de teste; hook Send Email criado pelo usuário apontando para ela
- [x] Prova com e-mail real: o e-mail chega com o visual aprovado, logo incluída, o botão leva ao link de verificação com `type=recovery`, o Resend registra o remetente `noreply@dev.navalhado.com.br` e `delivered`, e o log da função não traz token
- [x] Volta atrás provada: hook desligado → "Esqueci minha senha" saiu pelo SMTP com o template antigo em inglês ("Reset your password"); hook religado → voltou a usar o template novo ("Redefina sua senha do Navalhado")
- [x] `npm run lint`, `npm test` e `npm run build` passam

## Resultado (2026-09-24)

Publicada no DEV (`selvxobcjbkligxighlp`), hook Send Email criado pelo usuário apontando para `https://selvxobcjbkligxighlp.supabase.co/functions/v1/send-auth-email`. 10 testes Deno do handler passam; `npm run lint`, `npm test` (1316 testes) e `npm run build` passam.

**Prova de ponta a ponta:** sem usuário real no DEV com o e-mail do usuário para testar `/recover` sem alterar dados, foi criado um usuário de teste direto por SQL (`auth.users` + `auth.identities`, já confirmado) com `resplandesjonathas7@gmail.com`. Dois problemas apareceram e foram corrigidos nesta prova, não previstos na spec:

1. **`confirmation_token` e colunas irmãs não podem ser `NULL`.** Um insert manual em `auth.users` sem essas colunas em `''` (string vazia) quebra o GoTrue (`converting NULL to string is unsupported`). Corrigido com um `update` preenchendo as colunas de token com `''`. Não afeta o código da função — é só sobre como criar usuário de teste por SQL.
2. **Achado real, corrigido no código:** a logo usava `email_data.site_url` do payload, como a spec propunha, mas `site_url` é a URL da própria API do GoTrue (`.../auth/v1`), não o site do app — o primeiro envio saiu com `src="https://selvxobcjbkligxighlp.supabase.co/auth/v1/email/logo.png"` (quebrado). Corrigido em `email.tsx` para usar a origem de `redirect_to` (`new URL(redirectTo).origin`), que reflete o domínio do app (confirmado: `https://dev.navalhado.com.br`). Reenviado depois da correção — `src="https://dev.navalhado.com.br/email/logo.png"`, certo.

Com a correção, o e-mail chegou (`Status: delivered`, Resend), com assunto, título, texto, botão e link de verificação corretos. A imagem da logo ainda não carrega porque `public/email/logo.png` só existe na branch local — falta o merge e push para a `dev` publicarem o arquivo no Cloudflare (confirmado: `dev.navalhado.com.br/email/logo.png` hoje devolve o `index.html` da SPA, não a imagem).

**Concluído depois, com o usuário:**
- Merge (`feat/emails-auth-react-email` → `dev`, fast-forward) e push. Deploy da Cloudflare confirmado; logo no ar.
- Volta atrás provada nos dois sentidos: hook desligado → SMTP com template antigo (achado à parte: a credencial do SMTP do dev deu `535 Authentication credentials invalid` na primeira tentativa, passageiro — funcionou no reteste); hook religado → template novo de novo.
- Usuário de teste (`3a0b1b8b-fe4f-4a94-9adc-296bcdc1a0fa`) removido de `public.users`, `auth.identities` e `auth.users`.

**Ticket 02 concluído.**
