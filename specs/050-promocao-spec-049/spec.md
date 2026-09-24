# Especificação Técnica: Promoção da spec 049 (e-mails de Auth com React Email) de `dev` para `main`

## Problem Statement

A spec 049 está pronta e provada no DEV: os e-mails de confirmação e de redefinição de senha saem pelo Send Email Hook, com o template React Email, em português e com a marca do Navalhado. Em produção, o gerente que pede "Esqueci minha senha" e o barbeiro cujo acesso o gerente criou ainda recebem o template padrão do Supabase, em inglês ("Confirm your email address", "Reset your password"), sem a marca, com cara de spam.

A `dev` está 7 commits à frente da `main` (base comum `6668ded`), todos da spec 049. A promoção não é só um merge, por quatro motivos:

- **Edge Function.** Prod não tem a `send-auth-email`. Ela é publicada à parte do front, pelo MCP.
- **Configuração de prod.** O hook depende de uma chave do Resend própria de prod, de três secrets e da criação do Send Email Hook no dashboard. Tudo isso é passo do usuário.
- **Logo.** O e-mail busca a logo em `<origem do redirect_to>/email/logo.png`, que em prod é `https://app.navalhado.com.br/email/logo.png`. Esse arquivo só existe em prod depois do push da `main`, que dispara o deploy da Cloudflare. Ligar o hook antes disso manda e-mail com a imagem quebrada.
- **Git.** A `main` tem 5 commits que a `dev` não tem: 4 de documentação da spec 048 (feitos direto na `main`) e o hotfix `5ea5b54`, cujo conteúdo a `dev` já tem como `2031945`. O merge simulado não tem conflito, mas a `dev` precisa receber esses commits depois.

## Solution

Promover em ordem fixa: conferências, merge local, push da `main` (publica a logo), publicação da Edge Function, configuração do hook pelo usuário, provas em produção, sincronização da `dev`.

Nenhum passo intermediário quebra produção. O front não muda (nenhum arquivo em `src/`), então o push só acrescenta a logo. A Edge Function publicada não tem efeito até o hook ser criado. A partir do hook ligado, o envio de e-mail de Auth passa a depender da função; a volta atrás é desligar o hook, o que devolve o envio ao SMTP de prod na hora.

Estado conferido em 24/09, antes da promoção:

- **Git.** `main` = `origin/main` = `12fbb6a`; `dev` = `origin/dev` = `9e63cfe`; base comum `6668ded`. `git merge-tree` entre as duas: limpo, sem conflito.
- **Dependências.** Só mudam devDependencies (`react-email`, `@react-email/ui`). As de produção no lock são as mesmas (69 pacotes; `react` 19.2.7, `@supabase/supabase-js` 2.110.7, `vite` 8.1.5, `react-router-dom` 7.18.2).
- **Edge Functions de prod.** `whatsapp-integration`, `public-customer-session` e `create-barber-access`. Sem `send-auth-email`.
- **Logo em prod.** `app.navalhado.com.br/email/logo.png` hoje responde a SPA (`text/html`), não a imagem.
- **Resend.** Domínio `app.navalhado.com.br` verificado, envio ligado. Chaves existentes: `prod.nav` (SMTP de prod), `dev.nav`, `hook.dev`. `hook.prod` ainda não existe.
- **Remetente de prod.** `"Navalhado" <noreply@app.navalhado.com.br>`, o mesmo do SMTP de hoje.

## User Stories

