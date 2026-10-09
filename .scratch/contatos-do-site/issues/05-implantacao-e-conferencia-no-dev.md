# 05: Implantação e conferência no DEV

Parte da spec 056 (Contatos do Site no painel do Proprietário).

**What to build:** a aba Contatos funciona no site de dev do app, lendo e marcando no D1 `navalhado-site-dev`. Um formulário enviado pelo site de dev aparece no contador e na lista.

O deploy do app parece automático a cada push (Workers Builds: `dev` vai para `navalhado-dev`, `main` para `navalhado`), deduzido pelos horários dos deploys. Por isso a ordem importa: a guarda no banco antes, e o comando de deploy confirmado antes do primeiro push.

**Blocked by:** 02, 03 e 04

**Status:** ready

- [ ] Confirmado com o usuário, no painel da Cloudflare: o build da `dev` publica com `--env dev`. Se não, ajustar antes do push, senão o push publica no Worker de prod
- [ ] A migration do ticket 01 está aplicada no DEV antes do push
- [ ] Push na `dev` só com o OK do usuário; deploy do `navalhado-dev` concluído
- [ ] Conferido no site de dev, logado como Proprietário:
  - um formulário enviado pelo site de dev aparece no contador em até 1 minuto;
  - abrir a mensagem a marca como lida e baixa o contador;
  - marcar como respondida e como não lida funciona;
  - a tela e o cabeçalho cabem em 375 px
- [ ] Conferido no DEV: um Gerente recebe 403 nas rotas de contatos
- [ ] `CONTEXT.md`: o termo "Contato do Site" (mensagem do formulário do site, guardada no D1 do site, com o andamento `novo`, `lido` e `respondido`)
- [ ] CLAUDE.md: o app é publicado como Worker com assets e um script para `/api/*`, e não pelo Cloudflare Pages; e o comando de desenvolvimento local do Worker
- [ ] Gates de lint, Vitest e build passam
