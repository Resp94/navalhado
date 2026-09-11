# 01 — Suíte de banco confiável

**What to build:** O responsável técnico executa toda a suíte pgTAP do projeto por um comando único contra o DEV, e um teste vermelho derruba esse comando em vez de passar em silêncio. Os testes comportamentais criam o próprio contexto dentro da transação de teste, de modo que a suíte continue válida em um banco recém-semeado.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Levantar quais suítes encerram sem propagação de falha e quais dependem de linhas preexistentes do DEV.
- [ ] Fazer todas as suítes encerrarem com falha propagada, mantendo o padrão de transação revertida.
- [ ] Substituir a dependência de linhas preexistentes do DEV por contexto criado dentro da própria transação de teste.
- [ ] Declarar um comando único de execução da suíte de banco junto dos demais scripts do projeto.
- [ ] Comprovar a propagação quebrando deliberadamente um teste e observando o comando falhar.
- [ ] Restaurar o teste quebrado e confirmar a suíte inteira verde.
- [ ] Manter verdes as suítes atuais da aplicação.
