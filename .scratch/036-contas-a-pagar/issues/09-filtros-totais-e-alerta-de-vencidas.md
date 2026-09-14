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

**Status:** done

- [x] A lista paginada aceita filtros de estado, Categorias de Despesa e Fornecedores, além do
      período de vencimento (história 29).
- [x] Estados filtráveis: todas exceto canceladas (padrão); em aberto (inclui parcialmente pagas e
      vencidas); vencidas; pagas; canceladas.
- [x] Totais do filtro obedecem a período, categoria e fornecedor e ignoram o estado (história 30):
  - [x] em aberto: saldo restante das contas não canceladas com vencimento no período, destacando
        quanto está vencido;
  - [x] pago no período: soma do valor pago das Baixas ativas cuja data de pagamento cai no
        período, independentemente do vencimento da conta.
- [x] Contrato de alerta devolve quantidade e saldo das contas vencidas e das que vencem hoje, sem
      filtro de período, com "hoje" calculado no fuso do tenant no servidor (história 33).
- [x] Na aba: faixa de alerta no topo, cartões de totais e barra de filtros completa.
- [x] Selo de alerta na navegação de abas da 035, como conteúdo composto no rótulo da aba, e não
      como propriedade booleana nova no componente de abas; recarregado ao entrar no Hub e após
      qualquer escrita em Contas a Pagar (história 34).
- [x] Casos na suíte pgTAP `29_contas_a_pagar`:
  - [x] totais do filtro com pago no período pela data de pagamento;
  - [x] totais ignorando o filtro de estado;
  - [x] alerta sem filtro de período;
  - [x] profissional e gerente de outro tenant não leem totais nem alerta.
- [x] Testes de repositório e de adaptador do módulo cobrem filtros, totais e alerta.
- [x] Teste da aba cobre o alerta.
- [x] `npm run test` e `npm run test:db` verdes.

## Notas de implementação

- Migration `supabase/migrations/20260914110000_filtros_totais_e_alerta_de_vencidas.sql` aplicada
  em três partes no DEV via MCP `apply_migration` (`list_payables` com os dois novos filtros,
  `get_payables_totals`, `get_payables_alert`), verificada ao vivo por `to_regprocedure`.
- `list_payables` ganhou `p_category_id` e `p_supplier_id` **acrescentados ao final** da lista de
  parâmetros (depois de `p_tenant_id`), não inseridos no meio — mesmo arranjo do contrato de Baixa
  nascer completo no ticket 07/036: evita o ciclo de derrubar, recriar e reconceder privilégios
  que uma mudança de assinatura no meio exigiria.
- `get_payables_totals` não tem parâmetro de estado (por isso "ignora o filtro de estado" é
  estrutural, não uma checagem em tempo de execução); `get_payables_alert` não tem parâmetro de
  período pelo mesmo motivo.
- Selo de alerta: `HubLayout.tsx` instancia seu próprio `ContasPagarRepository` e usa
  `useContasPagarAlerta` para renderizar o selo composto dentro do rótulo da aba "Contas a pagar"
  (não uma propriedade nova no componente de navegação). Repassa `onContasPagarAlteradas`
  (a função de recarregar) pelo contexto da rota (`FinanceiroHubContextType`, que estende
  `TenantContextType`); `ContasPagarTab.tsx` chama essa função depois de qualquer lançamento,
  Baixa, estorno, edição ou cancelamento, para o selo atualizar sem precisar sair do Hub.
- Suíte pgTAP `29_contas_a_pagar.test.sql` estendida de 110 para 128 asserções. A seção nova foi
  validada isoladamente no DEV via MCP `execute_sql` (18/18), com contexto próprio
  (`ticket29i_context`) para não depender do estado mutado pelas seções anteriores; as seções
  06-08 já validadas anteriormente (110/110) não foram alteradas.
- Testes de front: `ContasPagarRepository.test.ts` (+9 casos: filtro de categoria/fornecedor,
  `obterTotais`, `obterAlerta`), `SupabaseContasPagarAdapter.test.ts` (+8 casos) e
  `ContasPagarTab.test.tsx` (+2 casos: faixa de alerta visível e ausente). Dois testes
  pré-existentes (`listarContas`) precisaram de ajuste para incluir os novos campos
  `categoryId`/`supplierId` na asserção exata.
- Verificação visual em navegador não foi feita nesta sessão, pela mesma limitação já registrada
  nos tickets anteriores desta spec.
