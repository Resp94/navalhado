# 04: Formato rígido nos logins (gerente e barbeiro)

**What to build:** e-mail de login mal formado deixa de entrar por qualquer caminho. Hoje o e-mail de acesso do gerente só é validado no front, e o Acesso do barbeiro só confere se existe `@`, tanto na tela quanto na Edge Function. Depois deste ticket:
- `users` tem CHECK, e um cadastro feito direto pela API com e-mail mal formado falha no trigger;
- o Acesso do barbeiro aplica a regra única na tela e na Edge Function;
- Login e redefinição de senha usam o módulo de e-mail.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] O CHECK em `users.email` exige `public.email_valido(email)`, com `not valid` e depois `validate constraint`
- [ ] Um cadastro pelo Auth com e-mail de login mal formado é recusado, e nenhum usuário fica pela metade
- [ ] Login, redefinição de senha e o e-mail de acesso do cadastro de barbearia usam a validação do módulo
- [ ] A tela de Acesso do barbeiro troca a checagem de `@` pela validação do módulo
- [ ] A Edge Function de Acesso do barbeiro valida com a mesma regra, num arquivo de e-mail próprio, e responde 400 "Informe um e-mail válido." para formato inválido
- [ ] O teste Deno do arquivo de e-mail usa a mesma tabela de casos. Sem Deno local, a validação é feita chamando a função depois do deploy no DEV
- [ ] O pgTAP cobre o INSERT/UPDATE de `users` recusado e o cadastro recusado pelo trigger
- [ ] A migration e o deploy da Edge Function são feitos só no DEV; `get_advisors` sem alerta novo
- [ ] `npm run lint`, `npm test` e `npm run build` passam
