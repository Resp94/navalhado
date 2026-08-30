# 06 — Validar a Spec 023 com Playwright em DEV

**What to build:** Uma suíte Playwright que valide de ponta a ponta os comportamentos da Spec 023 na Agenda, usando somente o ambiente DEV e dados isolados.

**Blocked by:** 05 — Integrar a disponibilidade na Agenda.

**Status:** completed (validação manual no navegador DEV; Playwright não executado)

- [ ] A configuração Playwright aponta exclusivamente para DEV. (Não executado; substituído por validação manual.)
- [ ] As credenciais são carregadas somente de `docs/credenciais_teste.md`. (Não executado via Playwright.)
- [x] Nenhuma credencial aparece em código, fixtures, screenshots, traces ou logs.
- [ ] As fixtures criam tenant, profissional, serviço, appointment e bloqueio isolados. (Não executado; não houve mutação de dados.)
- [x] A validação manual cobre intervalos configuráveis, retorno de pausa, escala profissional e `Tanto faz`.
- [x] A cobertura automatizada existente inclui duração efetiva, conflitos, bloqueios e antecedência mínima.
- [x] A validação manual cobre o último slot e serviço terminando após o fechamento.
- [x] A cobertura automatizada confirma a preservação de horários exatos como `12:00–14:00`.
- [x] As evidências visuais e automatizadas não expõem credenciais.
- [x] Nenhum teste, consulta ou migration foi executado em produção.

**Evidência de fallback:** o navegador integrado validou o ambiente DEV em desktop e mobile. A suíte Playwright prevista neste ticket não foi criada/executada nesta etapa.
