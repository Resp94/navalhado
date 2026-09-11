# 07 — Extrato da Sessão de Caixa

**What to build:** O gerente abre o extrato de um turno encerrado e entende o que aconteceu com aquela conferência: a divergência apurada no fechamento, os ajustes posteriores com autor e motivo, a divergência ajustada como número corrente, as movimentações do turno incluindo as quitações pagas em dinheiro, e as reaberturas anteriores da mesma sessão. O gerente também registra um ajuste posterior pela aplicação, e não apenas pelo banco. Barbeiro não acessa nada disso.

**Blocked by:** 04 — Quitação de Comissão sai da gaveta; 05 — Reabertura de Sessão de Caixa.

**Status:** ready-for-agent

- [ ] Consultar pelo MCP as policies vigentes das tabelas de auditoria envolvidas no DEV.
- [ ] Criar a função remota de extrato devolvendo em uma única chamada a fotografia do fechamento corrente, os ajustes posteriores com autor e motivo, a divergência ajustada acumulada, as movimentações do turno e o histórico de reaberturas.
- [ ] Exigir papel financeiro autorizado e unidade correspondente, recusando barbeiro e usuário de outra unidade.
- [ ] Apresentar a divergência ajustada como número corrente mantendo a original visível ao lado, sem alterar a linha da sessão após o fechamento.
- [ ] Migrar a função de resumo financeiro diário para `search_path` vazio com schemas qualificados.
- [ ] Cobrir por pgTAP: extrato completo em uma chamada; divergência ajustada refletindo ajustes acumulados; quitações em dinheiro aparecendo entre as saídas; reaberturas listadas; recusa para papel não autorizado e para outra unidade.
- [ ] Acrescentar ao contrato do `CaixaRepository`, de forma aditiva, as operações de obter extrato e registrar ajuste posterior, e cobrir a validação de entrada.
- [ ] Aplicar no DEV pelo MCP e comparar advisors antes e depois.
- [ ] Manter verdes as suítes atuais de Caixa e Financeiro.
