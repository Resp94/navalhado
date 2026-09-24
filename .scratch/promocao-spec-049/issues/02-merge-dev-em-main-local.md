# 02: Merge de `dev` em `main`, local

**What to build:** a `main` local com a spec 049, por um merge commit, provada pela suíte antes de qualquer push.

**Blocked by:** 01

**Status:** ready-for-agent (depois do 01)

- [x] `git merge --no-ff dev` na `main` local, sem push
- [x] `npm run lint` sem erro novo, `npm test` e `npm run build` passam
- [x] 11 testes Deno do handler da `send-auth-email` passam (`--no-check --allow-net --allow-env --min-dep-age 0`); `deno.lock` restaurado depois
- [x] Resultado registrado na spec 050

## Resultado (2026-09-24)

Merge sem conflito, como previsto: `git merge --no-ff dev` na `main` local, estratégia `ort`, sem intervenção manual.

- **Lint.** `npx oxlint`: 0 erros; 49 warnings, todos pré-existentes (nenhum em `send-auth-email`).
- **Build.** `tsc -b && vite build`: passou.
- **Testes.** `npm test`: 1316/1316.
- **Deno.** `deno test --no-check --allow-net --allow-env --min-dep-age 0`: 11/11. `deno.lock` sem alteração (`git status` limpo depois).

Sem push ainda. Segue para o ticket 03.
