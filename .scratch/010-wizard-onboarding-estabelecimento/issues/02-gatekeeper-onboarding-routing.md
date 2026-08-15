# 02 — Gatekeeper de Onboarding & Roteamento Protegido

**What to build:**
A camada de guarda de rotas e interceptação no frontend que garante que qualquer Gestor com `onboarding_completed: false` seja compulsoriamente direcionado para a rota `/onboarding`, impedindo o acesso antecipado a `/dashboard`, `/agenda`, `/financeiro`, `/profissionais` e `/servicos`, além de impedir que um Gestor que já concluiu o onboarding reacesse o wizard indevidamente.

**Blocked by:** 01 — Migration de Schema do Tenant, RLS e Aplicação no Banco Dev via MCP

**Status:** done

- [x] Rota `/onboarding` registrada e mapeada no `src/App.tsx`.
- [x] Contexto de Tenant e Layout de Gerente (`src/components/GerenteLayout.tsx`) atualizado para carregar a flag `onboarding_completed`.
- [x] Gatekeeper implementado: redireciona para `/onboarding` se `onboarding_completed === false` ao tentar acessar rotas operacionais do tenant.
- [x] Redirecionamento inverso implementado: se o usuário já possui `onboarding_completed === true` e tenta navegar para `/onboarding`, é redirecionado para `/dashboard`.
- [x] Testes automatizados cobrindo os cenários de interceptação e liberação do Gatekeeper.
