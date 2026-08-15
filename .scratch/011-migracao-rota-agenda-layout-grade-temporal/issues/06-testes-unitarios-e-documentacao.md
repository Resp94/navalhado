# 06 — Testes Automatizados e Atualização de Documentação de Rotas

**What to build:**
Garantir cobertura de testes automatizados para a nova rota `/agenda`, interações da Navbar, redirecionamentos do Gatekeeper e atualização dos documentos de rotas e telas do projeto.

**Blocked by:** 02, 03, 04, 05.

**Status:** ready-for-agent

- [ ] Testes em `src/components/__tests__/GerenteLayout.test.tsx` atualizados para validar o link `/agenda`.
- [ ] Testes em `src/pages/__tests__/OnboardingWizard.test.tsx` atualizados para validar redirecionamento para `/agenda`.
- [ ] Teste unitário para o componente `Agenda.tsx` validando renderização de horários e profissionais.
- [ ] Documentos `docs/arquitetura_rotas.md` e `docs/telas.md` atualizados com a rota canônica `/agenda`.
- [ ] Execução completa de `npm test` garantindo 100% de testes passando.
