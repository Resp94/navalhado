# 09: Fase 2: spike de confirmação para usuário criado pelo admin

**What to build:** a resposta à pergunta "um usuário criado pelo admin como não confirmado recebe o link de confirmação quando pedimos o reenvio do tipo `signup`?". A documentação do Supabase só descreve o reenvio de uma confirmação "existente". O resultado define como o ticket 10 envia o link ao barbeiro. Isto é um spike: o código de teste é descartável e o entregável é a recomendação registrada.

**Blocked by:** configuração manual do usuário no DEV: o Resend como SMTP próprio, com domínio verificado, e "Confirm email" ligado no Auth.

**Status:** needs-human (depende da configuração do Resend)

- [ ] No DEV, um usuário é criado pelo admin com `email_confirm: false` e um e-mail real do usuário
- [ ] O reenvio de confirmação do tipo `signup` é disparado, e fica registrado se o e-mail chegou e se o link confirma a conta
- [ ] Se não chegar, é testado o plano B: gerar o link pelo admin (`generateLink` do tipo `signup`) e enviar pelo Resend
- [ ] A recomendação é registrada na spec 047, com o caminho escolhido e a evidência
- [ ] O usuário de teste é removido do Auth do DEV no fim, com confirmação do usuário
