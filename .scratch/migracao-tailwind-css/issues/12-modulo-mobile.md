# 12: Módulo mobile

**What to build:** os componentes de `src/pages/gerente/mobile/*` (`MobileAgendaView`, `MobileCaixaView`) e de navegação mobile (`MobileHeader`, `MobileBottomNav`, `MobileBottomSheet`, `MobileMaisDrawer`) passam a usar utilitários Tailwind, preservando safe-area insets e comportamento fixo/sticky.

**Blocked by:** 01 (Fundação Tailwind), 02 (Remoção do modo escuro), 03 (Componentes UI compartilhados)

**Status:** ready-for-agent

- [ ] Bloco `<style>` inline de cada componente listado removido e convertido
- [ ] Safe-area insets (topo/base) e comportamento fixo/sticky preservados em viewport mobile
- [ ] Agenda mobile (chips de profissional, timeline, seletor de data, navegação inferior) verificada manualmente em largura mobile, incluindo as mudanças já aplicadas nesta sessão (`CustomDatePicker`, ícones sem fill)
- [ ] Testes existentes (`MobileBottomNav.test.tsx`, `MobileBottomSheet.test.tsx`, `MobileMaisDrawer.test.tsx`, `MobileNav.relatorios.test.tsx`) continuam passando, com seletores por classe CSS removida reescritos
- [ ] `npm run test`, `npm run build` e `oxlint` continuam passando
