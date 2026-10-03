# 04: Remover a tabela `public.invoices`

Parte da spec 054 (Painel do Proprietário).

**What to build:** sai do banco a tabela de faturas que nenhum código grava e que, depois do ticket 02, ninguém lê, junto com as policies e o índice dela. Ninguém mais consegue somar receita de uma tabela sem escritor.

**Blocked by:** 02 (Faturamento do mês e Evolução da receita vêm das cobranças aprovadas)

**Status:** done

- [x] Busca no repositório (front, Edge Functions, migrations recentes e funções do banco no DEV) mostra que nada lê nem grava `invoices`
- [x] Contagem de linhas só com leitura no DEV; na PROD, só com o OK explícito do usuário. Se alguma tiver linhas, o ticket para e volta ao usuário
- [x] Migration aplicada só no DEV remove a tabela, as policies e o índice
- [x] `docs/modelagem_banco.md` deixa de citar a tabela
- [x] pgTAP da spec (o do ticket 02) prova que a tabela não existe mais (`hasnt_table`)
- [x] Gates de lint, Vitest e build passam

## Resultado

Commit e255852. Migration `20261003231247_054_ticket04_remover_a_tabela_invoices.sql` (`drop table public.invoices;`, sem CASCADE), aplicada só no DEV. pgTAP 80 ficou 31/31 (primeiro vermelho: `hasnt_table` e as 4 policies ainda existiam).

Conferência só com leitura. DEV: 0 linhas, nenhuma função, view nem chave estrangeira depende da tabela. PROD (`boakqstrdfqmsrwnjore`, com o OK do usuário em 2026-10-03): 0 linhas, nenhuma view nem chave estrangeira; a única função que cita `invoices` é a versão antiga de `get_admin_dashboard_metrics`, que a migration do ticket 02 substitui antes do DROP (as versões estão em ordem). Nada foi aplicado na PROD. `docs/modelagem_banco.md` deixou de citar a tabela (diagrama, DDL, índice, RLS e policies).
