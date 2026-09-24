# 02: "Esqueci minha senha" chega com o e-mail novo no DEV

**What to build:** quem pede "Esqueci minha senha" no DEV recebe o e-mail "Redefina sua senha" com a marca do Navalhado, enviado pela Edge Function do Send Email Hook, e o botão leva à tela de redefinição. É a primeira fatia completa: layout compartilhado, template de redefinição, handler inteiro (assinatura, envio, respostas, idempotência, logs), preview local, logo publicada, deploy e hook configurado. Nesta fatia só `recovery` é suportado; qualquer outro tipo devolve erro explícito.

**Blocked by:** 01; configuração manual do usuário (chave `hook.dev` no Resend, secrets e hook no dashboard do Supabase)

**Status:** needs-human (chave, secrets e hook), depois ready-for-agent

- [ ] Template de redefinição e layout com o visual e o texto da spec 049, conferidos no preview local em largura de celular e de desktop
- [ ] Testes Deno no handler cobrem: `recovery` com 200 e a chamada certa ao Resend (remetente, assunto, link com `type=recovery`, `redirect_to` codificado, logo pelo `site_url`), tipo não suportado, assinatura inválida, secret ausente, Resend 5xx/429 com 503 e `retry-after`, Resend 4xx sem retry, `Idempotency-Key` igual ao `webhook-id`, logs sem token
- [ ] Logo publicada: merge na `dev` e push, com pedido do usuário; o endereço da logo no domínio do dev responde 200 com `image/png`
- [ ] Usuário cria a chave `hook.dev` ("Sending access", domínio `dev.navalhado.com.br`) e cadastra `RESEND_API_KEY`, `AUTH_EMAIL_FROM` e `SEND_EMAIL_HOOK_SECRET`; existência da chave conferida pelo conector do Resend, sem ver o valor
- [ ] Função publicada no DEV sem verificação de JWT e sem os arquivos de teste; hook Send Email criado pelo usuário apontando para ela
- [ ] Prova com e-mail real: o e-mail chega com o visual aprovado e a logo, o botão leva à tela de redefinição, a troca de senha funciona, o Resend registra o remetente `noreply@dev.navalhado.com.br` e `delivered`, e o log da função não traz token
- [ ] Hook desligado depois da prova (a confirmação ainda não é suportada)
- [ ] `npm run lint`, `npm test` e `npm run build` passam
