# 10: Cadastro rápido de Fornecedor e Categoria de Despesa no formulário

**What to build:** no meio do lançamento de uma Conta a Pagar, o gestor percebe que o Fornecedor
ou a Categoria de Despesa ainda não existe. Ele os cadastra ali mesmo, sem sair do formulário e sem
perder o que já digitou, e o registro criado já fica selecionado na conta.

O cadastro rápido **não é uma segunda implementação**: compõe os formulários autônomos e o contrato
de escrita do Plano de Contas da 035. Os conflitos que a 035 trata — nome ou documento já
existente, inclusive arquivado, com oferta de reativar — valem igual aqui, e é justamente no
cadastro rápido que o risco de criar "Enel" pela segunda vez é maior.

A variação entre o uso na aba Plano de contas e o uso aqui fica no contêiner, nunca em props
booleanas de modo dentro do formulário.

Spec: `specs/036-contas-a-pagar/spec.md`, seções "Dependência da spec 035", "Interface" e "Testing
Decisions" (interface).

**Blocked by:** 06 — Lançar Conta a Pagar avulsa e vê-la na lista paginada;
035/06 — Cadastro de Fornecedores.

**Status:** done

- [x] O formulário de Conta a Pagar oferece cadastrar Fornecedor e Categoria de Despesa sem fechar
      o formulário (história 9).
- [x] O cadastro reutiliza os formulários de categoria e de fornecedor da 035 e o repositório do
      Plano de Contas, sem duplicar validação, normalização ou tradução de erro.
- [x] Os campos já preenchidos na Conta a Pagar permanecem depois do cadastro rápido, bem-sucedido
      ou cancelado.
- [x] O registro criado fica selecionado na conta; Fornecedor criado com categoria padrão ativa
      pré-preenche a categoria segundo a mesma regra do ticket 06.
- [x] Conflito com registro arquivado oferece reativá-lo; conflito com registro ativo aponta o
      existente para seleção.
- [x] Teste da aba de Contas a Pagar cobre o cadastro rápido de Fornecedor e de Categoria de
      Despesa com o adaptador em memória do Plano de Contas — a cobertura que a 035 atribui a esta
      spec.
- [x] `npm run test` verde.

## Notas de implementação

- Sem migration: ticket puramente de front-end, compondo formulários já existentes da 035
  (`CategoriaDespesaForm`, `FornecedorForm`) dentro de um `Drawer` aninhado sobre o Drawer de
  lançamento — os dois `Drawer`s empilham sem conflito visual (mesmo padrão de `ConfirmDialog`
  sobre `Drawer` já usado em `PlanoContasTab`).
- `ContaPagarForm.tsx` ganhou `planoContasRepository` (opcional — ausente esconde os atalhos),
  `onCategoriaCriada` e `onFornecedorCriado`. Internamente mantém `categoriasExtras`/
  `fornecedoresExtras`: o registro recém-criado entra imediatamente nas opções do próprio select
  do formulário, sem depender do `reload()` assíncrono do `usePlanoContas` da aba (que ainda
  roda, via os callbacks, para a lista da aba divergir do banco o mínimo possível). Conflito com
  registro arquivado (oferece reativar) e com registro ativo (aponta o existente) já funcionam
  sem código novo: `onSalvar` dos formulários da 035 recebe o registro reativado do mesmo jeito
  que recebe um registro recém-criado.
- Fornecedor criado com categoria padrão ativa pré-preenche a Categoria de Despesa com a mesma
  regra de "só se o gestor ainda não tiver escolhido manualmente" já usada no ticket 06/036.
- Testes: dois casos novos em `ContasPagarTab.test.tsx` (cadastro rápido de Categoria de Despesa e
  de Fornecedor, com `InMemoryPlanoContasAdapter`), verificando que o campo fica preenchido e o
  registro criado fica selecionado no formulário antes do lançamento. `npx tsc -b` e `npx oxlint`
  limpos.
