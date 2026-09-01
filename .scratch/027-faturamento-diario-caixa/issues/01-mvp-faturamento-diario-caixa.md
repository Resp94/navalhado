# 01 — MVP de faturamento diário no Caixa

**What to build:** O gerente consegue consultar uma data e visualizar separadamente o faturamento realizado em comandas fechadas e o valor efetivamente recebido no caixa, sem alterar os indicadores financeiros existentes.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Criar o contrato do resumo financeiro diário no seam do `CaixaRepository`, com tenant, intervalo local e sessão opcional.
- [ ] Apurar faturamento a partir de comandas fechadas e recebimentos a partir de pagamentos, sem contar uma comanda mais de uma vez quando houver pagamento dividido.
- [ ] Respeitar o fuso horário configurado pelo tenant e o intervalo de data com fim exclusivo.
- [ ] Integrar a consulta persistente ao adapter Supabase mantendo isolamento por tenant e autorização financeira.
- [ ] Exibir no desktop o faturamento realizado, as entradas no caixa e um filtro de data.
- [ ] Preservar os KPIs por período, o cálculo da gaveta, sangrias, suprimentos, fechamento e comissões.
- [ ] Cobrir o comportamento com testes de domínio, repository, adapter e tela desktop.
- [ ] Verificar a persistência e os valores retornados no banco de desenvolvimento sem alterar produção.
