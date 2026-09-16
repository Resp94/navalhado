# ADR 019: Conta do Profissional e Repasse de Gorjeta

## Status

Aceita em 2026-09-12.

## Contexto e Problema

A ADR 018 registrou que a gorjeta (`comanda_itens`/`comandas.tip_amount`) não gera comissão e
que qualquer mudança na forma como ela chega ao profissional deveria ser tratada como decisão de
produto própria, numa spec de meios de pagamento, e não como ajuste incidental na função de
liquidação (`settle_comanda`).

A spec 034 precisava resolver exatamente essa lacuna: hoje a gorjeta é somada ao total da Comanda,
entra na gaveta junto com o resto do recebido, e a partir daí não existe registro de que aquele
dinheiro pertence a um profissional específico. Não repassar a gorjeta corretamente não é uma
falha de comissionamento — é dinheiro de terceiro parado no fluxo da casa sem trilha.

## Decisões Tomadas

1. **Repassar gorjeta é decisão distinta de comissionar gorjeta.** A ADR 018 continua vigente
   sem alteração: gorjeta não gera comissão, `commission_obligations` e
   `comanda_itens.snapshot_commission_amount` não são tocados por esta mudança. O que esta ADR
   introduz é um repasse de 100% do valor da gorjeta ao profissional, por um mecanismo
   inteiramente separado do de comissão.

2. **Nasce uma Conta do Profissional própria (`professional_account_entries`), não uma extensão
   de `commission_obligations`.** A tabela de obrigações de comissão exige vínculo obrigatório
   com um item de Comanda e valor estritamente positivo — guardas endurecidas de propósito
   durante a auditoria da spec 033. Gorjeta é crédito, e o vale de profissional que chegará em
   seguida é débito sem item de Comanda associado; nenhum dos dois cabe nas guardas de
   `commission_obligations` sem afrouxá-las. A Conta do Profissional discrimina a natureza do
   lançamento (`entry_type`: `gorjeta` | `vale`) e a aritmética (`direction`: `credit` | `debit`)
   em colunas separadas, para que somar o saldo nunca dependa de conhecer todo `entry_type`
   existente.

3. **A atribuição da gorjeta a um profissional é persistida na própria Comanda
   (`tip_professional_id`) por escrita direta enquanto ela ainda está aberta — não por um
   parâmetro novo em `settle_comanda`/`settle_comanda_idempotent`.** Essas duas funções são
   chamadas por nome via RPC (PostgREST) e têm cobertura de teste extensa; acrescentar parâmetro
   criaria uma assinatura nova sujeita a ambiguidade de overload, exigindo o mesmo ciclo de
   `drop` + recriação + regrant já pago uma vez para `register_commission_payout`. Como
   `settle_comanda` não sobrescreve colunas fora do seu próprio `set` ao fechar a Comanda, o
   valor gravado antes do fechamento sobrevive intacto até o gatilho ler `NEW.tip_professional_id`
   — sem tocar a função de liquidação.

4. **O crédito nasce de um gatilho próprio, separado do gatilho de obrigações de comissão.**
   `create_professional_account_tip_entry_from_closed_comanda` dispara na mesma transição de
   estado (`comandas.status` para `fechada`) que `create_commission_obligations_from_closed_comanda`,
   mas é um gatilho distinto: a função de liquidação de comissão permanece inalterada, cumprindo
   a exigência da ADR 018 na letra e no espírito.

5. **O profissional lê a própria Conta do Profissional.** Um vale que o profissional assina ou
   uma gorjeta que lhe foi atribuída e que ele não pode consultar é problema de confiança, não de
   permissão. A política de leitura reusa o helper `private.is_own_professional`, já estabelecido
   para o mesmo propósito em `commission_obligations`.

## Consequências

- Gorjetas de Comandas fechadas antes desta mudança não recebem crédito retroativo
  (`tip_professional_id` começa nulo para todo o histórico) — são apresentadas como gorjeta sem
  atribuição, um fato do histórico, não uma dívida nova inventada com a equipe.
- Reabrir uma Comanda com gorjeta já quitada na Conta do Profissional é bloqueado, no mesmo
  padrão já aplicado a comissão quitada; reabrir com gorjeta ainda em aberto estorna o crédito,
  permitindo o relançamento correto no fechamento seguinte sem duplicidade (índice único parcial
  por Comanda, ignorando lançamentos estornados).
- Toda escrita na Conta do Profissional passa exclusivamente por função `security definer`
  (o gatilho aqui; RPCs de vale e de quitação em specs seguintes) — não há INSERT/UPDATE/DELETE
  direto concedido ao papel autenticado, no mesmo padrão já usado por `commission_obligations` e
  `commission_payout_allocations`.
- Regime de dedução de taxa de adquirente sobre comissão continua fora de escopo, como a ADR 018
  já prevía, e não é afetado por esta decisão.
