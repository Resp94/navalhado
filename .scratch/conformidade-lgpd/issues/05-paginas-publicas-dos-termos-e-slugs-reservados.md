# 05: Páginas públicas `/termos` e `/privacidade`, e slugs reservados

Parte da spec 055 (Conformidade com os novos Termos e Política).

**What to build:** `/termos` e `/privacidade` mostram, sem login, os textos vigentes de `textos.ts`, com a versão. As páginas podem ser impressas (CSS de impressão sem menus).

Os links do Login, do Cadastro e da tela de aceite continuam abrindo o modal.

O banco passa a recusar, na criação e na edição do slug, os nomes reservados da spec. A lista inclui `termos`, `privacidade` e as rotas fixas que já existem.

Hoje `/:slug` captura qualquer caminho de um segmento e nenhum slug é reservado.

**Blocked by:** None (can start immediately)

**Status:** ready

- [ ] Antes da migration, com leitura só: conferir se algum tenant do DEV usa um slug reservado. A PROD só com o OK do usuário. Se algum usar, parar e voltar ao usuário
- [ ] Migration só no DEV: a regra dos slugs reservados, numa função só, usada pela criação e pela edição do slug
- [ ] Rotas estáticas antes de `/:slug` em `App.tsx`, reaproveitando `TextoDosTermos`
- [ ] pgTAP: cada slug reservado é recusado, maiúsculo ou minúsculo; um slug comum continua aceito
- [ ] Vitest: as duas rotas mostram o título e a versão; `/:slug` segue funcionando para slug comum
- [ ] Gates de lint, Vitest e build passam
