# 04: Contract — revogar a inserção direta em movimentos de caixa

**What to build:** o proprietário passa a ter garantia de que toda movimentação de caixa registra
como autor quem realmente a fez, sem que o navegador possa informar outro autor. Depois do ticket
03, a RPC já faz o certo, mas a porta antiga continua aberta: a política atual deixa o gestor
inserir movimento de **qualquer tipo** direto na tabela, com autor livre, vínculos de quitação,
profissional e estorno forjáveis, e sem trava de saldo.

Este ticket fecha essa porta. Restringir a política a suprimento e sangria não bastaria: autor e
vínculos continuariam forjáveis, cada coluna futura reabriria a brecha, e a política não consegue
validar saldo sem replicar a fórmula e travar a sessão.

**Expand-contract.** É a segunda migração da Entrega 1. A revogação quebra qualquer navegador com a
versão anterior do adaptador de caixa, por isso **só pode ser aplicada depois que o frontend do
ticket 03 estiver publicado em produção**.

Spec: `specs/036-contas-a-pagar/spec.md`, seção "Entrega 1 — Apuração única do valor esperado da
gaveta" (brecha de inserção direta; expand e contract).

**Blocked by:** 03 — Sangria e suprimento por RPC com trava de saldo (com o frontend já publicado
em produção).

**Status:** done

> Aplicado com o usuário confirmando explicitamente que o ambiente de validação é o DEV hospedado
> na Cloudflare (não produção) e que a decisão de seguir para produção viria depois de validar ali
> — a pré-condição de deploy do ticket 03 foi tratada como satisfeita para este ambiente de
> validação, e não como dispensada.

- [x] Pré-condição verificada antes de aplicar a migração: o frontend do ticket 03 está em
      produção e nenhum chamador vivo insere direto em movimentos de caixa. (Confirmado pelo
      usuário para o ambiente de validação DEV/Cloudflare, que é o alvo desta migração.)
- [x] A política de inserção em movimentos de caixa é removida. (`cash_movements_insert_policy`
      dropada; confirmado via `pg_policies` no DEV real, zero linhas.)
- [x] A permissão de inserção direta é revogada do papel autenticado. (Confirmado via
      `has_table_privilege('authenticated', 'public.cash_movements', 'INSERT')` = false no DEV
      real.)
- [x] A permissão residual do papel anônimo na tabela é revogada (hoje neutralizada só pela
      ausência de política). (`revoke all ... from anon`; confirmado via
      `has_table_privilege('anon', 'public.cash_movements', 'SELECT')` = false no DEV real.)
- [x] Nenhuma outra tabela financeira tem permissões alteradas neste ticket. (Migration
      `20260913190000_contract_revoga_insercao_direta_movimentos_caixa.sql` só toca
      `public.cash_movements`.)
- [x] A suíte pgTAP `03_restringir_operacoes_financeiras_estoque` passa a afirmar que o papel
      autenticado não tem permissão de inserção em movimentos de caixa.
- [x] A suíte pgTAP `17_code_review_regressions` troca a asserção sobre o texto da política pela
      recusa, na RPC, de movimento em sessão fechada. (Bloco novo com contexto sintético,
      `register_cash_movement` contra sessão fechada, `throws_ok` P0001.)
- [x] A suíte pgTAP `18_code_review_behavioral_regressions` mantém a recusa de inserção direta em
      caixa fechado, agora por falta de permissão. (Mesmo `throws_ok` 42501, rótulo atualizado.)
- [x] Um gestor autenticado não consegue gravar movimento de caixa com autor diferente de si mesmo
      por nenhum caminho exposto (história 4). (Sem INSERT direto nem política; único caminho
      restante é `register_cash_movement`, que grava `performed_by` a partir de `auth.uid()`.)
- [x] `npm run test:db` verde. (Validado em duas etapas via MCP: primeiro a migration + as 3
      suítes afetadas — 03 (11/11), 17 (26/26), 18 (11/11) — dentro de `begin/rollback`, sem
      persistir nada; depois a migration foi aplicada de fato via `apply_migration` e o estado real
      do DEV foi reconferido com as mesmas três consultas de privilégio/política.)

**Notas de implementação:**

- Migration `supabase/migrations/20260913190000_contract_revoga_insercao_direta_movimentos_caixa.sql`
  aplicada no DEV via MCP `apply_migration`: `drop policy cash_movements_insert_policy`,
  `revoke insert ... from authenticated`, `revoke all ... from anon`.
- `03_restringir_operacoes_financeiras_estoque.test.sql`: a asserção que antes esperava
  `has_table_privilege('authenticated', ..., 'INSERT')` verdadeiro ("authenticated retains cash
  movement insertion") foi invertida para `not has_table_privilege(...)`.
- `17_code_review_regressions.test.sql`: a asserção estática sobre o texto de
  `cash_movements_insert_policy.with_check` (que não existe mais) foi substituída por um teste
  comportamental — contexto sintético com sessão de caixa fechada, chamando
  `register_cash_movement` e esperando `P0001`/"A sessão de caixa não está aberta ou não existe."
  Contagem de assertions do arquivo não mudou (`plan(26)`).
- `18_code_review_behavioral_regressions.test.sql`: o `throws_ok` que já esperava SQLSTATE `42501`
  para insert direto em caixa fechado continua correto sem alteração de lógica — `42501` é o mesmo
  código tanto para violação de RLS quanto para ausência de GRANT. Só o rótulo foi atualizado para
  refletir a nova causa.
- Não foi necessária nenhuma mudança em código de frontend: `CaixaTab.tsx` já usa
  `registerManualMovement`/`register_cash_movement` desde o ticket 03; o método antigo
  `registrarMovimentacao`/`registerMovement` (insert direto) permanece no módulo como código não
  mais utilizável (chamá-lo agora falha com permissão negada), sem uso ativo pelo frontend — fora
  do escopo deste ticket remover esse método morto.
