# 01: Fundação Tailwind — instalar e mapear tokens

**What to build:** o projeto passa a ter Tailwind CSS v4 disponível via `@tailwindcss/vite`, com os tokens de cor, raio e fonte hoje em `:root` de `src/index.css` (`--color-brand-primary`, `--color-bg-primary`, `--color-bg-secondary`, `--color-border`, `--color-text-primary`, `--color-text-secondary`, `--radius-sm/md/lg/xl/full`, `--font-family-base`) declarados como `@theme` do Tailwind, com os mesmos nomes semânticos. Nenhuma tela é convertida ainda — este ticket só entrega a fundação que os demais vão consumir.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `@tailwindcss/vite` instalado e plugado no `vite.config.ts`, sem `postcss.config.js` nem `tailwind.config.js` manual
- [x] Bloco `@theme` declarado em `src/index.css` mapeando cor, raio, sombra e fonte, com o mesmo nome semântico (`brand-primary`, `bg-primary`, `bg-secondary`, `border`, `text-primary`, `text-secondary`, `success/error/warning/info` (+ `-bg`), `radius-sm/md/lg/xl/full`, `shadow-sm/md/lg/xl`, `font-base`)
- [x] `tsc -b` e `vite build` passam sem erro; warning de ordem de `@import` corrigido (Google Fonts antes de `@import "tailwindcss"`)
- [x] Verificação manual no navegador (tela de Login, mobile) idêntica pixel a pixel ao estado anterior
- [x] `npm run test` (vitest full suite) — ver nota
- [x] Nenhuma tela existente mudou de aparência — só fundação aditiva, nada removido
