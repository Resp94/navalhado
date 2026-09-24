# 06: Sincronizar `dev` com `main` e fechar a spec

**What to build:** a spec 050 fechada e `dev` e `main` apontando para o mesmo commit, com a `dev` recebendo a documentação da spec 048 que só existia na `main`.

**Blocked by:** 05

**Status:** done

- [ ] Spec 050 registra a data da promoção, o commit levado à `main` e o resultado de cada prova, e é encerrada (commit na `main` local)
- [ ] Push da `main` com os registros dos tickets 04 a 06, com confirmação do usuário
- [ ] `dev` avança por fast-forward até a `main` e sobe
- [ ] `main`, `dev`, `origin/main` e `origin/dev` no mesmo commit