1. As a Gerente em produção, I want receber "Redefina sua senha" em português e com a marca do Navalhado quando peço "Esqueci minha senha", so that eu reconheça a mensagem e confie no link.
2. As a Barbeiro em produção cujo acesso o gerente criou, I want receber "Confirme seu e-mail" com a marca do Navalhado, so that eu entenda que o convite é legítimo.
3. As a Barbeiro em produção, I want que o "Reenviar link" do Login mande o mesmo e-mail novo, so that eu não receba o template antigo se o primeiro sumir.
4. As a usuário em produção, I want ver a logo do Navalhado no e-mail, so that a mensagem não pareça incompleta.
5. As a usuário em produção, I want continuar recebendo o remetente `noreply@app.navalhado.com.br`, so that o e-mail não caia em spam.
6. As a Gerente ou Barbeiro já cadastrado, I want continuar entrando normalmente depois da promoção, so that a troca do envio de e-mail não me trave.
7. As a Desenvolvedor, I want confirmar antes de começar que `main` e `dev` locais batem com os remotos e que o merge continua sem conflito, so that eu não promova uma branch velha.
8. As a Desenvolvedor, I want que o merge de `dev` em `main` seja um merge commit (`--no-ff`), so that a promoção seja um ponto identificável no histórico da `main`.
9. As a Desenvolvedor, I want rodar `npm run lint`, `npm test`, `npm run build` e os testes Deno da `send-auth-email` no resultado do merge antes do push, so that a `main` só receba código que passa.
10. As a Desenvolvedor, I want dar o push da `main` só com confirmação do usuário no momento, so that o deploy de produção nunca aconteça por engano.
11. As a Desenvolvedor, I want ver `app.navalhado.com.br/email/logo.png` responder `image/png` antes de qualquer hook ser ligado, so that nenhum e-mail de prod saia com a imagem quebrada.
12. As a Desenvolvedor, I want publicar em prod os mesmos arquivos da `send-auth-email` da `dev`, sem os de teste, so that os dois ambientes rodem o mesmo código.
13. As a Desenvolvedor, I want que a função de prod seja publicada sem verificação de JWT, so that o Send Email Hook consiga chamá-la (a assinatura Standard Webhooks cumpre esse papel).
14. As a Desenvolvedor, I want uma chave do Resend só para o hook de prod, restrita ao domínio de prod, so that eu possa revogá-la sem derrubar o SMTP de reserva.
15. As a Desenvolvedor, I want que a chave e o secret do hook nunca passem pela conversa, pelo log ou pelo repositório, so that eles não vazem.
16. As a Desenvolvedor, I want provar em prod a redefinição de senha e a confirmação com e-mail real, so that a promoção só termine com evidência.
17. As a Desenvolvedor, I want provar em prod que desligar o hook devolve o envio ao SMTP, so that a volta atrás de produção seja real e não suposta.
18. As a Desenvolvedor, I want que as provas em prod não criem tenant novo nem Agendamento, so that nenhum dado de negócio nem WhatsApp real surja de um teste.
19. As a Desenvolvedor, I want remover ao final o acesso de barbeiro de teste criado em prod, so that prod fique como estava.
20. As a Desenvolvedor, I want que a `dev` receba os commits de documentação da spec 048 que só existem na `main`, so that as duas branches voltem a apontar para o mesmo ponto.
21. As a Desenvolvedor, I want registrar nesta spec a data da promoção, o commit da `main` e o resultado de cada prova, so that a próxima promoção comece de um ponto conhecido.

## Implementation Decisions

- **Ordem fixa.**
  1. Conferências de git, prod e Resend.
  2. Merge local de `dev` em `main` com `--no-ff`, com lint, testes, build e testes Deno.
  3. Push da `main` com confirmação do usuário; espera da logo em prod.
  4. Publicação da `send-auth-email` em prod.
  5. Configuração pelo usuário: chave, secrets e hook.
  6. Provas em produção, volta atrás e limpeza.
  7. Sincronização da `dev` com a `main` e registro.

  Nenhum passo começa sem o anterior ter passado.
