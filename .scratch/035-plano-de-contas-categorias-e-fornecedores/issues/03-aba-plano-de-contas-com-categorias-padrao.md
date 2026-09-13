# 03: Aba Plano de Contas com as Categorias de Despesa padrão

**What to build:** o gestor abre a aba **Plano de contas** do Hub Financeiro e encontra a barbearia
já com as Categorias de Despesa comuns do setor, para classificar a primeira conta sem montar um
plano de contas do zero. Barbearias que já usam o sistema recebem exatamente o mesmo conjunto que um
tenant novo recebe. O profissional não enxerga nada disso: custos da casa são assunto da gestão.

Hoje aluguel, energia e compra de produto para revenda são, para o sistema, a mesma sangria com
texto livre. Este ticket cria o lugar onde a classificação mora; a manutenção das categorias chega
no ticket 04 e os Fornecedores no ticket 06.

**A semeadura é um gatilho sobre a criação do tenant, não o wizard de onboarding.** O tenant nasce
dentro do gatilho de cadastro de usuário, e o wizard só atualiza o tenant já existente, sem
atomicidade. Um gatilho após inserção em tenants cobre todo caminho de criação (inclusive fixtures
de teste e um futuro fluxo administrativo), roda na mesma transação e dispensa mexer na função de
cadastro, que é sensível de segurança. Falha na semeadura aborta a criação do tenant: não existe
tenant sem categorias padrão.

**A idempotência se apoia na chave estável, não no nome.** Pelo nome, um gestor que renomeou
"Energia" para "Luz" ganharia outra "Energia" a cada execução.

Spec: `specs/035-plano-de-contas-categorias-e-fornecedores/spec.md`, seções "Entrega 2 — Categorias
de Despesa", "Integridade entre tenants por chave composta", "Acesso", "Índices", "Módulo" e
"Entrega 3 — Aba Plano de contas".

**Blocked by:** 02 (Hub Financeiro em sub-rotas).

**Status:** ready-for-agent

- [x] Tabela de categorias financeiras por tenant, com coluna de natureza cujo domínio aceita
      apenas despesa nesta spec (receita entra no futuro alargando o domínio, sem tabela nova).
- [x] Categoria plana: sem hierarquia e sem grupo de DRE.
- [x] Nome com 2 a 60 caracteres, gravado com espaços das pontas removidos e espaços internos
      repetidos colapsados.
- [x] Nome único por tenant e natureza sem diferenciar maiúsculas, **incluindo categorias
      arquivadas**, garantido por índice único sobre o nome em minúsculas. Acentos entram na
      comparação ("Agua" e "Água" são distintos).
- [x] Chave estável da categoria padrão, nula nas criadas pelo gestor, com índice único parcial por
      tenant.
- [x] Arquivamento por um único carimbo de momento e autor (nulo significa ativa), sem par de
      colunas ativo/excluído. Colunas de autoria e momento de criação e alteração.
- [x] Unicidade adicional sobre o par tenant e identificador, para que Fornecedor (ticket 06) e
      Conta a Pagar (spec 036) referenciem categoria por chave estrangeira composta.
- [x] Colunas de autoria referenciam os usuários com anulação na exclusão, e todo FK é indexado desde
      a criação; o FK de tenant é coberto pelos índices únicos que começam por tenant. Sem índice
      parcial por estado de arquivamento.
- [x] Função privada de semeadura, com definidor de segurança, caminho de busca vazio e sem execução
      concedida a papéis de API, que insere as catorze categorias padrão ignorando conflito sem
      alvo (cobre chave estável e nome: se o gestor já tem uma categoria com o nome de uma padrão
      nova, a dele prevalece). Categorias semeadas têm autor nulo.
- [x] As catorze categorias padrão, em caixa de frase e cada uma com a chave estável da tabela da
      spec: Aluguel e condomínio, Energia, Água, Internet e telefone, Produtos para revenda, Insumos
      de bancada, Manutenção e reparos, Marketing, Impostos e taxas, Contabilidade, Software e
      assinaturas, Salários e encargos, Pró-labore, Outras despesas.
- [x] Gatilho após inserção em tenants chama a função de semeadura na mesma transação; a função de
      cadastro de usuário não é alterada.
- [x] Backfill: a migração chama a função de semeadura para todos os tenants existentes depois de
      criar o gatilho; rodar a migração ou a função de novo não duplica nada.
- [x] Política de SELECT no formato moderno: administrador do SaaS, ou tenant do usuário igual ao da
      linha com papel de gestão, com as chamadas de contexto de autenticação envolvidas em
      subconsulta.
- [x] Nenhuma política de INSERT, UPDATE nem DELETE; privilégios de escrita direta revogados de
      autenticado e anônimo; anônimo sem privilégio algum. O profissional não lê nada.
- [x] Módulo do Plano de Contas no padrão dos módulos existentes: interface do adaptador com métodos
      em português, repositório que delega ao adaptador, adaptador Supabase e **adaptador em
      memória**. Neste ticket o repositório expõe listar Categorias de Despesa.
- [x] Hook do módulo recebe o tenant e o **repositório injetado** (não o instancia por dentro) e
      devolve a lista e os estados de carregamento e erro. Sem assinatura realtime.
- [x] Rota `/financeiro/cadastros`, rotulada "Plano de contas" na navegação do Hub, fora do layout
      do painel do período. A aba cria o repositório com o adaptador Supabase uma vez por montagem.
- [x] A seção de Categorias de Despesa mostra por padrão as ativas, com filtro para ver as
      arquivadas, que aparecem com indicação visual de arquivada. Lista ordenada alfabeticamente em
      português.
