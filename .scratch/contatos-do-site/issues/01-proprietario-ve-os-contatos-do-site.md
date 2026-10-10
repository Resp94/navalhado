# 01: O Proprietário abre a aba Contatos e vê as mensagens do site

Parte da spec 056 (Contatos do Site no painel do Proprietário).

**What to build:** o painel do Proprietário ganha a aba Contatos. Ela lista as 50 mensagens mais novas do formulário do site, lidas direto do D1 do site, e cada mensagem abre com tudo o que a pessoa preencheu. Este ticket é só leitura, sem filtro, paginação ou marcação, mas monta a ponte inteira: a guarda no banco, o Worker do app com o binding do D1, o módulo e a tela.

Hoje o Worker do app só serve assets, e o Proprietário não vê os contatos do site em lugar nenhum do Navalhado.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Migration só no DEV (`selvxobcjbkligxighlp`), pelo MCP: `public.assert_proprietario()` (security definer, `search_path` vazio, só chama `private.assert_saas_admin()`, `EXECUTE` só para `authenticated`)
- [x] pgTAP `81_contatos_do_site_no_painel.test.sql` em `begin; ... rollback;`:
  - o Proprietário ativo passa;
  - o Proprietário inativo é recusado;
  - o Gerente, inclusive com `tenant_id` nulo, o Barbeiro e o anônimo são recusados com 42501
- [x] Configuração do Worker do app:
  - script próprio e `run_worker_first` só para `/api/*`; o resto continua SPA;
  - binding D1 `CONTATOS`: `navalhado-site` no topo e `navalhado-site-dev` no `env.dev`;
  - vars com a URL e a chave anon do Supabase de cada ambiente
- [x] `GET /api/admin/contatos`:
  - repassa o Bearer à RPC: 401 sem token ou com JWT recusado, 403 com `ADMIN_ONLY`, 503 com o Supabase fora;
  - devolve as 50 mais novas (id decrescente), sem `ip` nem `user_agent`;
  - SQL parametrizado; erro do D1 vira 500 genérico, com o detalhe só no log;
  - rota `/api/*` desconhecida dá 404 em JSON, e método errado dá 405
- [x] Desenvolvimento local: script que roda o Worker com o ambiente dev (D1 com `remote = true`) e proxy de `/api` no Vite
- [x] Módulo Contatos do Site:
  - tipos `ContatoDoSite` e `StatusDoContato`;
  - interface do adaptador;
  - adaptador do Worker (token da sessão; 401 e 403 viram erros de domínio) e adaptador em memória;
  - repositório e hook da lista
- [x] Tela `/admin/contatos` (`AuthGuard allowedRole="proprietario"`):
  - cada linha mostra nome e sobrenome, barbearia (quando houver), assunto, data e selo de status;
  - abrir mostra o e-mail e a mensagem com as quebras de linha, como texto
- [x] O cabeçalho do painel do Proprietário ganha a aba Contatos, com a aba atual marcada
- [x] Testes:
  - handler do Worker: autorização, campos omitidos, 404/405 e erro do D1;
  - repositório contra o adaptador em memória;
  - adaptador com `fetch` simulado;
  - tela: lista, abrir, e `<script>` aparece como texto
- [x] Conferido localmente contra o D1 de dev, com uma ou duas mensagens de teste inseridas nele
- [x] Gates de lint, Vitest e build passam

**Resultado (2026-10-09):**
- Migration `20261009234801_056_ticket01_assert_proprietario` aplicada no DEV; pgTAP 81 com 8 de 8 no DEV.
- Guarda conferida contra o Supabase de dev com o Worker local: sem token, com a chave anon e com token inventado, 401; o Proprietário logado lista as mensagens (200). O 403 do Gerente está provado no pgTAP e nos testes do Worker; a conferência com um Gerente logado fica para o ticket 05.
- Com a terceira aba, o cabeçalho passava 34 px em 375 px: as abas usam `text-xs` e `px-2` abaixo de `md`, e o documento ficou com 375 px (Sair termina em 363 px).
- Testes do Worker rodam no ambiente node, com um D1 de teste sobre `node:sqlite`; o setup global do Vitest passou a tolerar a falta de `window`.
- Duas mensagens de teste ficaram no D1 `navalhado-site-dev` (`teste-056@exemplo.com` e `outra-056@exemplo.com`).