- **Merge.** `git merge --no-ff dev` na `main` local. Sem conflito previsto (`git merge-tree` confirmou).
- **Testes Deno no merge.** Rodam como no DEV: `--no-check --allow-net --allow-env --min-dep-age 0 --config deno.json`. O `deno.lock` alterado pelo `deno test` é restaurado antes do commit.
- **Push.** O push da `main` é o gatilho do deploy do front na Cloudflare e só acontece com o usuário confirmando no momento. O único efeito visível é o arquivo `public/email/logo.png` passar a existir em `app.navalhado.com.br`.
- **Edge Function.** Publicação da `send-auth-email` pelo MCP em `boakqstrdfqmsrwnjore`, com entrada `index.tsx`, mapa de imports `deno.json` e `verify_jwt: false`. Os arquivos publicados são `deno.json`, `index.tsx`, `handler.tsx`, `email.tsx`, `emails/_layout.tsx`, `emails/redefinicao-senha.tsx` e `emails/confirmacao.tsx`, lidos da `main` já mergeada. Ficam de fora os arquivos de teste, o `deno.lock` e a pasta `emails/static/` (só para o preview local).
- **Configuração de prod, feita pelo usuário no dashboard:**
  - Resend: chave `hook.prod`, "Sending access", restrita a `app.navalhado.com.br`. A existência dela é conferida pelo conector do Resend, sem ver o valor.
  - Supabase (projeto de prod), Edge Functions → Secrets: `RESEND_API_KEY` (valor da `hook.prod`) e `AUTH_EMAIL_FROM` = `Navalhado <noreply@app.navalhado.com.br>`.
  - Supabase, Authentication → Hooks → Send Email hook: HTTPS, URL `https://boakqstrdfqmsrwnjore.supabase.co/functions/v1/send-auth-email`, "Generate Secret". O valor gerado vai para o secret `SEND_EMAIL_HOOK_SECRET`.
- **O que não se toca em prod:** configuração de SMTP, templates atuais do dashboard e a chave `prod.nav`. São a volta atrás.
- **Registro dos resultados.** Durante a promoção, os resultados de cada ticket são commitados na `main` local (é nela que se trabalha). Os dos tickets 01 e 02 vão no push do ticket 03; os seguintes ficam na `main` local e sobem juntos no ticket 06.
- **Sincronização.** No fim, a `dev` avança por fast-forward até a `main` (que contém toda a `dev`, o merge, os 4 commits da spec 048 e os registros da 050), e as duas sobem. `main`, `dev`, `origin/main` e `origin/dev` terminam no mesmo commit, sem repetir a divergência que a spec 048 deixou.

## Testing Decisions

- **Seams.** Os mesmos da spec 049, agora em prod: a Edge Function publicada (chamada pelo Auth via hook) e o fluxo real no navegador e na caixa de e-mail. Nenhum seam novo.
- **Suíte local no merge.** `npm run lint`, `npm test`, `npm run build` e os 11 testes Deno do handler da `send-auth-email`, no resultado do merge, antes do push.
- **Logo.** `curl` em `https://app.navalhado.com.br/email/logo.png` até responder `200 image/png`, antes da configuração do hook.
- **Provas em produção, com o hook ligado:**
  - **Redefinição.** "Esqueci minha senha" na conta de gerente do usuário (`resplandesjonathas@gmail.com`, tenant "Barber Tester"). O Resend registra "Redefina sua senha do Navalhado", remetente `noreply@app.navalhado.com.br`, `delivered`. O HTML traz a logo em `https://app.navalhado.com.br/email/logo.png` e o link com `type=recovery` e `redirect_to` para `app.navalhado.com.br`. A senha não é trocada.
  - **Confirmação.** Acesso de barbeiro criado pela tela real para um profissional do tenant "Barber Tester", com `resplandesjonathas7@gmail.com` (real, sem alias `+`; `resplandesjonathas@gmail.com` já é a conta de gerente do tenant, não serve para o barbeiro). Chega "Confirme seu e-mail no Navalhado". O Login recusa antes da confirmação; "Reenviar link" manda um segundo e-mail igual, respeitando o intervalo de 25 s do GoTrue. Depois do clique no link, o Login do barbeiro entra.
  - **Logs.** O log de Auth de prod mostra `Hook ran successfully` nos três envios; o log da função não traz token, hash nem link.
  - **Gerente existente.** O login da conta de gerente continua normal.
