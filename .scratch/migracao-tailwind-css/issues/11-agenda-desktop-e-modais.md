# 11: Agenda desktop e modais de atendimento

**What to build:** a Agenda desktop e seus modais (`BloqueioModal`, `ComandaCheckoutModal`, `ListaEsperaDrawer`, `ConfirmSoftDeleteModal`) passam a usar utilitários Tailwind, preservando a grade temporal, estados de erro e sucesso.

**Blocked by:** 01 (Fundação Tailwind), 02 (Remoção do modo escuro), 03 (Componentes UI compartilhados)

**Status:** ready-for-agent

- [ ] Bloco `<style>` inline da Agenda desktop e de cada modal listado removido e convertido
- [ ] Bloqueio de horário, checkout de comanda e lista de espera verificados manualmente sem mudança de comportamento
- [ ] Testes existentes (`BloqueioModal.test.tsx`, `ComandaCheckoutModal.test.tsx`, `ListaEsperaDrawer.test.tsx`, `ConfirmSoftDeleteModal.test.tsx`) continuam passando, com seletores por classe CSS removida reescritos
- [ ] `npm run test`, `npm run build` e `oxlint` continuam passando
