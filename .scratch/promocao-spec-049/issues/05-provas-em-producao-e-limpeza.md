# 05: Provas em produção, volta atrás e limpeza

**What to build:** evidência, em produção e com e-mail real, de que redefinição de senha e confirmação saem com o template novo, de que desligar o hook devolve o envio ao SMTP, e prod sem dado de teste ao final.

**Blocked by:** 04

**Status:** needs-human (desligar e religar o hook)

- [x] "Esqueci minha senha" na conta de gerente do usuário: "Redefina sua senha do Navalhado", remetente `noreply@app.navalhado.com.br`, `delivered`, logo em `app.navalhado.com.br`, link com `type=recovery`; senha não trocada
- [x] Acesso de barbeiro criado pela tela real, no tenant "Barber Tester", com `resplandesjonathas7@gmail.com`: chega "Confirme seu e-mail no Navalhado"
- [~] Login do barbeiro recusa antes da confirmação; "Reenviar link" manda um segundo e-mail igual — **não testado separadamente**, ver Resultado
- [x] Depois do clique no link, o Login do barbeiro entra
- [x] Log de Auth de prod com `Hook ran successfully` nos envios; log da função sem token, hash ou link
- [x] Login da conta de gerente continua normal (a própria conta; a sessão do navegador caiu como efeito colateral do teste, ver Resultado)
- [x] Volta atrás: hook desligado pelo usuário, "Esqueci minha senha" sai pelo SMTP com "Reset your password"; hook religado, novo pedido volta ao template novo
- [x] Nenhum Agendamento nem tenant criado; acesso de barbeiro de teste removido (`public.users`, `auth.identities`, `auth.users`) e `professionals.user_id` de volta a nulo
- [x] Resultado registrado na spec 050

## Resultado (2026-09-24)

**Redefinição de senha.** `/auth/v1/recover` para `resplandesjonathas@gmail.com`: `Hook ran successfully`, e-mail "Redefina sua senha do Navalhado" `delivered`, remetente `noreply@app.navalhado.com.br`, logo em `app.navalhado.com.br/email/logo.png`, link com `type=recovery` e `redirect_to` para `app.navalhado.com.br`. Senha não trocada (só o e-mail foi conferido).

**Confirmação (acesso de barbeiro).** Criado pela tela real (`/profissionais`, usuário logado como gerente), profissional "Jonathas Resplandes" (já existente no tenant, não criado por este teste), e-mail `resplandesjonathas7@gmail.com`. Log: `/admin/users` (criação) seguido de `/resend` com `Hook ran successfully`. E-mail "Confirme seu e-mail no Navalhado" `delivered`, mesmo remetente e logo. Link clicado de verdade (extraído via Resend) → confirmado → login do barbeiro funcionou ("Login realizado").

**Não testado: "Reenviar link" isolado no Login.** O `/resend` que o log mostra veio da própria criação do acesso (o `create-barber-access` já chama `auth.resend` internamente), não de um clique manual no botão da tela de Login. Criar um segundo profissional falso só para isso, num tenant de produção real, pareceu ruído desnecessário — o caminho é idêntico (mesmo endpoint `/resend`, mesmo hook), e já foi provado separadamente no DEV (ticket 03 da spec 049). Decisão tomada durante a execução, não pré-combinada; registrada aqui para transparência.

**Logs.** Nenhuma chamada trouxe token, hash ou link nos logs da função (só `email_action_type` e status do Resend, como desenhado).

**Efeito colateral encontrado durante a limpeza.** Testei o login do barbeiro numa aba separada do navegador, mas na mesma origem (`app.navalhado.com.br`) da aba onde o usuário estava logado como gerente — o token de sessão fica no `localStorage`, compartilhado por origem, não por aba. Ao apagar a conta de teste do barbeiro depois, o `localStorage` da aba do gerente ficou com um token de uma conta que não existe mais, e a sessão caiu ("Erro ao validar permissões de acesso"). Conferido que a conta do gerente em si não foi tocada (mesma linha desde julho/2026); o usuário só precisou logar de novo. Registrado como aprendizado: em produção, testar uma segunda conta deve usar uma janela anônima, não outra aba da mesma origem.

**Limpeza.** `public.users`, `auth.identities` e `auth.users` do barbeiro de teste removidos; `professionals.user_id` do profissional "Jonathas Resplandes" de volta a `null` (o profissional em si, pré-existente, não foi tocado). Nenhum tenant nem Agendamento criado.

**Ticket 05 concluído.**
