# Auditoria de qualidade do financeiro — DEV — 2026-09-11

**Ambiente:** Supabase DEV (`Navalhado-dev`) — `selvxobcjbkligxighlp`
**Postgres:** 17.6.1.147
**Escopo auditado:** commits de 10 e 11/09/2026 (specs 030, 031, 032 + rodada de code review), 44 migrations novas
**Método:** inspeção do estado vivo do DEV pelo MCP do Supabase (catálogo, policies, grants, constraints, índices, advisors), execução das suítes pgTAP e da suíte de frontend.

---

## Veredito

**A qualidade do que foi feito é alta.** A modelagem está correta, o endurecimento de segurança é consistente e os invariantes financeiros estão escritos no banco, não apenas no código da tela. O que impede chamar o módulo de "pronto" não são defeitos do que foi construído, e sim **três operações inversas que faltam** e **um vínculo ausente entre comissão e gaveta do caixa** — detalhados em A1 a A4.

### Evidências a favor

| Dimensão | Observado no DEV |
|---|---|
| Superfície de escrita | Toda escrita financeira passa por RPC `SECURITY DEFINER`. `commission_obligations`, `commission_payout_allocations`, `cash_session_adjustments`, `comanda_payment_reversals` e `comanda_pagamentos` só têm policy de `SELECT`; `authenticated` não tem `INSERT/UPDATE/DELETE`. |
| `search_path` | Todas as funções financeiras usam `search_path = ''` com schema qualificado. Zero alertas `function_search_path_mutable` no advisor de segurança. |
| RLS | Todas as tabelas públicas com RLS. Policies usam `(select private.get_auth_role())` — zero alertas `auth_rls_initplan` e zero `multiple_permissive_policies` no advisor de performance. |
| Invariantes | `commission_obligations_status_balance_check` amarra status e saldo; `settled_amount <= amount`; faixas dos snapshots; `reason` do ajuste com mínimo de 5 caracteres; `adjustment_amount <> 0`. |
| Concorrência | Locks em ordem estável (comanda → agendamento → produtos por id); `for update` no profissional serializa quitações concorrentes; `unique (comanda_item_id)` impede obrigação duplicada; `comanda_settlement_requests` dá idempotência ao checkout. |
| Índices | Compostos com propósito: `(tenant_id, professional_id, status)`, `(tenant_id, paid_at desc)`, `(comanda_id, snapshot_status)`. |
| Migrations | 44 arquivos, DDL puro e idempotente (`drop constraint if exists` + `add`, `if not exists`), sem reescrita de histórico, correções por migration compensatória. Nenhum DML de topo de arquivo. |
| Testes | Frontend: **65 arquivos / 397 testes verdes**. pgTAP: suítes 16 e 18 executadas no DEV com `finish(true)` — **verdes** (10/10 e 11/11). |

### Advisors de segurança no DEV

Nenhum alerta novo introduzido por esta rodada. O que resta é pré-existente e documentado: 15 RPCs públicas por design do canal do cliente, 3 tabelas sem policy por decisão (`comanda_settlement_requests`, `public_customer_sessions`, `whatsapp_message_outbox`), login anônimo e proteção de senha vazada do Auth.

---

## Achados

Ordenados por impacto. A severidade considera o uso real pretendido, não o volume atual do DEV.

### A1 — Não existe estorno de quitação de comissão (bloqueante)

`reopen_comanda` recusa a reabertura com *"A comanda possui comissao ja quitada; estorne a quitacao antes de reabrir"*, mas **não existe nenhuma função de estorno**. O inventário de funções do DEV não tem `reverse_commission_payout` nem equivalente, e `commission_payouts` não aceita escrita direta.

Consequência: paga a comissão, a comanda fica permanentemente fechada e um pagamento errado não tem como ser desfeito. A mensagem de erro instrui uma ação que o sistema não oferece.

Referência AppBarber: `removePagamentoComissaov3.php`.

### A2 — Não existe reabertura de sessão de caixa (bloqueante)

Mesmo padrão: `reopen_comanda` recusa com *"A comanda pertence a uma sessao de caixa fechada; estorne o caixa antes de reabrir"*, e não há `reopen_cash_session`. `cash_sessions` tem policy de `UPDATE` restrita a `status = 'open'` tanto no `USING` quanto no `WITH CHECK`, então nem por escrita direta é possível.

Consequência: fechado o caixa do dia, nenhuma comanda daquele dia pode mais ser corrigida.

Referência AppBarber: `alteraCaixaReabrir.php`.

