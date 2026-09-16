# 06: Fluxo de Caixa Projetado

**What to build:** a tela de Fluxo de Caixa Projetado (`FluxoCaixa.css`, 532 linhas, mais `FluxoCaixaGrafico`) passa a usar utilitários Tailwind, preservando gráfico e indicadores.

**Blocked by:** 01 (Fundação Tailwind), 02 (Remoção do modo escuro), 03 (Componentes UI compartilhados)

**Status:** ready-for-agent

- [ ] `FluxoCaixa.css` removido, com toda regra convertida
- [ ] Bloco `<style>` inline de `FluxoCaixaGrafico` removido e convertido
- [ ] Gráfico de projeção, indicadores e tabela verificados manualmente sem mudança de leitura visual
- [ ] Testes existentes continuam passando, com seletores por classe CSS removida reescritos
- [ ] `npm run test`, `npm run build` e `oxlint` continuam passando
