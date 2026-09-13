# 03: Sangria e suprimento por RPC com trava de saldo

**What to build:** o gestor passa a ser impedido de lançar uma sangria maior que o saldo disponível
na gaveta. Hoje ela é aceita, deixa o valor esperado negativo e a restrição de valor esperado não
negativo torna o fechamento do turno impossível — o mesmo defeito que a spec 033 corrigiu para a
quitação. Além disso, toda movimentação manual passa a registrar como autor quem realmente a fez:
hoje o autor é informado pelo navegador e ninguém confere.

Suprimento e sangria passam a ser lançados por uma RPC, nos moldes das escritas financeiras do
projeto, e a aba de Caixa deixa de inserir direto na tabela.

**Expand-contract.** Este ticket é a etapa de migrar os chamadores. A inserção direta **continua
permitida** aqui, para não quebrar navegadores com a versão anterior. A revogação é o ticket 04, e
**o frontend deste ticket precisa estar publicado em produção antes de o ticket 04 ser aplicado**.

Spec: `specs/036-contas-a-pagar/spec.md`, seção "Entrega 1 — Apuração única do valor esperado da
gaveta" (brecha de inserção direta).

**Blocked by:** 01 — Expand: apuração única do valor esperado da gaveta no servidor;
035/02 — Hub Financeiro em sub-rotas.

**Status:** ready-for-agent

- [x] RPC de movimento manual aceita só suprimento e sangria e recusa qualquer outro tipo.
- [x] A RPC grava o autor a partir da sessão autenticada, sem parâmetro de autor.
- [x] A RPC trava a Sessão de Caixa, exige que esteja aberta e pertença ao tenant, e só então
      valida o saldo.
- [x] Sangria acima do disponível apurado pela função privada do ticket 01 é recusada com
      mensagem no padrão da Quitação de Comissão e do vale (história 3).
- [x] A RPC é `security definer` com `search_path` vazio, revalida papel e tenant (gerente do
      próprio tenant; proprietário como administrador do SaaS), tem execução revogada de público e
      anônimo e concedida a autenticado e serviço.
- [x] O módulo de Caixa ganha o método de movimento manual por RPC; o lançamento de suprimento e
      sangria na aba de Caixa passa a usá-lo, sem enviar autor.
- [x] Regressão na suíte pgTAP `25_validar_saldo_gaveta_quitacao_comissao`:
  - [x] sangria acima do disponível é recusada;
  - [x] sangria igual ao disponível é aceita e o turno fecha com valor esperado zero.
- [x] A suíte pgTAP `20_reabertura_sessao_caixa` passa a lançar a sangria pós-reabertura pela RPC.
- [x] Arquivos pgTAP que inserem movimentos como superusuário só para montar contexto não mudam
      (o insert de `vale_profissional` em `25_validar_saldo_gaveta_quitacao_comissao` como
      superusuário para montar o contexto de `ticket25b_context` não foi tocado).
- [x] Testes de repositório e de adaptador do módulo de Caixa cobrem o movimento manual por RPC
      (mapeamento de parâmetros, ausência de autor enviado, erro de saldo).
- [ ] Deploy do frontend deste ticket publicado em produção, registrado como pré-condição do
      ticket 04. **Não cumprido nesta sessão**: implementação e testes ficam prontos no branch,
      mas o deploy em produção é uma ação fora do escopo de um agente de desenvolvimento — o
      `main`/humano responsável precisa publicar e só então liberar o ticket 04.
- [x] `npm run test` e `npm run test:db` verdes (`test:db` cumprido via MCP do Supabase, sem
      persistir nada no projeto DEV — ver notas de implementação).

**Notas de implementação:**

- Migration `supabase/migrations/20260913150000_sangria_suprimento_rpc_trava_de_saldo.sql`,
  faixa de timestamp `20260913150000`–`20260913159999`, ainda não aplicada no DEV.
- Nome do contrato novo consumido pelo frontend: `public.register_cash_movement(p_cash_session_id
  uuid, p_tenant_id uuid, p_type text, p_amount numeric, p_reason text) returns jsonb`. Devolve o
  movimento gravado (`id, tenant_id, cash_session_id, type, amount, reason, performed_by,
  created_at`), no mesmo formato de `CashMovement`. `p_type` aceita só `'sangria'` e
  `'suprimento'` (case/trim insensível); qualquer outro valor é recusado com `P0001`. Mensagem de
  recusa de saldo: `'O valor da sangria excede o saldo disponível na gaveta do turno.'` — mesmo
  padrão de `register_commission_payout`/`register_professional_advance`.
- Ordem de lock dentro da RPC: valida entrada (papel/tenant/tipo/valor/motivo) primeiro, só então
  trava a sessão (`for update`) e valida estado aberto + tenant, e só então (para sangria) consulta
  `private.compute_cash_session_expected_amount` para o saldo — mesma ordem das demais escritas
  financeiras da gaveta.
- Módulo `src/modules/caixa`: tipo novo `RegistrarMovimentoManualInput` (sem `performed_by`),
  método novo `registrarMovimentoManual`/`registerManualMovement` em `ICaixaAdapter` /
  `SupabaseCaixaAdapter` / `CaixaRepository`, chamando a RPC acima. O método antigo
  `registrarMovimentacao`/`registerMovement` (insert direto) foi **mantido intacto**, sem uso pelo
  frontend a partir de agora — ele só deixa de existir quando o ticket 04 revogar a política de
  inserção direta.
- `CaixaTab.tsx`: `handleSangria`/`handleSuprimento` passam a chamar
  `caixaRepo.registerManualMovement(...)` sem `performed_by` e sem `supabase.auth.getUser()`
  (import de `supabase` removido do arquivo, não usado em mais nada ali). Nenhuma mudança na
  leitura/exibição da prévia da gaveta (`activeSession`, `expectedAmount` etc.) — território do
  ticket 036/02.
- pgTAP: `20_reabertura_sessao_caixa` troca o insert direto de sangria pós-reabertura pela RPC
  (mesmo `plan(15)`, sem novo caso). `25_validar_saldo_gaveta_quitacao_comissao` ganha um bloco
  novo e isolado (`ticket36_03_context`, tenant próprio) com a regressão pedida pelo ticket:
  sangria acima do disponível recusada, sangria no limite aceita, e fechamento do turno com
  `expected_amount = 0` (`plan(24)`, antes `plan(18)`).
- A política `cash_movements_insert_policy` e as permissões de insert direto em `cash_movements`
  **não foram tocadas** — seguem valendo até o ticket 04.
