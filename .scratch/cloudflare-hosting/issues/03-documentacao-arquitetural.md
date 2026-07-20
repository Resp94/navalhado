# 03 — Documentação Arquitetural (ADR 005 e Glossário)

**What to build:**
Registrar oficialmente a decisão de arquitetura de hospedagem do frontend no Cloudflare Pages através de um documento ADR (Architectural Decision Record) sob a numeração sequencial correta e atualizar o glossário de termos do negócio.

**Blocked by:**
01 — Infraestrutura de Roteamento SPA (Cloudflare _redirects)
02 — Configuração Declarativa do Wrangler para o Pages

**Status:**
ready-for-agent

- [ ] Criar o arquivo de documentação ADR `docs/adr/005_hospedagem_cloudflare_pages.md` respeitando o padrão de seções aceito pelo projeto.
- [ ] Documentar o contexto, os motivos da decisão, as alternativas consideradas (como Workers/Pages Functions) e as consequências positivas da hospedagem Edge.
- [ ] Atualizar o arquivo `docs/glossario_dominio.md` adicionando conceitos de hospedagem no Cloudflare Pages, arquivos `_redirects` e injeção de variáveis em tempo de compilação.
