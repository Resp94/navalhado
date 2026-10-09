# 06: Promoção para PROD

Parte da spec 056 (Contatos do Site no painel do Proprietário).

**What to build:** a aba Contatos e o contador funcionam no app de produção, lendo e marcando no D1 `navalhado-site`, com as mensagens reais do formulário do site.

**Blocked by:** 05 (Implantação e conferência no DEV)

**Status:** ready

- [ ] OK explícito do usuário antes de qualquer passo em produção
- [ ] Migration da RPC aplicada na PROD (`boakqstrdfqmsrwnjore`) pelo MCP, antes do merge
- [ ] pgTAP 81 rodado na PROD em `begin; ... rollback;`, com o OK do usuário
- [ ] Merge da `dev` na `main` (merge commit, `--no-ff`), com o tipo de merge confirmado com o usuário; deploy do `navalhado` concluído
- [ ] Conferido em produção, logado como Proprietário: a lista mostra os contatos reais, e o contador bate com as mensagens `novo`. Sem enviar formulário falso para o D1 real
- [ ] Se marcar uma mensagem real só para conferir, devolvê-la ao status anterior
