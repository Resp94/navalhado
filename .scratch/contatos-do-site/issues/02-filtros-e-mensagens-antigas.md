# 02: Filtros por andamento e mensagens mais antigas

Parte da spec 056 (Contatos do Site no painel do Proprietário).

**What to build:** a aba Contatos abre no filtro Novos, como uma caixa de entrada. Os filtros são Novos, Lidos, Respondidos e Todos. "Carregar mais" traz as próximas 50. Com a lista vazia, a tela diz isso conforme o filtro. Se a lista não carrega, a tela mostra o erro e um botão para tentar de novo.

**Blocked by:** 01 (O Proprietário abre a aba Contatos e vê as mensagens do site)

**Status:** ready

- [ ] `GET /api/admin/contatos` aceita `status` (`novo`, `lido` ou `respondido`; fora disso, 422) e `antesDe` (paginação pelo id), e devolve `{ contatos, haMais }`
- [ ] Adaptadores, repositório e hook da lista passam o filtro e a paginação
- [ ] Tela:
  - filtros com Novos como padrão;
  - "Carregar mais" só quando `haMais`;
  - vazio por filtro (ex.: "Nenhum contato novo");
  - erro: "Não foi possível carregar os contatos", com "Tentar de novo"
- [ ] Testes:
  - handler do Worker: filtro, paginação com `haMais` e 422;
  - tela: abre em Novos, troca de filtro, carregar mais, vazio e erro
- [ ] Gates de lint, Vitest e build passam
