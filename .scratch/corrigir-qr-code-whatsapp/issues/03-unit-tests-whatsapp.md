# 03 — Atualização e Validação dos Testes Unitários (Whatsapp.test.tsx)

**What to build:** Atualização da suíte de testes do componente `Whatsapp.test.tsx` para cobrir o fluxo de invocação direta da Edge Function e a verificação do tratamento de erros e exibição de Toasts.

**Blocked by:** 02 — Invocação Direta da Edge Function e Exibição de Toast no Frontend (Whatsapp.tsx)

**Status:** done

- [x] Teste unitário garante que o clique em "Gerar QR Code de Conexão" chama `supabase.functions.invoke`.
- [x] Teste unitário valida a exibição do Toast de erro caso a chamada da Edge Function retorne exceção.
- [x] Todos os testes da suíte de testes de frontend passam sem erros (`npm run test`).
