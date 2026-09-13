# 09: Filtros, totais e alerta de vencidas

**What to build:** o gestor filtra as Contas a Pagar por período de vencimento, estado, Categoria
de Despesa e Fornecedor, e vê os totais do filtro — o saldo em aberto, quanto dele está vencido e
quanto foi pago no período — sem somar à mão. A aba ganha um alerta de contas vencidas e das que
vencem hoje, visível como selo na navegação do Hub, para que ele perceba sem precisar abrir a aba.

Os totais ignoram o filtro de estado, que de outro modo zeraria o pago ao filtrar vencidas. O
alerta ignora o filtro de período, porque uma conta vencida no mês passado não pode sumir só porque
o filtro está no mês corrente.

Spec: `specs/036-contas-a-pagar/spec.md`, seções "Entrega 2 — Livro de Contas a Pagar" (leitura) e
"Interface".

**Blocked by:** 07 — Baixa fora do caixa e Estorno de Baixa.

**Status:** ready-for-agent

- [ ] A lista paginada aceita filtros de estado, Categorias de Despesa e Fornecedores, além do
      período de vencimento (história 29).
- [ ] Estados filtráveis: todas exceto canceladas (padrão); em aberto (inclui parcialmente pagas e
      vencidas); vencidas; pagas; canceladas.
- [ ] Totais do filtro obedecem a período, categoria e fornecedor e ignoram o estado (história 30):
  - [ ] em aberto: saldo restante das contas não canceladas com vencimento no período, destacando
        quanto está vencido;
  - [ ] pago no período: soma do valor pago das Baixas ativas cuja data de pagamento cai no
        período, independentemente do vencimento da conta.
- [ ] Contrato de alerta devolve quantidade e saldo das contas vencidas e das que vencem hoje, sem
      filtro de período, com "hoje" calculado no fuso do tenant no servidor (história 33).
- [ ] Na aba: faixa de alerta no topo, cartões de totais e barra de filtros completa.
- [ ] Selo de alerta na navegação de abas da 035, como conteúdo composto no rótulo da aba, e não
      como propriedade booleana nova no componente de abas; recarregado ao entrar no Hub e após
      qualquer escrita em Contas a Pagar (história 34).
- [ ] Casos na suíte pgTAP `29_contas_a_pagar`:
  - [ ] totais do filtro com pago no período pela data de pagamento;
  - [ ] totais ignorando o filtro de estado;
  - [ ] alerta sem filtro de período;
  - [ ] profissional e gerente de outro tenant não leem totais nem alerta.
- [ ] Testes de repositório e de adaptador do módulo cobrem filtros, totais e alerta.
- [ ] Teste da aba cobre o alerta.
- [ ] `npm run test` e `npm run test:db` verdes.
