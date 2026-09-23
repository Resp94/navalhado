# 06: Sugestão de erro de digitação, no cadastro de Cliente

**What to build:** ao digitar `joao@gmial.com` no cadastro de Cliente, a tela pergunta "Você quis dizer joao@gmail.com?" e corrige o campo com um clique. A sugestão cobre provedores comuns (gmail, hotmail, outlook, live, yahoo, icloud, uol, bol, terra e variações `.com.br`) e nunca bloqueia o salvamento.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] O módulo de e-mail expõe a sugestão de correção de domínio, por distância de edição até 2, contra uma lista local curta
- [ ] Domínio exato da lista, ou sem parecido, não gera sugestão
- [ ] O hook expõe a sugestão e uma ação que aplica a correção; depois de aplicada, a validação roda de novo
- [ ] A tela de Clientes mostra a sugestão com um botão, e salvar com a sugestão ignorada continua permitido
- [ ] Os testes cobrem `gmial.com`, `hotmal.com` e `outlok.com` gerando sugestão, e `gmail.com` e um domínio próprio sem sugestão; o teste de página cobre a sugestão aplicada
- [ ] `npm run lint`, `npm test` e `npm run build` passam
