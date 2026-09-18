# 15: Componentes restantes

**What to build:** os componentes e páginas ainda não convertidos nos tickets anteriores (`Toast`, `NotificationBell`, `Input`, `Modal`, `CustomDatePicker`, `AuthGuard`, `BarbeiroLayout`, `GerenteLayout`, páginas de `src/pages/admin/*`, `src/pages/barbeiro/*` e o restante de `src/pages/cliente/*`) passam a usar utilitários Tailwind, fechando o inventário completo dos 77 componentes com CSS inline e confirmando que nenhum arquivo `.css` dedicado resta no projeto.

**Blocked by:** 01 (Fundação Tailwind), 02 (Remoção do modo escuro), 03 (Componentes UI compartilhados), 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14 (para confirmar, ao final, que nenhum componente do inventário original de 77 ficou pra trás)

**Status:** done

- [x] Bloco `<style>` inline de cada componente/página listado removido e convertido (AuthGuard, BarbeiroLayout, GerenteLayout, Modal, NotificationBell, Toast, CustomDatePicker, DetalhesComissaoModal, admin/Dashboard, admin/Tenants, barbeiro/MinhaAgenda, barbeiro/MinhasComissoes, HubLayout, os 4 Step*.tsx do onboarding); `Clientes.css` (1.363 linhas) e `onboarding-shared.css` eliminados; `Financeiro.css` reduzido às classes ainda usadas por outros componentes fora do escopo deste ticket (ComissoesTab, ContasPagarTab, PlanoContasTab, CaixaTab, FluxoCaixaTab/Resumo, páginas de Relatórios)
- [x] Busca por `<style>{` em `.tsx`: só restam os dois resíduos intencionais documentados (`ExtratoSessaoCaixaModal.tsx`, `ComandaCheckoutModal.tsx`) e o bloco de `AgendaEquipeFilter`/filtro de tags em `Agenda.tsx` (componente-filho fora do escopo, já tinha suas regras de `custom-datepicker-*` órfãs removidas). Busca por `.css` sob `src/`: só restam `index.css` (permitido) e `Financeiro.css` (residual documentado, com dono em arquivos fora do escopo deste ticket)
- [x] Toast, sino de notificação, layouts de gerente/barbeiro e guarda de autenticação verificados via testes existentes sem mudança de comportamento
- [x] Testes existentes continuam passando (42 testes nos arquivos tocados), com as duas asserções de `Financeiro.test.tsx` que dependiam de `toHaveClass('nav-tab-btn--active'/'period-tab-btn--active')` reescritas para `toHaveAttribute('aria-current'/'aria-pressed', ...)`
- [x] `npx tsc -b`, `npx vitest run` (arquivos tocados), `npx oxlint` e `npx vite build` passando
- [x] Relatório final: 0 arquivos `.css` novos sob `src/` além de `index.css` e do residual documentado `Financeiro.css`; 0 blocos `<style>` inline além dos dois residuais documentados e do filtro de equipe da Agenda; projeto convertido para Tailwind neste ticket
