# 10: Fontes servidas pelo próprio site

Parte da spec 055 (Conformidade com os novos Termos e Política).

**What to build:** a fonte Outfit (pesos 300 a 800) é servida de `public/fonts`, com `@font-face` e `font-display: swap`, no lugar do `@import` do Google Fonts em `src/index.css:1`. A CSP de `public/_headers` perde `https://fonts.googleapis.com` e `https://fonts.gstatic.com`.

Hoje cada visita manda o IP do visitante para o Google só para carregar a fonte, o que é uma transferência internacional sem necessidade. Quando este ticket sair, o Google sai da tabela de suboperadores da Política (seção 6), ficando só o DNS do Google.

**Blocked by:** None (can start immediately)

**Status:** ready

- [ ] Arquivos `woff2` da Outfit (licença OFL, conferir) em `public/fonts`
- [ ] Nenhuma requisição a `fonts.googleapis.com` ou `fonts.gstatic.com` no carregamento, conferido nas requisições de rede do navegador do app
- [ ] A tela continua com a mesma fonte (captura antes e depois)
- [ ] Atualizar a seção 6 da minuta da Política
- [ ] Gates de lint, Vitest e build passam
