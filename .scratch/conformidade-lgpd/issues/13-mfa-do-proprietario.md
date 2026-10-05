# 13: O Proprietário entra com segundo fator (MFA)

Parte da spec 055 (Conformidade com os novos Termos e Política).

**What to build:** o Proprietário cadastra um app autenticador (TOTP do Supabase Auth) e passa a informar o código ao entrar.

- O `AuthGuard` do papel `proprietario` exige sessão `aal2`.
- As RPCs guardadas por `private.assert_saas_admin()` passam a conferir `aal = 'aal2'` no JWT, para a guarda não ficar só na tela.

Hoje o acesso que lê todas as barbearias entra só com senha. A Política (seção 10) diz que o acesso administrativo é restrito.

**Blocked by:** None (can start immediately)

**Status:** ready

- [ ] Conferir na documentação do Supabase o fluxo do MFA (enroll, challenge, verify) e se ele está ligado no projeto do DEV
- [ ] Telas de cadastro do fator e de código, só para o Proprietário
- [ ] Migration só no DEV: `assert_saas_admin` confere o `aal`
- [ ] pgTAP: um JWT `aal1` do Proprietário é recusado e um `aal2` passa (o pgTAP 78 e o 80 continuam verdes com `aal2`)
- [ ] Vitest do `AuthGuard` com `aal1` e com `aal2`
- [ ] Antes de aplicar no DEV, combinar com o usuário o cadastro do fator do Proprietário de teste, para ele não ficar trancado fora
- [ ] Gates de lint, Vitest e build passam
