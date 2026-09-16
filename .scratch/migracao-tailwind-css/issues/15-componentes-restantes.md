# 15: Componentes restantes

**What to build:** os componentes e páginas ainda não convertidos nos tickets anteriores (`Toast`, `NotificationBell`, `Input`, `Modal`, `CustomDatePicker`, `AuthGuard`, `BarbeiroLayout`, `GerenteLayout`, páginas de `src/pages/admin/*`, `src/pages/barbeiro/*` e o restante de `src/pages/cliente/*`) passam a usar utilitários Tailwind, fechando o inventário completo dos 77 componentes com CSS inline e confirmando que nenhum arquivo `.css` dedicado resta no projeto.

**Blocked by:** 01 (Fundação Tailwind), 02 (Remoção do modo escuro), 03 (Componentes UI compartilhados), 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14 (para confirmar, ao final, que nenhum componente do inventário original de 77 ficou pra trás)

**Status:** ready-for-agent

- [ ] Bloco `<style>` inline de cada componente/página listado removido e convertido
- [ ] Busca no repositório por `<style>{` em `.tsx` e por arquivos `.css` sob `src/` não retorna nenhum resultado
- [ ] Toast, sino de notificação, layouts de gerente/barbeiro e guarda de autenticação verificados manualmente sem mudança de comportamento
- [ ] Testes existentes desses componentes (`AuthGuard.test.tsx`, `NotificationBell.test.tsx`, `TurnstileCaptcha.test.tsx`, `Dashboard.test.tsx` e demais) continuam passando, com seletores por classe CSS removida reescritos
- [ ] `npm run test`, `npm run build` e `oxlint` continuam passando
- [ ] Relatório final confirma: 0 arquivos `.css` sob `src/`, 0 blocos `<style>` inline, projeto 100% Tailwind
