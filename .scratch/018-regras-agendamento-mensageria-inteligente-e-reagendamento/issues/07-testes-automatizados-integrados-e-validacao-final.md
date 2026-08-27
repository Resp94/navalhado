# 07 — Testes Automatizados Integrados e Validação Ponta a Ponta

**What to build:**
A validação integrada completa de toda a suíte de testes automatizados do frontend (Vitest) e da Edge Function (Deno Test), assegurando que todas as regressões potenciais sejam cobertas, que o build e lint passem sem erros e que todos os fluxos da especificação estejam 100% verificados.

**Blocked by:** 01 — Migration 055: Slots Canônicos, Origem de Cadastro, Trava de Antecedência e Reagendamento, 02 — Mensageria Inteligente e Link de Primeiro Contato na Edge Function, 03 — Lembretes Pontuais no Horário do Gerente e Roteamento Resiliente, 04 — Templates de WhatsApp com Link Opcional e Editor Visual Flexível, 05 — Trava de Segurança de Antecedência e Regras de Slots Online, 06 — Reagendamento Direto de Horário na Agenda e na Comanda

**Status:** ready-for-agent

- [ ] Executar todos os testes do frontend com `npm run test` (ou `npx vitest run`).
- [ ] Executar testes da Edge Function com `deno test` em `supabase/functions/whatsapp-integration/index_test.ts`.
- [ ] Executar `npm run build` ou `tsc --noEmit` para verificar ausência de erros de tipagem.
- [ ] Validar manualmente os fluxos principais e documentar walkthrough final.
