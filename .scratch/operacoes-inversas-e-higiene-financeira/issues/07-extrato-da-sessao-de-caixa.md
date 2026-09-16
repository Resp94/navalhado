# 07 — Extrato da Sessão de Caixa

**What to build:** O gerente abre o extrato de um turno encerrado e entende o que aconteceu com aquela conferência: a divergência apurada no fechamento, os ajustes posteriores com autor e motivo, a divergência ajustada como número corrente, as movimentações do turno incluindo as quitações pagas em dinheiro, e as reaberturas anteriores da mesma sessão. O gerente também registra um ajuste posterior pela aplicação, e não apenas pelo banco. Barbeiro não acessa nada disso.

**Blocked by:** 04 — Quitação de Comissão sai da gaveta; 05 — Reabertura de Sessão de Caixa.

**Status:** done — migration aplicada no DEV, pgTAP e vitest verdes

- [x] Consultar pelo MCP as policies vigentes das tabelas de auditoria envolvidas no DEV.
- [x] Criar a função remota de extrato devolvendo em uma única chamada a fotografia do fechamento corrente, os ajustes posteriores com autor e motivo, a divergência ajustada acumulada, as movimentações do turno e o histórico de reaberturas.
- [x] Exigir papel financeiro autorizado e unidade correspondente, recusando barbeiro e usuário de outra unidade.
- [x] Apresentar a divergência ajustada como número corrente mantendo a original visível ao lado, sem alterar a linha da sessão após o fechamento.
- [x] Migrar a função de resumo financeiro diário para `search_path` vazio com schemas qualificados.
- [x] Cobrir por pgTAP: extrato completo em uma chamada; divergência ajustada refletindo ajustes acumulados; quitações em dinheiro aparecendo entre as saídas; reaberturas listadas; recusa para papel não autorizado e para outra unidade.
- [x] Acrescentar ao contrato do `CaixaRepository`, de forma aditiva, as operações de obter extrato e registrar ajuste posterior, e cobrir a validação de entrada.
- [x] Aplicar no DEV pelo MCP e comparar advisors antes e depois.
- [x] Manter verdes as suítes atuais de Caixa e Financeiro.

## Notas de execução

- Migration `20260912030000_extrato_sessao_caixa` aplicada no DEV via MCP,
  versão reconciliada (o MCP carimbou `20260912013342`, corrigido para o
  timestamp do arquivo local).
- Nova função `get_cash_session_statement(p_session_id, p_tenant_id)`:
  exige gerente/proprietário da unidade correspondente (prerrogativa
  multiunidade do proprietário preservada), devolve em um único `jsonb` a
  fotografia da sessão (`session`), os ajustes posteriores ordenados por
  data com autor e motivo (`adjustments`), a divergência ajustada
  acumulada — divergência original da sessão somada a todos os ajustes —
  como número corrente sem alterar a linha da sessão (`adjusted_difference_amount`),
  as movimentações do turno incluindo `repasse_comissao` com marcação de
  estorno quando houver (`movements`), e o histórico de reaberturas
  (`reopenings`). `anon` sem `execute` (revogado explicitamente); apenas
  `authenticated`/`service_role`.
- `get_daily_financial_summary` migrada para `search_path = ''` com todas
  as referências já qualificadas por schema (`public.`, `auth.uid()`);
  mesma assinatura de 5 parâmetros — `CREATE OR REPLACE` substituiu a
  função original sem criar overload nem resetar grants (confirmado via
  `pg_proc`/`has_function_privilege`, apenas um `regprocedure` para o
  nome).
- Novo `supabase/tests/database/22_extrato_sessao_caixa.test.sql`
  (15 asserções): extrato completo em uma chamada; dois ajustes
  posteriores refletidos na divergência ajustada (0 + 5 - 2 = 3); repasse
  de comissão listado entre as movimentações; nenhuma reabertura antes,
  uma reabertura depois de reabrir o turno; recusa por falta de sessão;
  recusa por unidade diferente da do gerente (o `gerente` é barrado pela
  checagem de unidade antes mesmo do `select` na sessão — comportamento
  correto e consistente com as demais RPCs financeiras); recusa de papel
  não autorizado (barbeiro); `anon` sem privilégio de execução.
- Frontend: `CaixaRepository` ganha `registerAdjustment`/`registrarAjuste`
  (valida sessão, tenant, valor diferente de zero e motivo com 5+
  caracteres) e `getSessionStatement`/`obterExtrato`, ambos aditivos.
  `SupabaseCaixaAdapter` implementa via `register_cash_session_adjustment`
  (RPC já existente desde os specs 030/032, sem chamador no frontend até
  agora) e `get_cash_session_statement`. Nenhuma tela nova — a
  apresentação visual do extrato fica para trabalho posterior, seguindo o
  mesmo corte do ticket 06 para o estorno de comissão.
- Advisors de segurança sem alerta novo (`anon_security_definer_function_executable`
  seguiu em 15 antes e depois); `npx tsc -b --noEmit` limpo; vitest
  completo: 67 arquivos / 436 testes verdes (era 425 após o ticket 06).
