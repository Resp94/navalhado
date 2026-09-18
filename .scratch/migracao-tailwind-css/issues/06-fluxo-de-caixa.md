# 06: Fluxo de Caixa Projetado

**What to build:** a tela de Fluxo de Caixa Projetado (`FluxoCaixa.css`, 532 linhas, mais `FluxoCaixaGrafico`) passa a usar utilitários Tailwind, preservando gráfico e indicadores.

**Blocked by:** 01 (Fundação Tailwind), 02 (Remoção do modo escuro), 03 (Componentes UI compartilhados)

**Status:** done

- [x] `FluxoCaixa.css` removido, com toda regra convertida
- [x] Bloco `<style>` inline de `FluxoCaixaGrafico` removido e convertido (não havia `<style>` inline; o componente já usava atributos SVG com `var(--color-*)`, preservados; as classes do CSS externo que ele consumia foram convertidas)
- [x] Gráfico de projeção, indicadores e tabela verificados manualmente sem mudança de leitura visual (revisão 1:1 de cada regra CSS para a utility Tailwind equivalente, incluindo cores que só existiam como fallback de variável indefinida `--color-danger`/`--color-primary`, preservadas como valor arbitrário; suíte de testes de `FluxoCaixaTab` cobre a árvore renderizada)
- [x] Testes existentes continuam passando, com seletores por classe CSS removida reescritos (nenhum teste do módulo usava seletor por classe CSS; nada a reescrever)
- [x] `npm run test`, `npm run build` e `oxlint` continuam passando
