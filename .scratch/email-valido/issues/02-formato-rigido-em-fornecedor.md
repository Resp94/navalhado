# 02: Formato rígido de e-mail em Fornecedor

**What to build:** o cadastro de Fornecedor passa a usar a mesma regra única de formato do Cliente. O CHECK atual de `suppliers`, com a regex antiga e frouxa, é trocado por um que chama `public.email_valido`. As RPCs de criar e atualizar Fornecedor param de repetir a regex, e o repository do Plano de Contas usa o módulo de e-mail. O e-mail continua opcional.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] O `suppliers_email_check` é substituído por um CHECK com nulo ou `public.email_valido(email)`, com `not valid` e depois `validate constraint`
- [ ] As RPCs de criar e atualizar Fornecedor validam com `public.email_valido`; o código e a mensagem de erro de hoje continuam iguais
- [ ] O PlanoContasRepository usa a validação do módulo de e-mail no lugar da regex local
- [ ] O pgTAP cobre a recusa de formato antes aceito, pela RPC e pela tabela, e o nulo aceito; os testes 28 e 29 continuam passando
- [ ] A migration é aplicada só no DEV; `get_advisors` sem alerta novo
- [ ] `npm run lint`, `npm test` e `npm run build` passam
