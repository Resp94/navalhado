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

- [x] RPCs de Categoria de Despesa: criar (nome), renomear (categoria, nome), arquivar (categoria) e
      reativar (categoria). Criar grava sempre natureza despesa; a natureza não é parâmetro.
- [x] Todas com definidor de segurança e caminho de busca vazio; resolvem o tenant como as RPCs de
      vale e quitação (parâmetro opcional de tenant, recusado quando diverge do tenant do usuário e
      o usuário não é administrador do SaaS; ausente, vale o tenant do usuário) e revalidam o papel
      de gestão internamente.
- [x] Execução revogada de público e anônimo e concedida a autenticado e ao papel de serviço.
- [x] Criar e renomear normalizam o nome (pontas aparadas, espaços internos colapsados) e validam 2 a
      60 caracteres.
- [x] Toda criação, renomeação, arquivamento e reativação registra quem fez e quando.
- [x] Criar ou renomear para nome existente, sem diferenciar maiúsculas e inclusive contra
      arquivada, é recusado com erro de conflito que identifica a categoria existente e informa se
      ela está arquivada. A violação do índice único sob concorrência também chega à tela como
      conflito.
- [x] Renomear categoria arquivada é recusado. Arquivar o que já está arquivado e reativar o que já
      está ativo são recusados com mensagem própria, nunca ignorados em silêncio.
- [x] Arquivar não pede motivo e não altera nada que já referencie a categoria.
- [x] Repositório expõe criar, renomear, arquivar e reativar categoria, validando e normalizando a
      entrada antes de delegar ao adaptador.
- [x] Dois erros de domínio: erro de validação com mensagem em português e erro de conflito com o
      identificador do registro existente e se ele está arquivado. Erros do banco são traduzidos
      nesses dois tipos atrás do repositório.
- [x] O adaptador em memória reproduz o contrato de erro (conflito de nome, recusa de registro
      arquivado, recusa de dupla operação), não a implementação do banco.
- [x] O hook refaz a leitura depois de cada escrita bem-sucedida e expõe as ações.
- [x] Formulário de categoria como componente autônomo, independente da aba: recebe valores iniciais
      e o repositório e devolve o registro salvo. A aba o compõe dentro do Drawer do kit de UI, sem
      props booleanas de modo no formulário.
- [x] Arquivar pede confirmação pelo diálogo de confirmação do kit de UI (não o modal de exclusão de
      serviços da spec 013), com texto de arquivamento: a categoria sai das opções de lançamento, o
      histórico é preservado e é possível reativar.
- [x] Categoria arquivada exibe a ação de reativar, sem confirmação.
- [x] Conflito na criação com categoria arquivada oferece reativá-la ali mesmo; com categoria ativa,
      informa que já existe e aponta qual é.
- [x] Casos no arquivo pgTAP do Plano de Contas: unicidade de nome sem diferenciar maiúsculas,
      inclusive contra arquivada, com o conflito identificando o registro existente; normalização de
      espaços; arquivar e reativar, com recusa de dupla operação e de renomear arquivada; autoria
      registrada; profissional recusado pela revalidação de papel; anônimo sem execução.
- [x] Testes do repositório com adaptador falso cobrindo validação, normalização e tradução de erro
      de banco em erro de validação ou de conflito; teste do adaptador Supabase para as escritas.
- [x] Teste da aba com o adaptador em memória nos fluxos completos: criar categoria; colidir com
      arquivada e reativar; arquivar com confirmação. O formulário não ganha arquivo de teste
      próprio.
- [x] `npm run test` e `npm run test:db` verdes (`test:db` verificado por `execute_sql` do MCP do
      Supabase, não pela CLI — ver Notas de implementação).

## Notas de implementação

- **RPCs (nomes que os tickets 035/06 e 036/06 consomem):** `public.create_expense_category(p_name
  text, p_tenant_id uuid default null)`, `public.rename_expense_category(p_category_id uuid, p_name
  text, p_tenant_id uuid default null)`, `public.archive_expense_category(p_category_id uuid,
  p_tenant_id uuid default null)`, `public.reactivate_expense_category(p_category_id uuid,
  p_tenant_id uuid default null)`. Todas devolvem `public.financial_categories` (a linha inteira, não
  jsonb) e seguem a resolução de tenant e revalidação de papel de
  `register_commission_payout`/`get_professional_commission_balance`.
- **Contrato de conflito:** toda violação de nome (checagem explícita OU corrida contra o índice
  único, capturada com `exception when unique_violation`) levanta `SQLSTATE 23505` com uma mensagem
  em português e `detail` em JSON: `{"existing_id", "existing_name", "archived"}`. O adaptador
  Supabase lê `error.code === '23505'` e faz `JSON.parse(error.details)` para montar
  `PlanoContasConflictError`; qualquer outro erro vira `PlanoContasValidationError` com a mensagem da
  própria RPC.
- **Erros de domínio (nomes que os tickets seguintes consomem):**
  `PlanoContasValidationError` (já existia, ticket 03) e `PlanoContasConflictError` (novo), ambos em
  `src/modules/plano-contas/PlanoContasRepository.ts`. `PlanoContasConflictError` expõe
  `existingId`, `existingName` e `archived`.
- **Normalização de nome reutilizável:** `normalizarNome` em `src/modules/plano-contas/nome.ts` (trim
  + colapso de espaços). A spec pede a mesma regra para o nome de Fornecedor (ticket 06); a função
  foi extraída para esse fim, em vez de ficar só dentro do repositório.
- **Formulário autônomo:** `CategoriaDespesaForm` em `src/components/financeiro/` (não em
  `src/modules/`, que não tem componentes React neste projeto). Recebe `repository`, `tenantId` e
  `categoria?` (presente = renomear; ausente = criar) e resolve sozinho o fluxo de conflito —
  inclusive oferecer "Reativar" quando a categoria existente está arquivada. Chama o repositório
  injetado diretamente (não as ações do hook), então quem o compõe (a aba, e futuramente o cadastro
  rápido da 036) deve dar um `reload()` no callback `onSalvar`.
- **Backfill acidental em DEV:** ao validar a migration 130000/110000 (herdadas, já mescladas) via
  `execute_sql`, a primeira chamada não tinha `begin;`/`rollback;` fechando o lote e commitou de
  verdade (tabela `financial_categories`, funções de semeadura/documento e a semeadura das 14
  categorias padrão para os 3 tenants reais do DEV). O conteúdo é idêntico ao das migrations já
  mescladas (idempotente: `if not exists`, `create or replace`, `on conflict do nothing`), então não
  introduziu nada incorreto, mas não deveria ter persistido fora do fluxo normal de deploy — registrado
  aqui para o `main` avaliar se precisa de alguma ação. As RPCs deste ticket (140000) foram validadas
  à parte, corretamente dentro de `begin;`/`rollback;`, e **não** persistiram.
- **Verificação de banco:** rodei as 80 asserções do pgTAP (`select plan(80)`) via `execute_sql`,
  agregando a saída de cada `select is/ok/throws_ok/lives_ok/has_function/has_table(...)` numa tabela
  temporária só para conseguir ver o relatório completo numa única chamada (o MCP devolve só o
  resultado da última instrução) — a transformação não faz parte do arquivo de teste real, só da
  verificação manual. As 80 passaram (`1..80`, todas `ok`).
