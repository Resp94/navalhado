# 04: Extrair a repetição entre a Agenda Geral e a Minha Agenda

**What to build:** a spec 043 entregou o Painel de Cancelados do Dia nas duas agendas, e no caminho duplicou código. O botão do cabeçalho que abre o painel repete, colada, a lista de classes de estilo do botão vizinho. O trio de estados que controla o painel (o que carregou, se falhou, se está aberto) existe igual nas duas páginas.

Duplicação assim envelhece mal: a próxima mudança no painel precisa ser feita em dois lugares, e a segunda é a que se esquece.

Depois deste ticket, o painel tem um ponto só de controle, e o botão do cabeçalho não copia estilo de ninguém. É prefactor: os tickets 13 e 15 mexem no mesmo estado, e ficam mais simples com ele num lugar só.

**Onde foi achado:** limite registrado no ticket 05 da spec 043.

**Blocked by:** None (can start immediately). É prefactor dos tickets 13 e 15

**Status:** ready-for-agent

- [ ] O botão que abre o Painel de Cancelados do Dia deixa de copiar a lista de classes do botão vizinho
- [ ] O trio de estados do painel passa a ter uma definição só, usada pelas duas páginas
- [ ] Nenhum comportamento visível muda: os testes de tela das duas páginas continuam verdes sem serem reescritos para acomodar a extração
- [ ] A extração não cria abstração para um caso só: o que for particular de uma das páginas continua nela
- [ ] O componente extraído, se houver, fica no lugar que o projeto usa para componentes de agenda, não na biblioteca de interface
- [ ] `npm run lint`, `npm test` e `npm run build` passam
