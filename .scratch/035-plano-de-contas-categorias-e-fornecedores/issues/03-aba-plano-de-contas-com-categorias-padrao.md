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

- [ ] Tabela de categorias financeiras por tenant, com coluna de natureza cujo domínio aceita
      apenas despesa nesta spec (receita entra no futuro alargando o domínio, sem tabela nova).
- [ ] Categoria plana: sem hierarquia e sem grupo de DRE.
- [ ] Nome com 2 a 60 caracteres, gravado com espaços das pontas removidos e espaços internos
      repetidos colapsados.
- [ ] Nome único por tenant e natureza sem diferenciar maiúsculas, **incluindo categorias
      arquivadas**, garantido por índice único sobre o nome em minúsculas. Acentos entram na
      comparação ("Agua" e "Água" são distintos).
- [ ] Chave estável da categoria padrão, nula nas criadas pelo gestor, com índice único parcial por
      tenant.
- [ ] Arquivamento por um único carimbo de momento e autor (nulo significa ativa), sem par de
      colunas ativo/excluído. Colunas de autoria e momento de criação e alteração.
- [ ] Unicidade adicional sobre o par tenant e identificador, para que Fornecedor (ticket 06) e
      Conta a Pagar (spec 036) referenciem categoria por chave estrangeira composta.
- [ ] Colunas de autoria referenciam os usuários com anulação na exclusão, e todo FK é indexado desde
      a criação; o FK de tenant é coberto pelos índices únicos que começam por tenant. Sem índice
      parcial por estado de arquivamento.
- [ ] Função privada de semeadura, com definidor de segurança, caminho de busca vazio e sem execução
      concedida a papéis de API, que insere as catorze categorias padrão ignorando conflito sem
      alvo (cobre chave estável e nome: se o gestor já tem uma categoria com o nome de uma padrão
      nova, a dele prevalece). Categorias semeadas têm autor nulo.
- [ ] As catorze categorias padrão, em caixa de frase e cada uma com a chave estável da tabela da
      spec: Aluguel e condomínio, Energia, Água, Internet e telefone, Produtos para revenda, Insumos
      de bancada, Manutenção e reparos, Marketing, Impostos e taxas, Contabilidade, Software e
      assinaturas, Salários e encargos, Pró-labore, Outras despesas.
- [ ] Gatilho após inserção em tenants chama a função de semeadura na mesma transação; a função de
      cadastro de usuário não é alterada.
- [ ] Backfill: a migração chama a função de semeadura para todos os tenants existentes depois de
      criar o gatilho; rodar a migração ou a função de novo não duplica nada.
- [ ] Política de SELECT no formato moderno: administrador do SaaS, ou tenant do usuário igual ao da
      linha com papel de gestão, com as chamadas de contexto de autenticação envolvidas em
      subconsulta.
- [ ] Nenhuma política de INSERT, UPDATE nem DELETE; privilégios de escrita direta revogados de
      autenticado e anônimo; anônimo sem privilégio algum. O profissional não lê nada.
- [ ] Módulo do Plano de Contas no padrão dos módulos existentes: interface do adaptador com métodos
      em português, repositório que delega ao adaptador, adaptador Supabase e **adaptador em
      memória**. Neste ticket o repositório expõe listar Categorias de Despesa.
- [ ] Hook do módulo recebe o tenant e o **repositório injetado** (não o instancia por dentro) e
      devolve a lista e os estados de carregamento e erro. Sem assinatura realtime.
- [ ] Rota `/financeiro/cadastros`, rotulada "Plano de contas" na navegação do Hub, fora do layout
      do painel do período. A aba cria o repositório com o adaptador Supabase uma vez por montagem.
- [ ] A seção de Categorias de Despesa mostra por padrão as ativas, com filtro para ver as
      arquivadas, que aparecem com indicação visual de arquivada. Lista ordenada alfabeticamente em
      português.
- [ ] Tabela no desktop e cartões no celular, no mesmo componente, sem visão móvel separada.
- [ ] Arquivo pgTAP novo do Plano de Contas cobrindo: tenant inserido nasce com as catorze
      categorias padrão; a função de semeadura executada de novo não duplica, inclusive depois de uma
      categoria padrão ser renomeada; profissional não lê a tabela; gestor de outro tenant não lê;
      gestor não consegue INSERT, UPDATE nem DELETE direto; anônimo sem privilégio; função de
      semeadura sem execução para papéis de API.
- [ ] Teste do adaptador Supabase simulando o cliente Supabase, como os adaptadores existentes.
- [ ] Teste da aba com o adaptador em memória listando as categorias ativas e as arquivadas pelo
      filtro.
- [ ] Caso novo no teste do Hub: a aba Plano de contas não exibe KPIs nem dispara a busca de
      métricas.
- [ ] `CONTEXT.md` ganha os termos Plano de Contas e Categoria de Despesa. Nenhuma ADR é escrita:
      nenhuma decisão desta spec é difícil de reverter, e a ADR 020 da leva pertence à 036.
- [ ] `npm run test` e `npm run test:db` verdes.
