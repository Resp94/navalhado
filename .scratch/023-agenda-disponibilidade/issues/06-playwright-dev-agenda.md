# 06 — Validar a Spec 023 com Playwright em DEV

**What to build:** Uma suíte Playwright que valide de ponta a ponta os comportamentos da Spec 023 na Agenda, usando somente o ambiente DEV e dados isolados.

**Blocked by:** 05 — Integrar a disponibilidade na Agenda.

**Status:** ready-for-agent

- [ ] A configuração Playwright aponta exclusivamente para DEV.
- [ ] As credenciais são carregadas somente de `docs/credenciais_teste.md`.
- [ ] Nenhuma credencial aparece em código, fixtures, screenshots, traces ou logs.
- [ ] As fixtures criam tenant, profissional, serviço, appointment e bloqueio isolados.
- [ ] Os testes cobrem intervalos configuráveis, retorno de pausa, escala profissional e `Tanto faz`.
- [ ] Os testes cobrem duração base, duração personalizada, conflitos, bloqueios e antecedência mínima.
- [ ] Os testes cobrem o último slot e serviço terminando após o fechamento.
- [ ] Os testes confirmam que horários configurados como `12:00–14:00` são preservados.
- [ ] Falhas produzem evidências suficientes sem expor dados sensíveis.
- [ ] Nenhum teste, consulta ou migration é executado em produção.
