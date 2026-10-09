# 01: O Proprietário abre a aba Contatos e vê as mensagens do site

Parte da spec 056 (Contatos do Site no painel do Proprietário).

**What to build:** o painel do Proprietário ganha a aba Contatos. Ela lista as 50 mensagens mais novas do formulário do site, lidas direto do D1 do site, e cada mensagem abre com tudo o que a pessoa preencheu. Este ticket é só leitura, sem filtro, paginação ou marcação, mas monta a ponte inteira: a guarda no banco, o Worker do app com o binding do D1, o módulo e a tela.

Hoje o Worker do app só serve assets, e o Proprietário não vê os contatos do site em lugar nenhum do Navalhado.

**Blocked by:** None (can start immediately)

**Status:** ready

- [ ] Migration só no DEV (`selvxobcjbkligxighlp`), pelo MCP: `public.assert_proprietario()` (security definer, `search_path` vazio, só chama `private.assert_saas_admin()`, `EXECUTE` só para `authenticated`)
- [ ] pgTAP `81_contatos_do_site_no_painel.test.sql` em `begin; ... rollback;`:
  - o Proprietário ativo passa;
  - o Proprietário inativo é recusado;
  - o Gerente, inclusive com `tenant_id` nulo, o Barbeiro e o anônimo são recusados com 42501
- [ ] Configuração do Worker do app:
  - script próprio e `run_worker_first` só para `/api/*`; o resto continua SPA;
  - binding D1 `CONTATOS`: `navalhado-site` no topo e `navalhado-site-dev` no `env.dev`;
  - vars com a URL e a chave anon do Supabase de cada ambiente
- [ ] `GET /api/admin/contatos`:
  - repassa o Bearer à RPC: 401 sem token ou com JWT recusado, 403 com `ADMIN_ONLY`, 503 com o Supabase fora;
  - devolve as 50 mais novas (id decrescente), sem `ip` nem `user_agent`;
  - SQL parametrizado; erro do D1 vira 500 genérico, com o detalhe só no log;
  - rota `/api/*` desconhecida dá 404 em JSON, e método errado dá 405
- [ ] Desenvolvimento local: script que roda o Worker com o ambiente dev (D1 com `remote = true`) e proxy de `/api` no Vite
- [ ] Módulo Contatos do Site:
  - tipos `ContatoDoSite` e `StatusDoContato`;
  - interface do adaptador;
  - adaptador do Worker (token da sessão; 401 e 403 viram erros de domínio) e adaptador em memória;
  - repositório e hook da lista
- [ ] Tela `/admin/contatos` (`AuthGuard allowedRole="proprietario"`):
  - cada linha mostra nome e sobrenome, barbearia (quando houver), assunto, data e selo de status;
  - abrir mostra o e-mail e a mensagem com as quebras de linha, como texto
- [ ] O cabeçalho do painel do Proprietário ganha a aba Contatos, com a aba atual marcada
- [ ] Testes:
  - handler do Worker: autorização, campos omitidos, 404/405 e erro do D1;
  - repositório contra o adaptador em memória;
  - adaptador com `fetch` simulado;
  - tela: lista, abrir, e `<script>` aparece como texto
- [ ] Conferido localmente contra o D1 de dev, com uma ou duas mensagens de teste inseridas nele
- [ ] Gates de lint, Vitest e build passam
