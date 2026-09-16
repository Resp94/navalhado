# 09: Central 360º do Cliente

**What to build:** a Central 360º do cliente (`cliente.css`, 879 linhas, mais `TimelineHistoricoAgendamentos` e demais componentes de `src/pages/cliente/*` e `src/components/cliente/*` relevantes) passa a usar utilitários Tailwind.

**Blocked by:** 01 (Fundação Tailwind), 02 (Remoção do modo escuro), 03 (Componentes UI compartilhados)

**Status:** ready-for-agent

- [ ] `cliente.css` removido, com toda regra convertida
- [ ] Bloco `<style>` inline de `TimelineHistoricoAgendamentos` e demais componentes da Central 360º removido e convertido
- [ ] Timeline de histórico, dados de perfil e ações do cliente verificados manualmente sem mudança de comportamento
- [ ] Teste `src/components/cliente/__tests__/TimelineHistoricoAgendamentos.test.tsx` continua passando, com seletores por classe CSS removida reescritos
- [ ] `npm run test`, `npm run build` e `oxlint` continuam passando
