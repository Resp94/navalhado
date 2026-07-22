# 03 — Atualização e Validação dos Testes Unitários Frontend e Backend

**What to build:** Atualização e expansão da suíte de testes unitários no frontend (`Whatsapp.test.tsx`) e no backend (`index_test.ts`):
1. `Whatsapp.test.tsx`: Testes cobrindo ativação real na VPS com rollback em caso de falha, solicitação de QR Code com `invoke` e exibição de Toasts de erro.
2. `index_test.ts`: Testes Deno da Edge Function validando a permissão estrita da role `gerente` e a rejeição HTTP 403 para outros perfis.

**Blocked by:** 02 — Ativação Real na VPS, Invocação Direta do QR Code e Toasts no Frontend (Whatsapp.tsx)

**Status:** ready-for-agent

- [ ] Teste unitário em `Whatsapp.test.tsx` valida a criação de instância acionando `manage-instance` (`action: 'create'`) e testando o rollback em caso de falha.
- [ ] Teste unitário em `Whatsapp.test.tsx` garante que o clique em "Gerar QR Code de Conexão" chama `manage-instance` (`action: 'connect'`) e exibe o Toast de erro.
- [ ] Teste Deno em `index_test.ts` valida que apenas usuários com `role === 'gerente'` do mesmo tenant passam na autorização.
- [ ] Teste Deno em `index_test.ts` valida a rejeição HTTP 403 para usuários não-gerentes.
- [ ] Todos os testes da suíte de testes passam sem erros (`npm run test`).
