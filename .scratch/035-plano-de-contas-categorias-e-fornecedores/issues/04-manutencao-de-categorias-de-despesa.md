# 04: Manutenção de Categorias de Despesa

**What to build:** o gestor ajusta o Plano de Contas ao jeito como enxerga os custos da casa: cria
Categorias de Despesa com nome próprio, renomeia para corrigir um nome sem perder o que já foi
classificado, arquiva a que não usa mais e reativa quando se arrepende. O sistema impede "Energia" e
"energia" lado a lado e, quando o gestor tenta criar um nome que pertence a uma categoria
arquivada, oferece reativá-la em vez de recriar.

**A unicidade vale também contra arquivadas.** Com unicidade só entre ativas, arquivar "Marketing" e
criar "Marketing" de novo produziria duas categorias homônimas, e todo relatório por categoria
sairia partido sem que o gestor percebesse. Efeito útil: reativar nunca colide.

**Arquivar, nunca apagar.** Não há exclusão física: nem política, nem RPC, nem botão. Uma exclusão
"só quando nunca usada" teria de ser reverificada a cada tabela nova que referencie categoria, com
corrida entre verificação e referência. Nome digitado errado se corrige renomeando. Arquivar não
exige motivo: categoria é cadastro, e autor e momento bastam.

**Contrato de arquivamento herdado pela 036:** categoria arquivada não recebe referência nova,
referências existentes ficam intactas, e ela é somente leitura até ser reativada. Renomear muda o
rótulo de tudo que já foi classificado; não há snapshot de nome.

Spec: `specs/035-plano-de-contas-categorias-e-fornecedores/spec.md`, seções "Entrega 2 — Categorias
de Despesa", "Escrita por RPC, leitura por tabela", "Módulo" e "Entrega 3 — Aba Plano de contas".

**Blocked by:** 03 (Aba Plano de Contas com as Categorias de Despesa padrão).

**Status:** ready-for-agent

- [ ] RPCs de Categoria de Despesa: criar (nome), renomear (categoria, nome), arquivar (categoria) e
      reativar (categoria). Criar grava sempre natureza despesa; a natureza não é parâmetro.
- [ ] Todas com definidor de segurança e caminho de busca vazio; resolvem o tenant como as RPCs de
      vale e quitação (parâmetro opcional de tenant, recusado quando diverge do tenant do usuário e
      o usuário não é administrador do SaaS; ausente, vale o tenant do usuário) e revalidam o papel
      de gestão internamente.
- [ ] Execução revogada de público e anônimo e concedida a autenticado e ao papel de serviço.
- [ ] Criar e renomear normalizam o nome (pontas aparadas, espaços internos colapsados) e validam 2 a
      60 caracteres.
- [ ] Toda criação, renomeação, arquivamento e reativação registra quem fez e quando.
- [ ] Criar ou renomear para nome existente, sem diferenciar maiúsculas e inclusive contra
      arquivada, é recusado com erro de conflito que identifica a categoria existente e informa se
      ela está arquivada. A violação do índice único sob concorrência também chega à tela como
      conflito.
- [ ] Renomear categoria arquivada é recusado. Arquivar o que já está arquivado e reativar o que já
      está ativo são recusados com mensagem própria, nunca ignorados em silêncio.
- [ ] Arquivar não pede motivo e não altera nada que já referencie a categoria.
- [ ] Repositório expõe criar, renomear, arquivar e reativar categoria, validando e normalizando a
      entrada antes de delegar ao adaptador.
- [ ] Dois erros de domínio: erro de validação com mensagem em português e erro de conflito com o
      identificador do registro existente e se ele está arquivado. Erros do banco são traduzidos
      nesses dois tipos atrás do repositório.
- [ ] O adaptador em memória reproduz o contrato de erro (conflito de nome, recusa de registro
      arquivado, recusa de dupla operação), não a implementação do banco.
- [ ] O hook refaz a leitura depois de cada escrita bem-sucedida e expõe as ações.
- [ ] Formulário de categoria como componente autônomo, independente da aba: recebe valores iniciais
      e o repositório e devolve o registro salvo. A aba o compõe dentro do Drawer do kit de UI, sem
      props booleanas de modo no formulário.
- [ ] Arquivar pede confirmação pelo diálogo de confirmação do kit de UI (não o modal de exclusão de
      serviços da spec 013), com texto de arquivamento: a categoria sai das opções de lançamento, o
      histórico é preservado e é possível reativar.
- [ ] Categoria arquivada exibe a ação de reativar, sem confirmação.
- [ ] Conflito na criação com categoria arquivada oferece reativá-la ali mesmo; com categoria ativa,
      informa que já existe e aponta qual é.
- [ ] Casos no arquivo pgTAP do Plano de Contas: unicidade de nome sem diferenciar maiúsculas,
      inclusive contra arquivada, com o conflito identificando o registro existente; normalização de
      espaços; arquivar e reativar, com recusa de dupla operação e de renomear arquivada; autoria
      registrada; profissional recusado pela revalidação de papel; anônimo sem execução.
- [ ] Testes do repositório com adaptador falso cobrindo validação, normalização e tradução de erro
      de banco em erro de validação ou de conflito; teste do adaptador Supabase para as escritas.
- [ ] Teste da aba com o adaptador em memória nos fluxos completos: criar categoria; colidir com
      arquivada e reativar; arquivar com confirmação. O formulário não ganha arquivo de teste
      próprio.
- [ ] `npm run test` e `npm run test:db` verdes.
