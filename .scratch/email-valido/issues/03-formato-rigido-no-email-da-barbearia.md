# 03: Formato rígido no e-mail da barbearia (cadastro e Configurações)

**What to build:** o e-mail comercial da barbearia segue a regra única em todo lugar. O cadastro de barbearia passa a usar o módulo de e-mail. Em Configurações, o e-mail de contato passa a ser obrigatório e validado: hoje dá para salvar vazio ou mal formado. No banco, `tenants` ganha CHECK, e o trigger de criação de usuário valida o e-mail da barbearia com `public.email_valido`.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] O CHECK em `tenants.email` exige `public.email_valido(email)`, com `not valid` e depois `validate constraint`; a coluna já é `NOT NULL`
- [ ] O trigger `handle_new_user` valida o e-mail da barbearia com `public.email_valido`; `INVALID_TENANT_EMAIL` continua sendo o erro
- [ ] O cadastro de barbearia usa a validação do módulo no e-mail comercial
- [ ] Configurações recusa salvar com o e-mail de contato vazio ou mal formado e mostra o erro no campo
- [ ] O pgTAP cobre o UPDATE de `tenants` recusado e o cadastro recusado pelo trigger com e-mail da barbearia mal formado
- [ ] Os testes de página de Configurações e do cadastro de barbearia cobrem a recusa
- [ ] A migration é aplicada só no DEV; `get_advisors` sem alerta novo
- [ ] `npm run lint`, `npm test` e `npm run build` passam
