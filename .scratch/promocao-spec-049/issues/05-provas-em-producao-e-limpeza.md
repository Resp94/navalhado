# 05: Provas em produção, volta atrás e limpeza

**What to build:** evidência, em produção e com e-mail real, de que redefinição de senha e confirmação saem com o template novo, de que desligar o hook devolve o envio ao SMTP, e prod sem dado de teste ao final.

**Blocked by:** 04

**Status:** needs-human (desligar e religar o hook)

- [ ] "Esqueci minha senha" na conta de gerente do usuário: "Redefina sua senha do Navalhado", remetente `noreply@app.navalhado.com.br`, `delivered`, logo em `app.navalhado.com.br`, link com `type=recovery`; senha não trocada
- [ ] Acesso de barbeiro criado pela tela real, no tenant "Barber Tester", com o alias do ticket 01: chega "Confirme seu e-mail no Navalhado"
- [ ] Login do barbeiro recusa antes da confirmação; "Reenviar link" manda um segundo e-mail igual (respeitando os 25 s do GoTrue)
- [ ] Depois do clique no link, o Login do barbeiro entra
- [ ] Log de Auth de prod com `Hook ran successfully` nos envios; log da função sem token, hash ou link
- [ ] Login da conta de gerente continua normal
- [ ] Volta atrás: hook desligado pelo usuário, "Esqueci minha senha" sai pelo SMTP com "Reset your password"; hook religado, novo pedido volta ao template novo
- [ ] Nenhum Agendamento nem tenant criado; acesso de barbeiro de teste removido (`public.users`, `auth.identities`, `auth.users`) e `professionals.user_id` de volta a nulo
- [ ] Resultado registrado na spec 050
