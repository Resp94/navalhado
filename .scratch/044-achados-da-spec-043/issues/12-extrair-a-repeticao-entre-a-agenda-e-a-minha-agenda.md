# 12: Extrair a repetição entre a Agenda do gerente e a Minha Agenda

**What to build:** a spec 043 entregou o Painel de Cancelados do Dia nas duas agendas, e no caminho duplicou código. O botão do cabeçalho que abre o painel repete, colada, a lista de classes de estilo do botão vizinho. O trio de estados que controla o painel (o que carregou, se falhou, se está aberto) existe igual nas duas páginas.

Duplicação assim envelhece mal: a próxima mudança no painel precisa ser feita em dois lugares, e a segunda é a que se esquece.

Depois deste ticket, o painel tem um ponto só de controle, e o botão do cabeçalho não copia estilo de ninguém.

**Onde foi achado:** limite registrado no ticket 05 da spec 043.

**Blocked by:** 09 (Selos do cartão da Agenda usam o componente da biblioteca) — o 09 mexe na mesma marcação de cabeçalho e cartão, e extrair antes obrigaria a refazer a extração depois

**Status:** ready-for-agent

- [ ] O botão que abre o Painel de Cancelados do Dia deixa de copiar a lista de classes do botão vizinho
- [ ] O trio de estados do painel passa a ter uma definição só, usada pelas duas páginas
- [ ] Nenhum comportamento visível muda: os testes de tela das duas páginas continuam verdes sem serem reescritos para acomodar a extração
- [ ] A extração não cria abstração para um caso só: o que for particular de uma das páginas continua nela
- [ ] O componente extraído, se houver, fica no lugar que o projeto usa para componentes de agenda, não na biblioteca de interface
- [ ] `npm run lint`, `npm test` e `npm run build` passam
