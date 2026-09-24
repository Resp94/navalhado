# 03: Sininho vazio para barbeiro sem cadastro de profissional vinculado

**What to build:** quando o Barbeiro entra e não tem cadastro de profissional vinculado ao login, o sininho fica vazio. Hoje a busca de notificações, sem profissional e sem ser do Gerente, vem sem filtro de destinatário, e só a RLS impede que ele veja notificações de outros. A busca passa a não consultar o banco, não assinar o tempo real e devolver lista vazia nesse caso. Com profissional, continua filtrando por ele; com Gerente, continua filtrando pelas notificações gerais (`professional_id` nulo).

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Teste do hook de notificações: sem profissional e sem ser Gerente, não há consulta ao banco nem assinatura do tempo real, e a lista fica vazia com contagem 0. Falha antes da mudança, passa depois
- [x] Os testes atuais do hook continuam passando (filtro por profissional, filtro do Gerente, descarte de notificação de outro profissional e de outro tenant no tempo real)
- [x] `npm run lint`, `npm test` e `npm run build` passam

## Resultado (2026-09-24)

`useRealtimeNotifications` passa a devolver lista vazia sem consultar o banco nem assinar o tempo real quando não recebe `profissionalId` nem `isGerente`. Seis testes que usavam esse formato como atalho para "busca funciona" passaram a exercitar `isGerente: true`, caso real do `GerenteLayout`. 13/13 testes do hook passam. `npm run lint`, `npm test` (1318 testes) e `npm run build` passam.
