# 05: Implantação e conferência no DEV

Parte da spec 056 (Contatos do Site no painel do Proprietário).

**What to build:** a aba Contatos funciona no site de dev do app, lendo e marcando no D1 `navalhado-site-dev`. Um formulário enviado pelo site de dev aparece no contador e na lista.

O deploy do app parece automático a cada push (Workers Builds: `dev` vai para `navalhado-dev`, `main` para `navalhado`), deduzido pelos horários dos deploys. Por isso a ordem importa: a guarda no banco antes, e o comando de deploy confirmado antes do primeiro push.

**Blocked by:** 02, 03 e 04

**Status:** done

- [x] Confirmado com o usuário, no painel da Cloudflare: o build da `dev` publica com `--env dev`. Se não, ajustar antes do push, senão o push publica no Worker de prod
- [x] A migration do ticket 01 está aplicada no DEV antes do push
- [x] Push na `dev` só com o OK do usuário; deploy do `navalhado-dev` concluído
- [x] Conferido no site de dev, logado como Proprietário:
  - um formulário enviado pelo site de dev aparece no contador em até 1 minuto;
  - abrir a mensagem a marca como lida e baixa o contador;
  - marcar como respondida e como não lida funciona;
  - a tela e o cabeçalho cabem em 375 px
- [x] Conferido no DEV: um Gerente recebe 403 nas rotas de contatos
- [x] `CONTEXT.md`: o termo "Contato do Site" (mensagem do formulário do site, guardada no D1 do site, com o andamento `novo`, `lido` e `respondido`)
- [x] CLAUDE.md: o app é publicado como Worker com assets e um script para `/api/*`, e não pelo Cloudflare Pages; e o comando de desenvolvimento local do Worker
- [x] Gates de lint, Vitest e build passam

**Resultado (2026-10-09):**
- Build da `dev` confirmado pelo usuário com `--env dev`. Push da `dev` feito pelo usuário; deploy do `navalhado-dev` às 00:30:26 UTC de 10/10. O `navalhado` (prod) ficou intocado: último deploy de 24/09, e `app.navalhado.com.br/api/*` ainda devolve a SPA.
- Migration da RPC aplicada no DEV antes do push (ticket 01).
- No site de dev, logado como Proprietário: um formulário enviado por `navalhado-site-dev.../api/contato` às 20:31:12 apareceu na lista e no contador; um segundo, enviado às 20:32:48 com a página aberta, subiu o contador para 4 às 20:32:52, sem recarregar. Abrir a mensagem gravou `lido` e baixou o contador para 3; "Marcar como respondido" e "Marcar como não lida" gravaram no D1 de dev. Em 375 px: documento com 375 px, Sair terminando em 363 px e filtros numa linha.
- Logado como Gerente no site de dev: `GET /api/admin/contatos`, `GET /api/admin/contatos/novos` e `PATCH /api/admin/contatos/4` responderam 403, e o contato 4 continuou `novo`.
- `CONTEXT.md` ganhou o termo "Contato do Site"; o CLAUDE.md (local, fora do git) passou a descrever o Worker com assets e o `npm run dev:worker`.
- A lista não se recarrega sozinha (só o contador): uma mensagem que chega com a aba aberta entra no contador e aparece na lista ao trocar de filtro ou recarregar, como na spec.
- Mensagens de teste no D1 `navalhado-site-dev`: ids 1 a 5 (`*-056@exemplo.com`).
