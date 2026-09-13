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
