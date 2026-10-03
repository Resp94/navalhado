# 02: Faturamento do mês e Evolução da receita vêm das cobranças aprovadas

Parte da spec 054 (Painel do Proprietário).

**What to build:** o Proprietário vê em Admin > Dashboard o dinheiro que o Mercado Pago aprovou. "Faturamento do mês" soma as cobranças aprovadas (mensalidade e diferença de plano) com data no mês corrente, e "Evolução da receita" mostra a mesma soma mês a mês nos últimos 12 meses, com zero nos meses sem cobrança. O mês é o do calendário de Brasília (`America/Sao_Paulo`). Recusada, em análise, pendente, estornada e contestada ficam fora. A RPC das métricas deixa de ler `public.invoices` e passa a usar a mesma guarda das Ferramentas do Proprietário (recusa com `ADMIN_ONLY`/42501).

Hoje o painel do DEV mostra R$ 0,00 com R$ 319,80 aprovados em outubro de 2026.

**Blocked by:** None (can start immediately)

**Status:** done (um critério depende do push)

- [x] Migration aplicada só no DEV (`selvxobcjbkligxighlp`) pelo MCP; nada na PROD
- [x] pgTAP novo (próximo número livre, hoje 80) em `begin; ... rollback;`: a guarda recusa Gerente, Barbeiro, anônimo e Gerente com `tenant_id` nulo; o Proprietário lê
- [x] pgTAP: só `approved` entra; `rejected`, `in_process` e `refunded` ficam fora; mensalidade e diferença de plano entram
- [x] pgTAP: uma cobrança na virada do mês em Brasília cai no mês certo; uma de 13 meses atrás fica fora do gráfico; o gráfico tem 12 meses, do mais antigo ao atual, com zero nos vazios
- [x] pgTAP: compara por diferença (antes e depois de inserir), sem depender das barbearias de teste que já existem no DEV
- [x] O contrato que a tela usa não muda neste ticket (`revenue_this_month`, `revenue_trend`); Vitest do Dashboard segue verde
- [ ] No site de DEV, depois do push que o usuário pedir, o painel mostra o faturamento de outubro igual à soma no banco
- [x] Gates de lint, Vitest e build passam

## Resultado

Commit b0967e1. Migration `20261003204038_054_ticket02_faturamento_pelas_cobrancas_aprovadas.sql`, aplicada só no DEV (`selvxobcjbkligxighlp`). A RPC segue devolvendo `json`; ACL conferida (`authenticated` e `service_role`, sem `anon`). pgTAP `80_painel_do_proprietario.test.sql` (primeiro escrito vermelho: 7 falhas na função antiga).

A parte do "site de DEV" ficou provada no localhost contra o banco do DEV, logado como Proprietário: o painel mostra Faturamento do mês R$ 389,80, igual à soma de `billing_charges` aprovadas do mês de Brasília no banco (R$ 389,80). No site `dev.navalhado.com.br` isso só aparece depois do push.

Revisão (`/code-review`) aplicada em 2026-10-03:
- Migration `20261003232615_054_ticket02_revisao_faturamento_numa_serie_so.sql` (só no DEV): o cartão do mês é o último mês da mesma série de 12 meses do gráfico, então os dois não têm como divergir; o fuso fica numa constante. Resultado idêntico ao anterior (pgTAP 80 verde antes e depois).
- pgTAP 80 (32 asserções): o zero do mês vazio passou a ser provado comparando cada um dos 12 meses do gráfico com a soma independente das aprovadas daquele mês lida da tabela; entrou uma cobrança aprovada no primeiro instante do mês seguinte, que tem de ficar fora do faturamento; as recusas de Gerente, Barbeiro e Gerente com `tenant_id` nulo agora exigem a mensagem `ADMIN_ONLY` (o anônimo cai antes, por falta de `EXECUTE`); os preços vêm da tabela `plans`, e não de números fixos; helpers com nomes claros e a diferença dos contadores com rótulo (`liberadas=1 bloqueadas=0 mrr=89.90`).
