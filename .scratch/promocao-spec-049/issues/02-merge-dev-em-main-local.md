# 02: Merge de `dev` em `main`, local

**What to build:** a `main` local com a spec 049, por um merge commit, provada pela suíte antes de qualquer push.

**Blocked by:** 01

**Status:** ready-for-agent (depois do 01)

- [ ] `git merge --no-ff dev` na `main` local, sem push
- [ ] `npm run lint` sem erro novo, `npm test` e `npm run build` passam
- [ ] 11 testes Deno do handler da `send-auth-email` passam (`--no-check --allow-net --allow-env --min-dep-age 0`); `deno.lock` restaurado depois
- [ ] Resultado registrado na spec 050
