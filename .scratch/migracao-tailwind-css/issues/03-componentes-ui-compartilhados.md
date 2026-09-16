# 03: Componentes UI compartilhados

**What to build:** os componentes reutilizáveis de `src/components/ui/*` (`Button`, `Input`, `Select`, `Switch`, `Textarea`, `Radio`, `Checkbox`, `IconButton`, `SearchInput`, `SegmentedControl`, `Pagination`, `Drawer`, `Card`, `ConfirmDialog`, `DataTable`, `PercentageBar`, `StatCard`, `EmptyBoxIllustration`, `EmptyState`, `Badge`) passam a ser estilizados em utilitários Tailwind, usando os tokens do ticket 01. Toda tela que os consome herda a conversão automaticamente, sem precisar tocar nelas neste ticket.

**Blocked by:** 01 (Fundação Tailwind), 02 (Remoção do modo escuro)

**Status:** ready-for-agent

- [ ] Cada componente listado tem seu CSS legado (arquivo dedicado ou bloco `<style>` inline) substituído por classes utilitárias Tailwind
- [ ] Aparência e comportamento de cada componente, verificados manualmente em pelo menos uma tela que o consome, são idênticos aos de antes da conversão
- [ ] `!important` usado em algum desses componentes é resolvido removendo o conflito de especificidade subjacente, ou documentado como resíduo necessário (widget de terceiro/navegador)
- [ ] Testes de `src/components/ui/__tests__/ui.test.tsx` continuam passando; seletores por classe CSS removida são reescritos para role/texto/label
- [ ] CSS legado desses componentes é apagado só depois da verificação visual
- [ ] `npm run test`, `npm run build` e `oxlint` continuam passando
