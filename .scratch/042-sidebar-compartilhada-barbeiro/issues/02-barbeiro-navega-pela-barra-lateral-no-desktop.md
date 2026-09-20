# 02: Barbeiro navega pela barra lateral no desktop

**What to build:** depois de logar num computador, o barbeiro vê a mesma barra lateral do gestor, com Minha Agenda e Minhas Comissões e nada além disso. O cabeçalho superior do desktop sai: logo, nome da barbearia, sininho, identidade e Sair passam a viver na barra lateral. O conteúdo ganha a altura que o cabeçalho ocupava. No celular nada muda.

**Blocked by:** 01 (Barra lateral recebe a navegação por propriedade)

**Status:** ready-for-agent

- [ ] O layout do barbeiro define a navegação dele com Minha Agenda e Minhas Comissões, com os ícones que a navegação horizontal já usava, e nenhum item ativo em subrotas
- [ ] O cabeçalho superior do desktop sai inteiro do layout do barbeiro, junto com a navegação horizontal, o sininho, o bloco de identidade e o botão Sair
- [ ] O barbeiro vê nome e logo da barbearia na barra lateral e volta para a Minha Agenda clicando neles
- [ ] Notificações e Sair funcionam pela barra lateral, com o mesmo comportamento que tinham no cabeçalho
- [ ] A área de conteúdo fica irmã da barra lateral, no mesmo arranjo do layout do gestor, sem a largura máxima centralizada que existia por causa do cabeçalho
- [ ] Nenhum import, variável ou função fica órfão no layout do barbeiro depois da remoção
- [ ] No celular o barbeiro continua com header e navegação inferior, sem a gaveta "Mais"
- [ ] Teste de tela do layout do barbeiro: a navegação do desktop é a barra lateral e traz só os dois itens dele
- [ ] Verificado no navegador: login como barbeiro, recolher e expandir, os dois itens navegam, Sair funciona
- [ ] `npm run lint`, `npm test` e `npm run build` passam
