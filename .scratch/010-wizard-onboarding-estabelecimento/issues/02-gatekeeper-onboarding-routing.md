# 02 — Gatekeeper de Onboarding & Roteamento Protegido

**What to build:**
A camada de guarda de rotas e interceptação no frontend que garante que qualquer Gestor com `onboarding_completed: false` seja compulsoriamente direcionado para a rota `/onboarding`, impedindo o acesso antecipado a `/dashboard`, `/agenda`, `/financeiro`, `/profissionais` e `/servicos`, além de impedir que um Gestor que já concluiu o onboarding reacesse o wizard indevidamente.

**Blocked by:** 01 — Migration de Schema do Tenant, RLS e Aplicação no Banco Dev via MCP

**Status:** ready-for-agent

- [ ] Rota `/onboarding` registrada e mapeada no `src/App.tsx`.
- [ ] Contexto de Tenant e Layout de Gerente (`src/components/GerenteLayout.tsx`) atualizado para carregar a flag `onboarding_completed`.
- [ ] Gatekeeper implementado: redireciona para `/onboarding` se `onboarding_completed === false` ao tentar acessar rotas operacionais do tenant.
- [ ] Redirecionamento inverso implementado: se o usuário já possui `onboarding_completed === true` e tenta navegar para `/onboarding`, é redirecionado para `/dashboard`.
- [ ] Testes automatizados cobrindo os cenários de interceptação e liberação do Gatekeeper.
