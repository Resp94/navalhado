# 07 — Validação Integrada, Testes Automatizados e Build de Produção

**What to build:**
A validação ponta a ponta de todas as regras implementadas nos tickets anteriores através de testes unitários no Vitest e Deno, além de conferência do bundle de produção com `npm run build` e typecheck sem erros com `tsc`.

**Blocked by:** 01 — Migration 055: Slots Canônicos, Origem de Cadastro, Trava de Antecedência e Reagendamento, 02 — Mensageria Inteligente e Link de Primeiro Contato na Edge Function, 03 — Lembretes Pontuais no Horário do Gerente e Roteamento Resiliente, 04 — Templates de WhatsApp com Link Opcional e Editor Visual Flexível, 05 — Trava de Segurança de Antecedência e Regras de Slots Online, 06 — Reagendamento Direto na Agenda e Comanda sem Cancelamento Fantasma

**Status:** done

- [x] Executar testes de unidade Deno da Edge Function `whatsapp-integration/index_test.ts` validando `isFirstMessageOfDayForCustomer`, `resolveCustomerMessageWithDailyLink` e normalização de rotas.
- [x] Executar testes de unidade no Vitest para `templates.test.ts`, `Whatsapp.test.tsx`, `FluxoAgendamento.test.tsx`, `Configuracoes.test.tsx` e `Agenda.test.tsx`.
- [x] Executar build de produção (`npm run build` / `tsc -b && vite build`) garantindo zero regressões de tipagem e bundling bem-sucedido.
