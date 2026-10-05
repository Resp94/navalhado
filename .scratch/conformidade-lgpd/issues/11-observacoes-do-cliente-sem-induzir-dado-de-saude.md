# 11: O campo de observações do cliente não induz a anotar dado de saúde

Parte da spec 055 (Conformidade com os novos Termos e Política).

**What to build:** o exemplo do campo de observações do cliente (`src/pages/gerente/Clientes.tsx:729`, hoje "Preferências de corte, formato da barba, café favorito ou restrições...") perde "restrições". Uma alternativa: "Preferências de corte, formato da barba, café favorito...".

Dado de saúde é sensível (LGPD, art. 11), e a Política (seção 4.2) pede que a barbearia não o registre ali.

**Blocked by:** None (can start immediately)

**Status:** ready

- [ ] Texto trocado; os testes que citam o placeholder foram atualizados
- [ ] Gates de lint, Vitest e build passam
