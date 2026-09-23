# 10: Fase 2: confirmação por link nos logins

**What to build:** os logins passam a provar que a caixa de e-mail existe.
- O gerente que cadastra a barbearia recebe de fato o link prometido na tela e só entra depois de confirmar.
- O barbeiro continua com e-mail e senha definidos pelo gerente, mas a conta nasce não confirmada, o barbeiro recebe o link, e a tela de Acesso avisa: "Acesso criado. O barbeiro precisa confirmar o e-mail antes do primeiro login."
- Quem ainda não confirmou vê, no Login, a ação "Reenviar link".
- Os usuários existentes continuam entrando, porque já estão confirmados.

**Blocked by:** 08, 09

**Status:** ready-for-agent (depois do 09)

- [ ] A Edge Function de Acesso do barbeiro cria a conta com `email_confirm: false` e dispara o link pelo caminho definido no ticket 09
- [ ] A tela de Acesso do barbeiro mostra o aviso de confirmação pendente depois de criar
- [ ] O Login mostra "Reenviar link" quando o erro é e-mail não confirmado, e a ação reenvia a confirmação
- [ ] O cadastro de barbearia com "Confirm email" ligado no DEV envia o link, e o login antes de confirmar mostra "Confirme seu e-mail antes de fazer login."
- [ ] Os usuários existentes no DEV continuam entrando sem mudança
- [ ] Os testes cobrem a Edge Function (conta não confirmada e disparo do link) e o Login ("Reenviar link")
- [ ] Verificado de ponta a ponta no DEV com e-mail real: barbeiro criado, link recebido, login liberado depois da confirmação
- [ ] `npm run lint`, `npm test` e `npm run build` passam
