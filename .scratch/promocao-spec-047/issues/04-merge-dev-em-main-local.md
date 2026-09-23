# 04: Merge `dev` em `main`, só local

**What to build:** a `main` local recebe a spec 047 num merge commit identificável, com o conflito da `create-barber-access` resolvido pela versão da `dev`, e passa em toda a verificação local. Nada é enviado ao remoto.

**Blocked by:** 01 (Conferências antes de promover).

**Status:** ready-for-agent

- [ ] Merge de `dev` em `main` com `--no-ff`
- [ ] Conflito add/add resolvido ficando com a versão da `dev` do arquivo
- [ ] Nenhum outro conflito
- [ ] `npm run lint`, `npm test` e `npm run build` passam no resultado
- [ ] Testes Deno da `create-barber-access` passam
- [ ] `deno.lock` sem mudança alheia no commit de merge
- [ ] Sem push
