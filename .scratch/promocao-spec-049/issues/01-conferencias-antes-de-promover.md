# 01: Conferências antes de promover

**What to build:** a certeza, logo antes de começar, de que `main` e `dev` locais batem com os remotos, de que o merge continua sem conflito e de que o alias de teste ainda não existe em prod.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Depois do `fetch`, `main` = `origin/main` e `dev` = `origin/dev`; se algum mudou desde `12fbb6a`/`9e63cfe`, a diferença é lida antes de seguir
- [x] `git merge-tree` entre `main` e `dev` continua sem conflito
- [x] Prod ainda sem `send-auth-email` (`list_edge_functions`)
- [x] O alias `+` escolhido para o barbeiro de teste não existe em `auth.users` de prod
- [x] Resultado registrado na spec 050

## Resultado (2026-09-24)

`dev` local = `origin/dev` = `b08c388` (spec 050 recém empurrada), sem novidade.

**`main` avançou desde a montagem da spec.** De `12fbb6a` para `78af32e`, um merge feito fora desta sessão: `merge: leva correcao da mensagem de erro do Acesso do barbeiro para main`, segundo pai `6668ded` (`fix(profissionais): mostra mensagem real da Edge Function no Acesso do barbeiro`). Esse é exatamente o achado fora de escopo que a spec 048 tinha registrado (mensagem genérica da Edge Function em vez da específica) — foi corrigido na `dev` como `6668ded` e agora promovido à parte para `main`.

**Sem risco novo:** `6668ded` já é ancestral da `dev` (é o commit-base usado para montar a spec 049 e a 050). `git diff 6668ded 78af32e^2 -- src/pages/gerente/CadastroAcesso.tsx` vazio — conteúdo idêntico. `git merge-tree` entre `origin/main` (`78af32e`) e `origin/dev` (`b08c388`) continua limpo, sem conflito.

Prod: 3 Edge Functions (`whatsapp-integration`, `public-customer-session`, `create-barber-access`), sem `send-auth-email`. E-mail escolhido para o ticket 05: `resplandesjonathas+spike050barbeiro@gmail.com`, sem conta em prod.

**Correção (ainda no ticket 01):** o usuário apontou que esse alias `+` não serve. `resplandesjonathas@gmail.com` já é a conta de gerente do tenant "Barber Tester" em prod (desde julho/2026), então não pode ser reaproveitado para o barbeiro. Trocado para `resplandesjonathas7@gmail.com` — real, sem alias, o mesmo já usado nos testes de prod da spec 048, sem conta em prod hoje. Ticket 05 atualizado.

Segue para o ticket 02.