- [x] Tabela no desktop e cartões no celular, no mesmo componente, sem visão móvel separada.
- [x] Arquivo pgTAP novo do Plano de Contas cobrindo: tenant inserido nasce com as catorze
      categorias padrão; a função de semeadura executada de novo não duplica, inclusive depois de uma
      categoria padrão ser renomeada; profissional não lê a tabela; gestor de outro tenant não lê;
      gestor não consegue INSERT, UPDATE nem DELETE direto; anônimo sem privilégio; função de
      semeadura sem execução para papéis de API.
- [x] Teste do adaptador Supabase simulando o cliente Supabase, como os adaptadores existentes.
- [x] Teste da aba com o adaptador em memória listando as categorias ativas e as arquivadas pelo
      filtro.
- [x] Caso novo no teste do Hub: a aba Plano de contas não exibe KPIs nem dispara a busca de
      métricas.
- [x] `CONTEXT.md` ganha os termos Plano de Contas e Categoria de Despesa. Nenhuma ADR é escrita:
      nenhuma decisão desta spec é difícil de reverter, e a ADR 020 da leva pertence à 036.
- [x] `npm run test` e `npm run test:db` verdes.

**Notas de implementação:**

- **Migration:** `supabase/migrations/20260913130000_plano_de_contas_categorias_despesa.sql`
  (única migration deste ticket, dentro da faixa `20260913130000`–`20260913139999`). Cria
  `public.financial_categories`, o gatilho `trg_seed_default_expense_categories` sobre
  `AFTER INSERT ON public.tenants`, a função `private.seed_default_expense_categories(uuid)` e o
  backfill. Testada via MCP (não aplicada no DEV): todas as migrations pendentes >= `20260913000000`
  rodaram em transação com `rollback`, seguidas de 23 asserções booleanas cobrindo semeadura,
  idempotência, RLS por papel e privilégios — todas passaram, e um `SELECT` posterior confirmou que
  nada ficou persistido. O arquivo pgTAP `28_plano_de_contas.test.sql` também rodou completo
  (`plan(50)`) na mesma sessão MCP sem erro, do início (vetores de documento do ticket 05) até o
  fim (as 25 asserções novas deste ticket).
- **Chave estrangeira composta futura:** a unicidade `(tenant_id, id)` foi criada com
  `alter table ... add constraint ... unique (tenant_id, id)` (constraint nomeada
  `financial_categories_tenant_id_key`), não com um índice único solto — Postgres exige uma
  constraint UNIQUE (não basta um índice) como alvo de uma FK composta. O ticket 06
  (`suppliers.default_category_id`) e a spec 036 (`accounts_payable.category_id`) devem referenciar
  `financial_categories (tenant_id, id)` por essa constraint.
- **Nomes que os tickets 04 e 06 consomem:**
  - Módulo: `src/modules/plano-contas/` (já existia por causa do ticket 05: `documento.ts`).
  - Tipos: `CategoriaDespesa`, `NaturezaCategoria`, `IPlanoContasAdapter` em
    `src/modules/plano-contas/types.ts`.
  - Repositório: `PlanoContasRepository` (`src/modules/plano-contas/PlanoContasRepository.ts`),
    com `PlanoContasValidationError` já exportada — o ticket 04 deve acrescentar aqui a
    `PlanoContasConflictError` (o par de erros de domínio que a spec descreve) quando implementar
    criar/renomear.
  - Adaptadores: `SupabasePlanoContasAdapter` e `InMemoryPlanoContasAdapter`, em
    `src/modules/plano-contas/adapters/`. Ambos implementam só `listarCategoriasDespesa(tenantId)`
    por ora.
  - Hook: `usePlanoContas(tenantId, repository)` em `src/modules/plano-contas/usePlanoContas.ts`,
    devolve `{ categoriasDespesa, loading, error, reload }`.
  - Aba/rota: `PlanoContasTab` em `src/pages/gerente/financeiro/PlanoContasTab.tsx`, montada em
    `/financeiro/cadastros` (ver `src/App.tsx`), rótulo "Plano de contas" no `HubLayout.tsx`.
  - **Prop de injeção para teste:** `PlanoContasTab` aceita `repository?: PlanoContasRepository`
    opcional (mesmo padrão de `caixaRepo?`/`comandaRepo?` já usado em `FechamentoCaixaModal`,
    `ComandaCheckoutModal` etc.). Em produção (sem a prop) ela cria o repositório com o adaptador
    Supabase uma vez por montagem, como o ticket pede; os testes passam o adaptador em memória.
    O ticket 06 deve reusar essa mesma prop ao acrescentar o controle segmentado
    Categorias/Fornecedores — a rota `cadastros` continua apontando para este componente, que
    passa a decidir a seção pela query string.
- **Filtro de arquivadas:** implementado como estado local do componente (`showArchived`), não como
  parâmetro de URL — o ticket 03 não pede isso; só o controle segmentado do ticket 06 vai para a
  URL (`?secao=...`), por instrução explícita do ticket 06.
- **Sem controle segmentado nesta entrega:** a aba mostra só a seção "Categorias de Despesa" (sem
  abas internas), porque Fornecedores ainda não existe. O ticket 06 envolve esta seção num
  `SegmentedControl` do kit de UI.
- **Verificação:** `npx tsc -b` limpo; `npm run test` 74 arquivos / 512 testes verdes (inclui os 30
  testes novos do módulo e os 3 da aba, mais o caso novo em `Financeiro.test.tsx`); `npm run lint`
  sem erros (só warnings pré-existentes em arquivos não tocados por este ticket); suíte pgTAP
  `28_plano_de_contas.test.sql` (50/50) via MCP, sem persistir nada no DEV.
