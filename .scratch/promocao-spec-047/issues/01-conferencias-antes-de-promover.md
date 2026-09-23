# 01: Conferências antes de promover

**What to build:** antes de tocar em produção, provar que o ponto de partida é o esperado pela spec 048. Git local bate com o remoto, a `main` não ganhou commit novo, o Auth de prod está com a confirmação ligada e nenhum e-mail gravado em prod fura a regra de formato da spec 047. Qualquer divergência para a promoção.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] `main` e `dev` locais iguais a `origin/main` e `origin/dev` depois do `fetch`
- [ ] `main` continua em `a13b1b3` e a base comum com a `dev` continua `af67361`
- [ ] Merge simulado (`git merge-tree`) mostra só o conflito add/add conhecido na `create-barber-access`
- [ ] `/auth/v1/settings` de prod responde `mailer_autoconfirm: false`
- [ ] Zero e-mails fora da regra em `customers`, `suppliers`, `tenants` e `users` de prod
- [ ] Resultado registrado na spec 048
