# 05 — Reabertura de Sessão de Caixa

**What to build:** O gerente reabre um turno encerrado por engano, informando o motivo, e volta a lançar sangria e suprimento naquele turno para refazer a conferência. A fotografia do fechamento anterior é preservada como auditoria, e tentar reabrir enquanto já existe outro turno aberto na barbearia devolve uma recusa compreensível, não um erro técnico.

**Blocked by:** 01 — Suíte de banco confiável; 02 — Histórico de migrations reconciliado; 04 — Quitação de Comissão sai da gaveta.

**Status:** ready-for-agent

- [ ] Consultar pelo MCP as colunas, policies e índices vigentes da tabela de sessões de caixa no DEV.
- [ ] Criar migration nova com a tabela de reaberturas de caixa, somente leitura para papéis financeiros e sem escrita direta para `authenticated`, com índice em cada chave estrangeira.
- [ ] Criar a função remota de reabertura exigindo usuário ativo com papel financeiro, unidade correspondente e motivo com o mesmo mínimo de caracteres já exigido no ajuste posterior.
- [ ] Verificar a existência de outro turno aberto na unidade antes da transição e devolver erro de domínio próprio, sem expor violação do índice único parcial.
- [ ] Copiar para a tabela de reaberturas a fotografia completa do fechamento — valor declarado, esperado, divergência, composição por método, contagem de pagamentos, suprimentos, sangrias, quitações em dinheiro e versão de cálculo — antes de devolver a sessão para aberta.
- [ ] Limpar os campos de fechamento da sessão reaberta, para que um novo fechamento produza apuração íntegra em vez de somar sobre a anterior.
- [ ] Preservar os ajustes posteriores já registrados, associados ao fechamento a que pertenciam.
- [ ] Cobrir por pgTAP: reabertura preserva a fotografia e devolve a sessão para aberta; recusa de domínio com turno já aberto; turno reaberto aceita sangria e suprimento; novo fechamento apura a partir do estado corrigido; papel não autorizado recusado.
- [ ] Acrescentar a operação ao contrato do `CaixaRepository` de forma aditiva e cobrir a validação de entrada.
- [ ] Aplicar no DEV pelo MCP e comparar advisors antes e depois.
