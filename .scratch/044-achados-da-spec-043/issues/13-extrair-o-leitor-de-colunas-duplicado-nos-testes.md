# 13: Extrair o leitor de colunas duplicado nos testes

**What to build:** vários testes de adaptador usam um banco de mentira que aplica de verdade os filtros e devolve só as colunas pedidas na consulta. Sem isso, um teste passaria mesmo se o adaptador esquecesse de pedir uma coluna, que foi exatamente o defeito original do ticket 02 da spec 043.

A peça que interpreta a lista de colunas da consulta está copiada em dois arquivos de teste. Enquanto eram dois, deixar como estava foi decisão consciente. Vale extrair antes do terceiro, porque uma cópia que diverge silenciosamente faz o teste parar de cobrir o que promete, sem ficar vermelho.

Depois deste ticket, a peça tem um dono só.

**Onde foi achado:** limite registrado no ticket 04 da spec 043.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A peça que interpreta as colunas da consulta passa a existir em um lugar só, junto do apoio de teste do projeto
- [ ] Os testes que a usam continuam verdes sem mudança de comportamento
- [ ] A cobertura não regride: tirar uma coluna do que o adaptador pede continua deixando o teste vermelho, conferido por mutação em pelo menos um dos adaptadores
- [ ] Nenhum código de produção é alterado por este ticket
- [ ] `npm run lint`, `npm test` e `npm run build` passam
