# 02: Filtros por andamento e mensagens mais antigas

Parte da spec 056 (Contatos do Site no painel do Proprietário).

**What to build:** a aba Contatos abre no filtro Novos, como uma caixa de entrada. Os filtros são Novos, Lidos, Respondidos e Todos. "Carregar mais" traz as próximas 50. Com a lista vazia, a tela diz isso conforme o filtro. Se a lista não carrega, a tela mostra o erro e um botão para tentar de novo.

**Blocked by:** 01 (O Proprietário abre a aba Contatos e vê as mensagens do site)

**Status:** done

- [x] `GET /api/admin/contatos` aceita `status` (`novo`, `lido` ou `respondido`; fora disso, 422) e `antesDe` (paginação pelo id), e devolve `{ contatos, haMais }`
- [x] Adaptadores, repositório e hook da lista passam o filtro e a paginação
- [x] Tela:
  - filtros com Novos como padrão;
  - "Carregar mais" só quando `haMais`;
  - vazio por filtro (ex.: "Nenhum contato novo");
  - erro: "Não foi possível carregar os contatos", com "Tentar de novo"
- [x] Testes:
  - handler do Worker: filtro, paginação com `haMais` e 422;
  - tela: abre em Novos, troca de filtro, carregar mais, vazio e erro
- [x] Gates de lint, Vitest e build passam

**Resultado (2026-10-09):**
- O Worker filtra e pagina com uma consulta só (`?1 IS NULL OR status = ?1`, `?2 IS NULL OR id < ?2`); `status` fora da lista e `antesDe` que não é inteiro positivo dão 422.
- "Carregar mais" que falha mantém a lista e mostra "Não foi possível carregar mais contatos.", com o botão para tentar de novo.
- Conferido localmente contra o D1 de dev: Novos lista as duas mensagens de teste, Lidos mostra "Nenhum contato lido.", e em 375 px os filtros ficam numa linha só, sem rolagem horizontal.
