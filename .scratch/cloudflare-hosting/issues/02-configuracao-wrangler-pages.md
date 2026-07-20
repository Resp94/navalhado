# 02 — Configuração Declarativa do Wrangler para o Pages

**What to build:**
Criar o arquivo de configuração declarativa do Wrangler (`wrangler.toml`) na raiz do repositório contendo as diretivas da Cloudflare para o Pages, padronizando a pasta de saída de compilação como `dist` e definindo a data de compatibilidade estável.

**Blocked by:**
None — can start immediately

**Status:**
ready-for-agent

- [ ] Criar o arquivo `wrangler.toml` na raiz do projeto com as propriedades declarativas de compatibilidade da Cloudflare para Pages.
- [ ] Definir a propriedade `pages_build_output_dir` configurada como `"dist"` (diretório padrão de build do Vite).
- [ ] Definir a propriedade `compatibility_date` com o carimbo de data correspondente ao deploy estável.
