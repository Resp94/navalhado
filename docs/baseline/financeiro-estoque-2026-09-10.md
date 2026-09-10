# Baseline do financeiro e estoque — 2026-09-10

**Ambiente:** Supabase DEV (`Navalhado-dev`)
**Project ref:** `selvxobcjbkligxighlp`
**Postgres:** 17.6
**Migrations aplicadas:** 75
**Última migration observada:** `20260902152205`

## Estado observado

Consulta realizada pelo MCP do Supabase em 10/09/2026 às 16:46 UTC.

| Área | Quantidade |
|---|---:|
| Produtos | 0 |
| Movimentos de produto | 0 |
| Sessões de caixa | 3 |
| Movimentos de caixa | 0 |
| Comandas | 31 |
| Pagamentos de comandas | 3 |
| Quitações de comissão | 0 |

Não foram encontradas inconsistências agregadas nos dados existentes. A ausência de produtos e movimentos significa que o caminho real de estoque ainda não foi exercitado por dados do DEV.

## Contratos registrados

- O schema de movimentos aceita `entry_manual`, `entry_purchase`, `exit_manual`, `exit_sale_comanda`, `exit_internal_use` e `adjustment`.
- A constraint de quantidade persistida exige valor maior que zero.
- O adapter atual envia os tipos detalhados e a quantidade absoluta.
- A função remota `adjust_product_stock` ainda valida `entry`, `exit`, `sale` e `adjustment`, e persiste o delta assinado como quantidade.
- As funções remotas de estoque e quitação possuem assinatura registrada no teste pgTAP de baseline.
- As policies atuais estão tenant-scoped em produtos e movimentos, mas os helpers de autenticação não filtram `is_active`.
- O papel `authenticated` possui privilégio direto de inserção em `commission_payouts`, além da função de quitação.

## Advisors registrados

Os advisors foram consultados pelo MCP antes da implementação:

- Segurança: 2 tabelas com RLS sem policy, 15 funções `SECURITY DEFINER` executáveis por anônimos, 29 executáveis por autenticados e proteção contra senhas vazadas desabilitada.
- Performance: 2 foreign keys sem índice de cobertura e 32 índices ainda não utilizados.

Esses avisos não foram alterados neste ticket. Os itens fora do escopo permanecem como baseline para os Tickets 03 e 04.

## Testes de aplicação

Executados com Vitest em uma worker:

- Produtos: 4 testes aprovados.
- Adapter de produtos: 7 testes aprovados.
- Comandas: 8 testes aprovados.
- Adapter de comandas: 2 testes aprovados.
- Caixa: 13 testes aprovados.
- Adapter de caixa: 1 teste aprovado.
- Financeiro: 4 testes aprovados.
- Quitação de comissão: 2 testes aprovados.

A execução agregada da suíte ficou sem progresso antes da coleta de testes no modo padrão e foi interrompida. Isso é registrado como limitação do runner; as mesmas suítes passaram isoladamente com uma worker.

## Critério de uso

Este documento e o teste pgTAP associado são uma fotografia de referência, não uma autorização para preservar o comportamento defeituoso. Os Tickets 02, 03 e 04 deverão atualizar as expectativas de forma intencional e manter a reconciliação com esta linha de base.
