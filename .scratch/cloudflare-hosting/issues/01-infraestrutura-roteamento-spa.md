# 01 — Infraestrutura de Roteamento SPA (Cloudflare _redirects)

**What to build:**
Adicionar a regra de redirecionamento universal do Cloudflare Pages no projeto para que qualquer requisição a sub-rotas ou recarregamento de página seja reescrito internamente para o `index.html`, permitindo que o roteador do cliente funcione sem exibir erros 404 ao usuário.

**Blocked by:**
None — can start immediately

**Status:**
ready-for-agent

- [ ] Criar o arquivo `_redirects` dentro da pasta pública (`public/`) com o conteúdo `/* /index.html 200`.
- [ ] Executar o build de produção local (`npm run build`) para assegurar que o compilador do Vite copie o arquivo `_redirects` sem modificações para a raiz da pasta de distribuição (`dist/`).
- [ ] Validar que nenhum teste automatizado existente foi quebrado pela inserção do arquivo de redirecionamento.
