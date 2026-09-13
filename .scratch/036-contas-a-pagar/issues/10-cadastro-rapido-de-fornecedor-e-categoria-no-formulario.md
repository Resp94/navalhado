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

**Status:** ready-for-agent

- [ ] O formulário de Conta a Pagar oferece cadastrar Fornecedor e Categoria de Despesa sem fechar
      o formulário (história 9).
- [ ] O cadastro reutiliza os formulários de categoria e de fornecedor da 035 e o repositório do
      Plano de Contas, sem duplicar validação, normalização ou tradução de erro.
- [ ] Os campos já preenchidos na Conta a Pagar permanecem depois do cadastro rápido, bem-sucedido
      ou cancelado.
- [ ] O registro criado fica selecionado na conta; Fornecedor criado com categoria padrão ativa
      pré-preenche a categoria segundo a mesma regra do ticket 06.
- [ ] Conflito com registro arquivado oferece reativá-lo; conflito com registro ativo aponta o
      existente para seleção.
- [ ] Teste da aba de Contas a Pagar cobre o cadastro rápido de Fornecedor e de Categoria de
      Despesa com o adaptador em memória do Plano de Contas — a cobertura que a 035 atribui a esta
      spec.
- [ ] `npm run test` verde.
