# 01: Barra lateral recebe a navegação por propriedade

**What to build:** a barra lateral deixa de conhecer rotas e papéis. Ela passa a receber a lista de itens de navegação, o caminho da tela inicial, o nome e a logo da barbearia, o nome e o papel do usuário. O layout do gestor passa a ser o dono da lista das dez telas dele. Para o gestor, nada muda na tela: mesmos itens, mesmos ícones, mesmo recolher, mesmo rodapé.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A lista de rotas do gestor sai da barra lateral e passa a ser definida no layout do gestor
- [ ] Cada item declara caminho, rótulo, ícone e se fica ativo também nas subrotas; Equipe e Financeiro continuam ativos nas subrotas deles, agora por essa marcação e não por caminho citado dentro do componente
- [ ] Clicar na logo leva ao caminho da tela inicial recebido por propriedade; para o gestor continua sendo a Agenda Geral
- [ ] Nome e logo da barbearia chegam como valores soltos; a barra lateral não importa mais nenhum tipo do layout do gestor
- [ ] O rodapé mostra o nome do usuário recebido por propriedade e o rótulo de acessibilidade da navegação usa o papel recebido; o rodapé continua sem mostrar cargo
- [ ] A preferência de recolhida/expandida continua gravada e restaurada como hoje
- [ ] Teste de tela da barra lateral com a lista do gestor: as dez telas aparecem, clicar navega para a rota certa, recolher grava a preferência e Sair chama o callback recebido
- [ ] Teste de tela da barra lateral com uma lista de dois itens: só esses dois aparecem e nenhuma rota de gestor vaza
- [ ] Os testes atuais do layout do gestor continuam verdes
- [ ] `npm run lint`, `npm test` e `npm run build` passam
