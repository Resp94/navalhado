# 07 — Canal do Cliente: Cancelamento com Barbearia e Cards Responsivos

**What to build:** Redirecionar clientes com prazo de cancelamento expirado para o contato oficial da barbearia/recepção no WhatsApp (`tenant_phone`), e refatorar as dimensões dos cards de serviços no catálogo online e gestão conforme os padrões mobile-first `@responsivo` (touch targets de 44px, grid auto-ajustável e tipografia sem quebra).

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] Atualizar o modal de prazo de cancelamento expirado em `MenuCliente.tsx` para exibir aviso claro orientando o contato com a barbearia/estabelecimento.
- [x] Alterar o botão de ação para *"Falar com a barbearia no WhatsApp"*, utilizando o número da barbearia (`tenant_phone`) com mensagem pré-formatada adequada.
- [x] Refatorar a estilização dos cards de serviços em `FluxoAgendamento.tsx` e `Servicos.tsx` aplicando as regras do `@responsivo` (touch targets de 44px, grid auto-ajustável `minmax(min(100%, 300px), 1fr)`, sem overflow em 320px a 390px).
- [x] Atualizar testes unitários em `MenuCliente.test.tsx`.
