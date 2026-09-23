# 01: Formato rígido de e-mail no cadastro de Cliente

**What to build:** o cadastro de Cliente passa a recusar e-mails mal formados que hoje passam: `jon@x.c`, `jon..a@x.com`, `.jon@x.com`, `jon@-x.com`. É a fatia de base da spec 047. Ela cria a regra única de formato nas três camadas (o módulo de e-mail do front, a função `public.email_valido` no banco e o CHECK em `customers`) e prova o caminho de ponta a ponta no Cliente. O e-mail do Cliente continua opcional.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] O módulo de e-mail do front expõe a validação de formato, com a regra da spec 047: parte local sem ponto no início, no fim ou duplicado; hífen só no meio do rótulo; TLD com 2 ou mais letras; maiúsculas e minúsculas indiferentes
- [ ] Os testes do módulo usam uma tabela de casos, com cerca de 20 aceitos e recusados, reutilizável pelas outras camadas
- [ ] A função `public.email_valido(text)` existe: `language sql`, `immutable`, `set search_path = ''`, `security invoker`
- [ ] O CHECK em `customers.email` aceita nulo ou e-mail válido, criado com `not valid` e depois `validate constraint`
- [ ] O ClienteRepository usa a validação do módulo no lugar da regex local; os testes do repository cobrem os formatos que antes passavam e agora são recusados
- [ ] A tela de Clientes mostra o erro de formato no campo e não salva
- [ ] Um pgTAP novo, numerado depois do último existente, cobre a função com a mesma tabela de casos do front e o INSERT/UPDATE recusado em `customers`, com nulo aceito
- [ ] A migration é aplicada só no DEV; `get_advisors` sem alerta novo
- [ ] `npm run lint`, `npm test` e `npm run build` passam
