# ADR 020: Livro de Contas a Pagar

## Status

Aceita em 2026-09-14.

## Contexto e Problema

A spec 036 introduz Contas a Pagar: despesas da barbearia com vencimento, que podem ser avulsas,
recorrentes ou parceladas, e que em algum momento são baixadas — total ou parcialmente, pela
gaveta (dinheiro físico do caixa) ou por fora dela (Pix, boleto, cartão da empresa). O ticket 06
constrói só a base dessa spec: a tabela `payables`, a criação de conta avulsa (`create_payable`) e
a leitura paginada (`list_payables`) com situação derivada. Baixa, Estorno de Baixa, edição,
cancelamento, Série (recorrência e parcelamento) chegam nos tickets 07 a 15, sobre a mesma tabela.

O caixa diário (`cash_movements`) já existe e já tem apuração única do valor esperado da gaveta
(ADR anterior desta mesma spec, ticket 01/036). A pergunta que este ADR resolve é onde a Conta a
Pagar mora em relação a esse caixa, e como as duas coisas se conectam quando uma Baixa sai da
gaveta.

## Decisões Tomadas

1. **Contas a Pagar é um livro próprio (`public.payables`), não uma extensão de
   `cash_movements`.** Uma Conta a Pagar existe e evolui (aberta, vencendo, parcialmente paga,
   quitada, cancelada) independente de qualquer movimento de caixa — a maior parte das contas de
   uma barbearia nunca passa pela gaveta. Sobrecarregar `cash_movements` com o ciclo de vida de
   uma conta a pagar (status, saldo restante, Série) misturaria dois relógios diferentes: o da
   gaveta física, que só se move em sessões abertas, e o da conta a pagar, que corre
   independentemente da gaveta estar aberta ou fechada.

2. **Baixa pela gaveta é um movimento de caixa vinculado à Baixa, não o inverso.** Quando o
   ticket 15/036 implementar a Baixa pela gaveta, o fluxo escreve primeiro a Baixa em `payables`
   (reduzindo o saldo restante) e só então registra o `cash_movement` correspondente, com uma
   referência de volta à Baixa — o mesmo padrão já usado por `register_commission_payout` e
   `register_professional_advance` (ADR do ticket 01/036: um evento de negócio primeiro, o
   reflexo na gaveta em seguida, na mesma transação). A apuração única do valor esperado da gaveta
   (`private.compute_cash_session_expected_amount`) continua sendo a única fonte de verdade sobre
   o que a gaveta deveria conter; a Baixa pela gaveta soma-se a ela como mais um tipo de saída,
   sem duplicar a lógica de apuração.

3. **Escrita exclusiva por RPC, leitura por RPC paginada.** `authenticated` não tem
   INSERT/UPDATE/DELETE direto em `payables` (revogado explicitamente na migration) — todo
   lançamento, toda Baixa, todo cancelamento passa por uma função `security definer`, no mesmo
   padrão já estabelecido por Categoria de Despesa e Fornecedor (spec 035) e por Caixa (spec 034).
   A leitura paginada (`list_payables`) também é uma RPC, não uma política de RLS com SELECT
   direto na tabela: a situação derivada (`overdue`) e a faixa de destaque (`due_today`,
   `due_soon`) dependem do dia de negócio do tenant, que só o servidor pode calcular
   corretamente — nenhuma tela decide "hoje" a partir do relógio do navegador.

4. **Resolução de tenant e revalidação de papel seguem o padrão já estabelecido pela spec 035.**
   Parâmetro de tenant opcional (`p_tenant_id`), recusado quando diverge do tenant do usuário
   autenticado a menos que o usuário seja `proprietario` (administrador do SaaS, acesso
   intencional a qualquer tenant — não é brecha), ausente vale o tenant do próprio usuário. A
   comparação usa `is distinct from`, nunca `<>`, pelo mesmo motivo que levou à correção de
   18 funções financeiras mais antigas nesta mesma spec: `<>` é NULL-inseguro e deixaria passar
   um tenant nulo.

5. **Série nasce como colunas sempre nulas nesta entrega, sem chave estrangeira até o ticket
   11/036 criar a tabela de Série.** Adicionar as colunas (`series_id`, `series_position`) desde
   já evita uma migration de ALTER TABLE depois que a tabela já tiver linhas reais de produção;
   a restrição de consistência (`series_id` e `series_position` ambas nulas ou ambas preenchidas)
   já vale desde o ticket 06, mesmo sem nenhuma linha preenchendo essas colunas ainda.

## Consequências

- Uma consulta que precise cruzar Contas a Pagar com o caixa (por exemplo, "quanto saiu da gaveta
  hoje por Baixas de Contas a Pagar") faz um JOIN entre `payables` e `cash_movements` pela
  referência de volta que a Baixa grava no movimento — não existe (nem deveria existir) uma
  coluna de saldo de caixa dentro de `payables`.
- O status e o saldo restante (`amount - paid_amount`) de uma Conta a Pagar continuam corretos
  mesmo em um tenant que nunca abriu uma sessão de caixa — Baixa fora da gaveta (Pix, boleto,
  cartão da empresa, ticket 07/036) não tem nenhuma dependência de `cash_movements`.
- A restrição `payables_status_paid_amount_check` (status e valor baixado sempre coerentes entre
  si) recusa qualquer gravação incoerente mesmo em escrita direta como superusuário — não é uma
  garantia que dependa da RPC de Baixa (que só chega no ticket 07/036) estar implementada
  corretamente; o banco já a impõe hoje.
- Categoria de Despesa e Fornecedor referenciados por uma Conta a Pagar usam o mesmo padrão de
  chave estrangeira composta `(tenant_id, id)` já usado pela spec 035, prevenindo por construção
  (não só por checagem na RPC) que uma conta aponte para uma categoria ou fornecedor de outro
  tenant.
