# 02: Faturamento do mês e Evolução da receita vêm das cobranças aprovadas

Parte da spec 054 (Painel do Proprietário).

**What to build:** o Proprietário vê em Admin > Dashboard o dinheiro que o Mercado Pago aprovou. "Faturamento do mês" soma as cobranças aprovadas (mensalidade e diferença de plano) com data no mês corrente, e "Evolução da receita" mostra a mesma soma mês a mês nos últimos 12 meses, com zero nos meses sem cobrança. O mês é o do calendário de Brasília (`America/Sao_Paulo`). Recusada, em análise, pendente, estornada e contestada ficam fora. A RPC das métricas deixa de ler `public.invoices` e passa a usar a mesma guarda das Ferramentas do Proprietário (recusa com `ADMIN_ONLY`/42501).

Hoje o painel do DEV mostra R$ 0,00 com R$ 319,80 aprovados em outubro de 2026.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Migration aplicada só no DEV (`selvxobcjbkligxighlp`) pelo MCP; nada na PROD
- [ ] pgTAP novo (próximo número livre, hoje 80) em `begin; ... rollback;`: a guarda recusa Gerente, Barbeiro, anônimo e Gerente com `tenant_id` nulo; o Proprietário lê
- [ ] pgTAP: só `approved` entra; `rejected`, `in_process` e `refunded` ficam fora; mensalidade e diferença de plano entram
- [ ] pgTAP: uma cobrança na virada do mês em Brasília cai no mês certo; uma de 13 meses atrás fica fora do gráfico; o gráfico tem 12 meses, do mais antigo ao atual, com zero nos vazios
- [ ] pgTAP: compara por diferença (antes e depois de inserir), sem depender das barbearias de teste que já existem no DEV
- [ ] O contrato que a tela usa não muda neste ticket (`revenue_this_month`, `revenue_trend`); Vitest do Dashboard segue verde
- [ ] No site de DEV, depois do push que o usuário pedir, o painel mostra o faturamento de outubro igual à soma no banco
- [ ] Gates de lint, Vitest e build passam