### A3 — Quitação de comissão não movimenta a gaveta do caixa (alto)

`register_commission_payout` aceita `payment_method = 'cash'` mas não cria linha em `cash_movements` nem recebe `cash_session_id`. Já `close_cash_session` calcula:

```
esperado = valor_inicial + dinheiro_das_comandas + suprimentos - sangrias
```

Pagar um barbeiro em dinheiro tirando da gaveta produz uma quebra de caixa artificial no fechamento, toda vez.

O AppBarber trata isso explicitamente com `insereCaixa=1`, que gera a saída correspondente no caixa. Decisão necessária: ou a quitação em dinheiro exige sessão aberta e gera sangria automática, ou passa a ser proibida no caixa e só existe como saída no financeiro.

### A4 — Ajustes de caixa e estornos de pagamento são gravados e nunca lidos (alto)

`register_cash_session_adjustment` grava uma linha de auditoria completa, mas **não atualiza `cash_sessions.difference_amount`** — decisão defensável de imutabilidade. O problema é o outro lado: varrendo todas as funções de `public` e `private` e todas as chamadas `rpc(...)` do frontend, **nenhum consumidor lê `cash_session_adjustments`**. O mesmo vale para `comanda_payment_reversals`, escrito por `reopen_comanda` e lido por ninguém.

Consequência: o ajuste é auditável em tese e invisível na prática — todo relatório continua exibindo a divergência original. Também não há RPC de ajuste conectada ao frontend (`register_cash_session_adjustment` não aparece em nenhuma chamada).

### A5 — Regra de comissão embutida sem configuração (decisão de produto)

Em `settle_comanda` o snapshot grava:

- `snapshot_commission_amount` calculado sobre o **valor bruto**, não sobre `snapshot_net_amount`. O desconto concedido ao cliente é absorvido integralmente pela casa.
- **Gorjeta não gera comissão** nem crédito ao profissional; entra só como `tip_amount` da comanda.
- **Taxa de cartão não existe** no modelo, logo os regimes *bruto / líquido / descontado* do AppBarber não são representáveis.

Nada disso está errado — está implícito. Precisa virar decisão explícita antes de construir a tela de comissões, porque muda o snapshot e snapshot antigo não se recalcula.

### A6 — Histórico de migrations divergente entre arquivos e DEV (médio, risco de deploy)

Cada uma das 44 migrations novas tem, no arquivo, um timestamp diferente do registrado em `supabase_migrations.schema_migrations` do DEV — efeito de aplicar via `apply_migration` do MCP, que carimba a própria versão. Exemplo: arquivo `20260910173320_restaurar_movimentacoes_estoque` × DEV `20260910173348`. Além disso, o DEV tem 3 versões órfãs sem arquivo local: `probe_invalid_should_not_apply`, `probe_temp`, `probe_forward_output`.

Consequência: `supabase db push` enxerga as 44 como pendentes. Como o DDL é idempotente o reprocessamento provavelmente não quebra nada, mas o histórico deixou de ser fonte de verdade — exatamente a garantia que a spec 030 pediu ("migration nova e ordenada, para manter o histórico do banco rastreável").

Correção: `supabase migration repair --status applied <versão>` para alinhar as 44 e remover as 3 sondas.

### A7 — 8 das 18 suítes pgTAP não falham quando falham (médio)

`02` a `07`, `17`, `18` e `financeiro_estoque_baseline` terminam com `select * from finish();` sem o argumento de exceção; `08` a `16` usam `finish(true)`. Sem o `true`, um teste vermelho não levanta erro — e como não existe runner (`supabase/config.toml` ausente, nenhum script npm, nenhum passo de CI), a execução é manual e o resultado passa despercebido.

Rodei `16` e `18` forçando `finish(true)` no DEV: ambas verdes. Mas isso foi verificação manual, não garantia.

Nota adicional: os testes comportamentais dependem de dados reais do DEV (`join public.users ... limit 1`). Num banco recém-semeado eles não encontram contexto e — sem `finish(true)` — passam em silêncio.

### A8 — Estorno de estoque na reabertura entra como entrada manual (baixo)

`reopen_comanda` devolve o estoque inserindo `movement_type = 'entry_manual'` com `reason = 'Estorno da reabertura da comanda'`. A linha original recebe `reversed_at`, mas a linha compensatória é indistinguível de uma entrada manual legítima em qualquer relatório de estoque. Falta um tipo `reversal` no `product_movements_movement_type_check`.

### A9 — Reabrir e refaturar quebra o rastro obrigação → item (baixo)

