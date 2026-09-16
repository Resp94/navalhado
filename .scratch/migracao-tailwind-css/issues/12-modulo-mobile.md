# 12: Módulo mobile

**What to build:** os componentes de `src/pages/gerente/mobile/*` (`MobileAgendaView`, `MobileCaixaView`) e de navegação mobile (`MobileHeader`, `MobileBottomNav`, `MobileBottomSheet`, `MobileMaisDrawer`) passam a usar utilitários Tailwind, preservando safe-area insets e comportamento fixo/sticky.

**Blocked by:** 01 (Fundação Tailwind), 02 (Remoção do modo escuro), 03 (Componentes UI compartilhados)

**Status:** done

- [x] Bloco `<style>` inline de cada componente listado removido e convertido
- [x] Safe-area insets (topo/base) e comportamento fixo/sticky preservados em viewport mobile
- [x] Agenda mobile (chips de profissional, timeline, seletor de data, navegação inferior) verificada manualmente em largura mobile, incluindo as mudanças já aplicadas nesta sessão (`CustomDatePicker`, ícones sem fill)
- [x] Testes existentes (`MobileBottomNav.test.tsx`, `MobileBottomSheet.test.tsx`, `MobileMaisDrawer.test.tsx`, `MobileNav.relatorios.test.tsx`) continuam passando, com seletores por classe CSS removida reescritos
- [x] `npm run test`, `npm run build` e `oxlint` continuam passando

**Notas de implementação:**
- Cores de estado do card de agendamento (`MobileAgendaView`) que dependem de combinação de estados (encaixe + pago, etc.) usam `style` inline restrito (função `getAgendaCardStyle`), pois a suíte de testes não carrega o pipeline de CSS/Tailwind — preserva o teste de `getComputedStyle` existente. As classes `mobile-agenda__card--fitting/--paid/--active/--no-show/--normal` foram mantidas apenas como marcadores usados pelos testes, sem CSS próprio.
- `MobileBottomSheet`: a animação de slide-up do painel foi reimplementada com `transition-transform` + estado de montagem (sem novos `@keyframes`, já que `src/index.css` não pode ser tocado neste ticket); o backdrop reaproveita o token `animate-fade-in` já existente.
- O `CustomDatePicker` (fora do escopo deste ticket) recebe overrides via `className` com modificador `!` do Tailwind, para reposicionar o dropdown como painel fixo em mobile — documentado inline como exceção ao uso de `!important`.
