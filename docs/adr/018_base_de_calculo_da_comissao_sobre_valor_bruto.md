# ADR 018: Base de Cálculo da Comissão sobre o Valor Bruto do Item

## Status

Aceita em 2026-09-12.

## Contexto e Problema

A liquidação de Comanda (`settle_comanda`) sempre calculou a comissão de cada item sobre o
seu **valor bruto** (`quantidade × preço unitário`), antes do rateio proporcional do
desconto da Comanda entre os itens. Essa regra nunca foi uma decisão registrada — era apenas
o comportamento implícito do código, descoberto durante a auditoria de qualidade do módulo
financeiro (spec 033). Sem um registro explícito, um desenvolvedor futuro poderia "corrigir"
o cálculo para usar o valor líquido pós-desconto acreditando estar consertando um bug, quando
na verdade estaria revertendo uma escolha de negócio.

Da mesma auditoria, mais três pontos da liquidação ficaram sem resposta formal: se a gorjeta
gera comissão, se existe modelagem de taxa de adquirente (cartão) na comissão, e quem absorve
o desconto concedido ao cliente.

## Decisões Tomadas

1. **Comissão sobre o valor bruto do item, não sobre o valor líquido pós-desconto.**
   O item de Comanda agora grava explicitamente essa escolha na coluna
   `comanda_itens.snapshot_commission_base` (valor único aceito hoje: `gross_amount`),
   preenchida no momento da liquidação. Isso torna a regra uma decisão auditável por item,
   não um detalhe de implementação da função de liquidação.

2. **O desconto concedido ao cliente é absorvido pela casa, não pelo profissional.**
   Quando o gerente aplica desconto na Comanda, o rateio proporcional do desconto entre os
   itens (para fins de `snapshot_net_amount`, usado no faturamento e nos relatórios) não
   afeta a comissão calculada — que continua sobre o bruto. O profissional recebe o mesmo
   valor de comissão independentemente de quanto desconto foi concedido naquela venda.

3. **Gorjeta não gera comissão.** O valor de gorjeta (`tip_amount`) é somado ao total da
   Comanda mas não participa do cálculo de nenhum item; não existe rateio de gorjeta por
   item nem incremento de `snapshot_commission_amount` a partir dela.

4. **Não há modelagem de taxa de adquirente (cartão) na comissão.** O valor bruto usado no
   cálculo é o preço informado no fechamento da Comanda, sem desconto de taxa de cartão de
   crédito/débito repassada pela operadora. A comissão do profissional independe da forma de
   pagamento escolhida pelo cliente.

Essas quatro regras já eram o comportamento vigente; esta ADR apenas as torna explícitas e
acrescenta o registro auditável por item.

## Consequências

- A coluna `snapshot_commission_base` permite, no futuro, introduzir uma segunda base de
  cálculo (por exemplo, valor líquido pós-desconto, ou valor líquido de taxa de adquirente)
  sem precisar reprocessar comandas antigas: cada item já registra qual regra foi aplicada
  a ele no momento em que foi liquidado.
- Qualquer mudança na forma como a comissão é calculada — absorver o desconto no profissional,
  cobrar comissão sobre gorjeta, descontar taxa de adquirente antes de comissionar — é uma
  decisão de produto com efeito financeiro direto sobre os profissionais, e deve ser tratada
  como tal: numa spec própria de meios de pagamento, não como um ajuste incidental na função
  de liquidação.
- Comandas de cortesia (desconto integral, total zero) liquidam sem gerar comissão adicional
  além da já calculada sobre o bruto do item — o desconto de 100% não anula a comissão, pois
  ela nunca dependeu do desconto para começar.
