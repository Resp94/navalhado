# 07: Barra lateral (GlassSidebar)

**What to build:** a barra lateral do painel (`GlassSidebar.css`, 663 linhas) passa a usar utilitários Tailwind, preservando o efeito de vidro (`backdrop-filter`) — que pode exigir valor arbitrário Tailwind por não ser trivialmente expressável em utilitário padrão.

**Blocked by:** 01 (Fundação Tailwind), 02 (Remoção do modo escuro), 03 (Componentes UI compartilhados)

**Status:** done

- [x] `GlassSidebar.css` removido, com toda regra convertida
- [x] Efeito de vidro (`backdrop-filter`, transparência, borda) preservado visualmente idêntico ao original
- [x] Estados de expandido/colapsado e item ativo verificados manualmente sem mudança de comportamento
- [x] Teste `src/components/__tests__/GlassSidebar.test.tsx` continua passando, com seletores por classe CSS removida reescritos
- [x] `npm run test`, `npm run build` e `oxlint` continuam passando
