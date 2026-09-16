# 01: Fundação Tailwind — instalar e mapear tokens

**What to build:** o projeto passa a ter Tailwind CSS v4 disponível via `@tailwindcss/vite`, com os tokens de cor, raio e fonte hoje em `:root` de `src/index.css` (`--color-brand-primary`, `--color-bg-primary`, `--color-bg-secondary`, `--color-border`, `--color-text-primary`, `--color-text-secondary`, `--radius-sm/md/lg/xl/full`, `--font-family-base`) declarados como `@theme` do Tailwind, com os mesmos nomes semânticos. Nenhuma tela é convertida ainda — este ticket só entrega a fundação que os demais vão consumir.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `@tailwindcss/vite` instalado e plugado no `vite.config.ts`, sem `postcss.config.js` nem `tailwind.config.js` manual
- [ ] Bloco `@theme` declarado (no arquivo que hoje é `src/index.css` ou equivalente) mapeando cada token de cor, raio e fonte existente, com o mesmo nome semântico
- [ ] Uma classe utilitária de teste (ex. `bg-brand-primary`) aplicada num ponto qualquer do app produz visualmente a mesma cor que `var(--color-brand-primary)` produz hoje
- [ ] `npm run dev` e `npm run build` (`tsc -b && vite build`) continuam passando sem erro
- [ ] `npm run test` (vitest) continua passando sem nenhuma asserção alterada
- [ ] Nenhuma tela existente muda de aparência neste ticket — só a fundação é adicionada, nada é removido ainda
