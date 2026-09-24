# 03: Confirmação de e-mail chega com o e-mail novo no DEV

**What to build:** o dono de barbearia que se cadastra, o barbeiro cujo acesso o gerente criou e quem usa "Reenviar link" no Login recebem o e-mail "Confirme seu e-mail" com a marca do Navalhado, e o botão confirma e leva ao Login. Com isso o hook do DEV fica ligado de vez, e a volta atrás (desligar o hook) fica provada.

**Blocked by:** 02

**Status:** ready-for-agent (depois do 02)

- [ ] Template de confirmação com o texto único da spec 049, conferido no preview local
- [ ] Testes Deno no handler cobrem `signup` com 200 e a chamada certa ao Resend (assunto de confirmação, link com `type=signup`)
- [ ] Função republicada no DEV e hook ligado
- [ ] Prova com e-mail real nos três fluxos (cadastro de barbearia, "Reenviar link" e acesso de barbeiro criado pelo gerente): e-mail com o visual aprovado, um e-mail por pedido, clique confirma e cai no Login, login liberado depois
- [ ] "Esqueci minha senha" continua funcionando com o hook ligado
- [ ] Volta atrás: com o hook desligado, "Esqueci minha senha" sai pelo SMTP; hook religado em seguida
- [ ] Nenhum Agendamento criado; usuários de teste removidos no fim, com confirmação do usuário
- [ ] Resultado registrado na spec 049
- [ ] `npm run lint`, `npm test` e `npm run build` passam