- **Volta atrás em prod.** O usuário desliga o hook. "Esqueci minha senha" na conta de gerente sai pelo SMTP, com o template antigo ("Reset your password"). O usuário religa o hook, e um novo pedido volta a sair com o template novo.
- **Sem cadastro de barbearia em prod.** Criaria um tenant real, e o tipo de e-mail (`signup`) é o mesmo do acesso de barbeiro, já provado no DEV pelos três fluxos.
- **Nenhum Agendamento criado.** Limpeza ao final: o acesso de barbeiro de teste é removido (`public.users`, `auth.identities`, `auth.users`) e `professionals.user_id` do profissional usado volta a nulo.

## Out of Scope

- Qualquer mudança de código ou de template da spec 049: esta spec só promove o que já está na `dev`.
- Cadastro de barbearia em prod (decidido pular; ver Testing Decisions).
- Mudar ou remover o SMTP e os templates do dashboard de prod: continuam como volta atrás.
- Rotação de secret do hook.
- A credencial do SMTP do DEV, que deu `535` uma vez durante a spec 049: é do DEV, não bloqueia a promoção. A de prod é conferida pela prova da volta atrás.

## Further Notes

- Se o merge ou a suíte local falhar, a promoção para antes do push; nada muda em prod.
- Se a logo não aparecer em prod em até 30 minutos depois do push, conferir o deploy na Cloudflare antes de seguir. Na spec 048 o bundle novo apareceu em menos de 2 minutos.
- Se uma prova com o hook ligado falhar, o usuário desliga o hook (volta ao SMTP na hora) e a correção é um commit novo na `dev`, promovido do mesmo jeito. Nunca uma edição direta na `main`.
- Commits de referência na montagem desta spec: `main` em `12fbb6a`, `dev` em `9e63cfe`, base comum `6668ded`.
- Tickets em `.scratch/promocao-spec-049/issues/`.

## Resultado da promoção (2026-09-24)

Todos os 6 tickets concluídos.

- **Git.** `main` tinha avançado para `78af32e` desde a montagem (merge trazendo `6668ded`, achado fora de escopo da spec 048, já ancestral da `dev`) — sem risco novo. Merge `dev` → `main` sem conflito. Push da `main` confirmado pelo usuário: `78af32e..60bd761`.
- **Logo.** No ar em `app.navalhado.com.br/email/logo.png` em menos de 45 s depois do push.
- **`send-auth-email` em prod.** Publicada com o mesmo hash (`4ad20617...`) do dev — conteúdo idêntico. Usuário criou a chave `hook.prod`, os 3 secrets e o hook.
- **Provas com e-mail real.** Redefinição de senha e confirmação de e-mail (acesso de barbeiro) funcionando em prod, com o template novo, a logo e o remetente certos. Login do barbeiro funcionou depois do clique no link real.
- **Volta atrás.** Provada nos dois sentidos: hook desligado → SMTP com o template antigo; hook religado → template novo de novo.
- **Fora do combinado, registrado com transparência:** o "Reenviar link" da tela de Login não foi testado isoladamente em prod (o `/resend` da própria criação do acesso já exercita o mesmo caminho; evitou-se criar um segundo profissional falso num tenant real só para essa prova — já coberto no DEV). Um efeito colateral apareceu durante o teste: usar uma segunda aba da mesma origem para logar como o barbeiro sobrescreveu o token da sessão do gerente no `localStorage` compartilhado, derrubando a sessão do navegador do usuário quando a conta de teste foi apagada (a conta em si nunca foi afetada; só precisou logar de novo).
- **Limpeza.** Acesso de barbeiro de teste removido; `professionals.user_id` do profissional pré-existente de volta a `null`. Nenhum tenant nem Agendamento criado.

**Spec 050 encerrada.** E-mails de Auth com React Email (spec 049) promovidos de `dev` para produção.
