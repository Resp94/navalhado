# 01: Conferências antes de promover

**What to build:** a certeza, logo antes de começar, de que `main` e `dev` locais batem com os remotos, de que o merge continua sem conflito e de que o alias de teste ainda não existe em prod.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Depois do `fetch`, `main` = `origin/main` e `dev` = `origin/dev`; se algum mudou desde `12fbb6a`/`9e63cfe`, a diferença é lida antes de seguir
- [ ] `git merge-tree` entre `main` e `dev` continua sem conflito
- [ ] Prod ainda sem `send-auth-email` (`list_edge_functions`)
- [ ] O alias `+` escolhido para o barbeiro de teste não existe em `auth.users` de prod
- [ ] Resultado registrado na spec 050