`settle_comanda` faz `delete from comanda_itens` e recria tudo. A FK `commission_obligations.comanda_item_id` é `ON DELETE SET NULL`, então as obrigações revertidas da liquidação anterior perdem o vínculo com o item (o vínculo com `comanda_id` sobrevive). Não corrompe saldo — os cálculos legados usam `not exists (... comanda_item_id = ci.id)` e continuam corretos —, mas degrada a auditoria.

### A10 — Inconsistências menores

- `get_daily_financial_summary` é a única função financeira ainda com `search_path = public, extensions` em vez de `''`. Fixo, portanto não é vulnerabilidade, mas destoa do padrão adotado.
- `comanda_payment_reversals` não tem índice algum em `comanda_id` nem `tenant_id` (só PK e a unique de `original_payment_id`).
- `settle_comanda` rejeita `v_total <= 0`, o que impede cortesia de 100% e vai atrapalhar consumo de pacote/assinatura com valor zero.
- `settle_comanda` calcula `change_amount` sem validar que `received_cash >= amount`.

---

## Lacunas de modelo para o financeiro planejado

Comparando o estado do DEV com `docs/scraping_appbarber_financeiro.md`. O que já existe cobre **caixa, comanda, comissão por item, quitação com alocação, ajustes auditáveis e snapshots históricos** — que é a base mais difícil e está bem-feita. O que ainda não tem lugar no schema:

| # | Faltando no DEV | Sustenta qual tela do AppBarber |
|---|---|---|
| 1 | **Livro caixa geral / títulos**: não existe tabela de lançamento financeiro com vencimento × baixa, entrada/saída, recorrência e parcelamento, nota fiscal e anexo. Hoje só há `cash_movements`, preso a uma sessão de caixa. | `#/entradasaida` (Contas a Pagar / a Receber) |
| 2 | **Plano de contas**: categorias de despesa e receita, fornecedores. | Cadastros auxiliares, DRE |
| 3 | **Subcontas / bancos e transferência entre contas**. | `#/subcontas`, card "Total Disponível" |
| 4 | **Cartão**: bandeira, parcelas, taxa do adquirente e data de compensação. `comanda_pagamentos` guarda só método e valor. | Card "Total a Receber", regimes de comissão líquida/descontada |
| 5 | **Conta do cliente (fiado)** e **conta do profissional** (vale/adiantamento). Não há tabela, e `payment_method` não tem valor equivalente. | `#/contacliente`, `#/contaProfissional` |
| 6 | **Retirada de sócio** (flag que sai da DRE). | DRE |
| 7 | **Gorjeta como crédito do profissional**. | `inserePessoaCaixinha.php` |
| 8 | **Pacotes e assinaturas**, com comissão na venda ou na execução. | Comissão sobre pacotes |
| 9 | **Operações inversas**: estorno de quitação e reabertura de caixa. | A1, A2 acima |

O item 4 é o mais caro de adiar: mudar `comanda_pagamentos` depois de ter volume significa migrar pagamentos já liquidados e refazer snapshots.

---

## Sequência recomendada

1. **Fechar as inversas e o vínculo com o caixa** — A1, A2, A3. São pequenas, usam tudo que já existe e destravam fluxos que hoje entram em beco sem saída. Antes de qualquer funcionalidade nova.
2. **Consertar histórico de migrations (A6) e runner de testes (A7).** Barato e protege todo o resto.
3. **Ligar o que já foi construído** — A4: expor ajuste de caixa e estorno de pagamento no frontend e nos relatórios, ou assumir que ficam dormentes e registrar a decisão.
4. **Spec nova: livro caixa e plano de contas** (lacunas 1, 2, 3). É o que habilita DRE e Fluxo de Caixa.
5. **Spec nova: meios de pagamento e recebíveis** (lacuna 4), junto com a decisão de A5 sobre desconto, gorjeta e taxa na comissão.
6. **Conta do cliente e do profissional** (lacuna 5), aproveitando o livro de obrigações como base para vales.

---

## Como reproduzir

Todas as verificações foram feitas no DEV pelo MCP do Supabase, sem escrita:

- Inventário: `pg_class`, `pg_policy`, `pg_constraint`, `pg_indexes`, `pg_proc` no schema `public`.
- Advisors de segurança e performance do projeto `selvxobcjbkligxighlp`.
- pgTAP: arquivos de `supabase/tests/database/` executados dentro de `begin; ... rollback;` com `finish(true)`.
- Frontend: `npx vitest run`.
