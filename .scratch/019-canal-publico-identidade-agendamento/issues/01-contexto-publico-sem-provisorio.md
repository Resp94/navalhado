# 01 — Contexto público sem criação automática de cliente

**What to build:** O link público resolve o estabelecimento pelo slug e carrega o contexto necessário para o agendamento sem criar cliente provisório nem token automaticamente.

**Blocked by:** None — can start immediately.

**Status:** concluído

- [x] O contexto público resolve o estabelecimento correto pelo slug, respeitando tenant ativo e dados públicos permitidos.
- [x] A abertura do link público não insere cliente, não gera token e não altera dados persistidos do cliente.
- [x] O contrato público é separado do contrato de cliente reconhecido, mantendo os fluxos autenticados existentes funcionais.
- [x] A migration necessária é versionada e os RPCs públicos possuem permissões compatíveis com o acesso anônimo.
- [x] Existem testes de banco, adapter e fluxo público cobrindo slug válido, slug inválido e ausência de criação automática.
