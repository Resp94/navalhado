# Spec 035 — Plano de Contas: Categorias de Despesa e Fornecedores

## Problem Statement

O Hub Financeiro registra bem o dinheiro que entra e o que é devido à equipe, mas não tem nenhuma forma de dizer **para onde vai o resto do dinheiro**. Esta spec abre uma leva de três (035 Plano de Contas, 036 Contas a Pagar, 037 Fluxo de Caixa Projetado), e resolve os dois pré-requisitos sem os quais as outras duas não têm onde se apoiar.

**Não existe classificação de despesa.** Aluguel, energia, compra de produto para revenda e conserto da cadeira são, para o sistema, a mesma coisa: uma sangria com um texto livre digitado na hora. O placeholder do próprio formulário de sangria sugere escrever "Pagamento de Fornecedor". Sem categoria, nenhuma pergunta sobre custo pode ser respondida: quanto a casa gasta com energia, se o marketing cresceu, qual despesa pesa mais no mês. A auditoria de 2026-09-11 registra essa ausência como lacuna de modelo número 2.

**Não existe cadastro de fornecedor.** Quem recebe o dinheiro da barbearia vive em textos soltos: no motivo da sangria, no motivo da entrada de estoque por compra. O mesmo fornecedor é escrito de três jeitos diferentes, e não há como ver tudo que foi pago a ele, nem guardar o documento dele para conferir com a nota.

**O Hub Financeiro não tem onde receber telas novas.** `Financeiro.tsx` tem mais de mil e duzentas linhas, cerca de trinta estados locais e duas abas escritas em linha, trocadas por estado de componente. A aba ativa não aparece na URL: não dá para mandar um link para a aba de comissões, o botão voltar do navegador sai do Hub, e cada aba nova aumentaria o mesmo arquivo. As specs 036 e 037 precisam acrescentar duas abas. No celular, a navegação entre abas nem aparece: só a visão de caixa é alcançável.

## Solution

Criar o **Plano de Contas** do tenant: **Categorias de Despesa** planas e **Fornecedores**, ambos arquivados em vez de apagados, com escrita por RPC e leitura restrita à gestão. Todo tenant novo nasce com um conjunto padrão de Categorias de Despesa, e os tenants existentes recebem o mesmo conjunto por backfill idempotente.

Antes disso, e como primeira entrega, reorganizar o Hub Financeiro em sub-rotas: cada aba vira componente próprio e endereço próprio (`/financeiro/caixa`, `/financeiro/comissoes`), sem mudar o que as abas fazem. Em cima dessa estrutura entra a aba `/financeiro/cadastros`, rotulada **Plano de contas**, com as seções de Categorias de Despesa e de Fornecedores.

A spec entrega o contrato que a 036 consome: uma Conta a Pagar poderá apontar para uma Categoria de Despesa ativa do mesmo tenant, obrigatória, e para um Fornecedor opcional, cuja categoria padrão pré-preenche o formulário.

## User Stories

1. Como gestor, quero abrir o Hub Financeiro direto na aba que me interessa por um link, para que eu volte a ela pelo histórico do navegador ou pelo favorito sem clicar de novo.
2. Como gestor, quero que o botão voltar do navegador me leve à aba anterior do Hub Financeiro, para que a navegação entre abas se comporte como a navegação entre telas.
3. Como gestor, quero que as abas de Caixa e de Comissões continuem funcionando exatamente como hoje depois da reorganização, para que a mudança de estrutura não me custe nenhum hábito.
4. Como gestor, quero que o período selecionado continue o mesmo ao alternar entre Caixa e Comissões, para que eu compare os dois lados do mesmo mês sem refazer o filtro.
5. Como gestor usando o celular, quero enxergar a navegação entre as abas do Hub Financeiro, para que eu alcance o Plano de Contas e as abas que vierem depois sem precisar de um computador.
6. Como gestor, quero que a barbearia já comece com categorias de despesa comuns do setor, para que eu classifique a primeira conta sem ter de montar um plano de contas do zero.
7. Como gestor de uma barbearia que já usa o sistema, quero receber as mesmas categorias padrão que um tenant novo recebe, para que eu não fique em desvantagem por ter chegado antes.
8. Como gestor, quero criar uma Categoria de Despesa com um nome meu, para que a classificação reflita como eu enxergo os custos da casa.
9. Como gestor, quero renomear uma Categoria de Despesa, para que eu corrija um nome sem perder o que já foi classificado nela.
10. Como gestor, quero ser impedido de criar duas categorias com o mesmo nome escrito com maiúsculas diferentes, para que os meus custos não fiquem divididos entre "Energia" e "energia".
11. Como gestor, quero arquivar uma categoria que não uso mais, para que ela saia das opções de lançamento sem apagar o histórico classificado nela.
12. Como gestor, quero ver as categorias arquivadas separadas das ativas e reativar uma delas, para que arquivar nunca seja uma decisão sem volta.
13. Como gestor, quero que o sistema me ofereça reativar a categoria arquivada quando eu tentar criar outra com o mesmo nome, para que eu não recrie o que já existe.
14. Como gestor, quero cadastrar um Fornecedor com nome, telefone, e-mail e observação, para que eu tenha num só lugar os dados de quem recebe pagamentos da barbearia.
15. Como gestor, quero informar o CPF ou o CNPJ do Fornecedor e ser avisado quando o número estiver errado, para que o documento guardado sirva para conferir nota e comprovante.
16. Como gestor, quero cadastrar Fornecedores com o CNPJ alfanumérico da Receita Federal, para que fornecedores abertos depois da mudança de formato não fiquem de fora.
17. Como gestor, quero ser impedido de cadastrar o mesmo CPF ou CNPJ em dois Fornecedores, para que os pagamentos a um mesmo fornecedor não se espalhem em dois cadastros.
18. Como gestor, quero definir uma categoria padrão para o Fornecedor, para que a conta dele já venha classificada quando eu lançá-la.
19. Como gestor, quero buscar Fornecedores por nome ou documento, para que eu encontre o cadastro certo sem rolar a lista inteira.
20. Como gestor, quero arquivar e reativar um Fornecedor, para que um fornecedor com quem parei de trabalhar saia das opções sem apagar o histórico.
21. Como gestor, quero usar o Plano de Contas no celular com a lista em cartões, para que eu cadastre um fornecedor na hora em que ele entrega a mercadoria.
22. Como proprietário, quero que toda criação, alteração e arquivamento no Plano de Contas registre quem fez e quando, para que o cadastro financeiro seja auditável.
23. Como profissional, quero não ter acesso ao Plano de Contas, para que os custos e fornecedores da casa continuem restritos à gestão.

## Implementation Decisions

### Escopo em três entregas sequenciais

1. **Prefactor do Hub Financeiro em sub-rotas** — sem schema, sem regra nova. Entra primeiro porque é pré-requisito da aba desta spec e das abas da 036 e da 037, e porque é a entrega que mais toca código vivo. Tem de estar estável antes de qualquer aba nova.
2. **Schema, RPCs, semeadura e backfill do Plano de Contas**, com o módulo `src/modules/plano-contas/`.
3. **Aba Plano de contas** em `/financeiro/cadastros`.

### Entrega 1 — Hub Financeiro em sub-rotas

**Rotas.** `/financeiro` passa a ser uma rota-pai com layout próprio, e cada aba vira uma rota-filha. `/financeiro` sem sub-rota e qualquer sub-rota desconhecida redirecionam para `/financeiro/caixa` com substituição de histórico, para que o botão voltar não caia num redirecionamento em laço. As rotas continuam sob o `AuthGuard` de gerente e o `GerenteLayout` que já existem.

```
/financeiro                  -> layout do Hub (título, navegação entre abas)
  index, *                   -> redireciona para caixa
  (layout do painel do período: filtro de período + KPIs)
    caixa                    -> aba Caixa diário e turnos
    comissoes                -> aba Repasses de comissões
  cadastros                  -> aba Plano de contas (esta spec)
  contas-a-pagar             -> spec 036
  fluxo-de-caixa             -> spec 037
```

**Navegação entre abas como links, não botões.** A navegação usa links de rota com estado ativo derivado da URL. É o que torna a aba endereçável, faz o botão voltar funcionar e permite abrir uma aba em outra guia. O estado local `activeTab` desaparece.

**O cabeçalho de KPIs não é global: fica num layout intermediário compartilhado só por Caixa e Comissões.** O filtro de período e os cinco KPIs parecem cabeçalho do Hub, mas não são: o mesmo período alimenta a lista de recebimentos por forma de pagamento dentro da aba de Caixa, a tabela de saldos de comissão, o histórico de quitações e o detalhamento de comandas do profissional. É o filtro do painel operacional, não do Hub. Torná-lo global traria três problemas. O Plano de Contas não tem período nenhum. Contas a Pagar (036) filtra por período de vencimento e o Fluxo de Caixa (037) tem período e granularidade próprios, então haveria dois filtros de período concorrentes na mesma tela, com significados diferentes. E o KPI "Lucro líquido livre", que não desconta despesa nenhuma, ficaria exibido ao lado da lista de Contas a Pagar, contradizendo-a. Por fim, a RPC de métricas deixaria de rodar em abas que não usam o resultado.

Por isso existe um layout intermediário, sem segmento de URL, que envolve apenas `caixa` e `comissoes`. Ele guarda o período, busca as métricas e a Sessão de Caixa ativa, e entrega esses dados às duas abas. Como o layout continua montado quando se alterna entre as duas rotas-filhas, trocar de Caixa para Comissões não reinicia o período nem refaz a busca de métricas (história 4). Sair para outra aba do Hub e voltar reinicia o período no padrão "Este mês", como acontece hoje ao sair do Hub.

**Divisão de estado.** A regra é: o que as duas abas do painel consomem sobe para o layout do painel; o que só uma aba consome desce para ela. Sobem o período, as métricas, a Sessão de Caixa ativa e a função de atualização. A Sessão de Caixa ativa sobe porque a aba de Comissões também depende dela: a Quitação de Comissão e o lançamento de vale recebem a sessão aberta. Descem para a aba de Caixa o resumo do turno, os movimentos, o histórico de sessões, o resumo por dia e os modais de abertura, fechamento e extrato. Descem para a aba de Comissões o histórico de quitações, o estado de estorno de quitação e os modais de quitação, vale, detalhes e extrato do profissional. A assinatura realtime continua cobrindo as mesmas quatro tabelas (`comandas`, `comanda_pagamentos`, `cash_sessions`, `cash_movements`) e continua atualizando tudo que a aba visível exibe.

**Contexto do tenant.** As abas continuam lendo o tenant pelo contexto de rota do `GerenteLayout`. Como uma rota-filha lê o contexto do layout mais próximo, os dois layouts novos repassam o contexto do tenant, e o layout do painel o estende com os dados compartilhados em vez de substituí-lo.

**Arquivos.** O conteúdo de `Financeiro.tsx` é distribuído em `src/pages/gerente/financeiro/`: o layout do Hub, o layout do painel e um componente por aba. O tipo `FinancialMetrics`, hoje exportado da página e importado por `MobileCaixaView`, passa a morar num arquivo de tipos da pasta. `Financeiro.css` continua compartilhado.

**Mudanças visíveis permitidas, e só estas:**

- A navegação entre abas fica logo abaixo do título do Hub, acima do filtro de período e dos KPIs. Hoje ela fica abaixo dos KPIs. Se continuasse abaixo de um bloco que só existe em algumas abas, a barra de navegação mudaria de altura a cada troca de aba.
- A navegação entre abas passa a aparecer no celular, com rolagem horizontal. Hoje ela está dentro da visão de desktop, escondida em largura de celular, o que tornaria o Plano de Contas e as abas da 036 e da 037 inalcançáveis no celular. A aba de Caixa continua servindo `MobileCaixaView` no celular. A aba de Comissões, hoje inalcançável no celular, passa a ser exibida com as tabelas roláveis que já tem. Adaptá-la para cartões fica fora desta spec.
- O item "Financeiro" da `GlassSidebar` passa a ficar ativo em qualquer sub-rota de `/financeiro`. Hoje o estado ativo compara o caminho exato, e a sub-rota apagaria o destaque. É o mesmo tratamento que a sidebar já dá a `/profissionais`. A barra inferior do celular já compara por prefixo e não muda.

Nenhuma correção de comportamento das abas existentes entra aqui. O filtro de período em data local do navegador, a prévia da gaveta que ignora repasses e vales e as demais dívidas conhecidas ficam como estão (ver Further Notes). Um prefactor que também corrige defeito deixa de ser verificável por "nada mudou".

### Entrega 2 — Categorias de Despesa

**Tabela única com natureza discriminada.** As Categorias de Despesa ficam numa tabela de categorias financeiras com coluna de natureza. Nesta spec o domínio da coluna aceita apenas `expense`. Quando Contas a Receber existir, a receita entra alargando o domínio da coluna, sem tabela nova e sem migração de dados. A RPC de criação desta spec grava sempre `expense`; a natureza não é parâmetro exposto.

**Planas.** Sem hierarquia, sem grupo de DRE. O AppBarber usa dois níveis (tipo de despesa dentro de categoria), mas a pergunta que o gestor faz nesta leva é "quanto vai sair e para quê", e um nível responde. Agrupamento de DRE pode ser acrescentado depois como coluna anulável, sem mexer nas categorias existentes.

```
financial_categories
  id, tenant_id
  nature        -- 'expense' (único valor aceito nesta spec)
  name          -- 2 a 60 caracteres, espaços aparados e colapsados
  seed_key      -- chave estável da categoria padrão; nulo para as criadas pelo gestor
  archived_at, archived_by
  created_at, created_by, updated_at, updated_by
```

**Nome único por tenant e natureza, sem diferenciar maiúsculas, incluindo as arquivadas.** O nome é normalizado na escrita (espaços das pontas removidos, espaços internos repetidos colapsados) e a unicidade é garantida por índice único sobre o nome em minúsculas. A unicidade vale também contra categorias arquivadas, e esta é uma decisão mais restrita que "única entre ativas". Se o gestor arquiva "Marketing" e depois cria "Marketing" de novo, a unicidade só entre ativas produziria duas categorias homônimas, uma com o histórico antigo e outra com o novo, e todo relatório futuro por categoria sairia partido sem que o gestor percebesse. Com a unicidade total, a tentativa de criar ou renomear para um nome existente é recusada com um erro que identifica a categoria existente e se ela está arquivada, e a tela oferece reativá-la (história 13). Efeito colateral útil: reativar nunca colide, porque não pode existir outra categoria com o mesmo nome.

**Acentos não entram na comparação.** "Agua" e "Água" são nomes distintos. Comparar sem acento exigiria a extensão `unaccent`, que não está instalada no banco, ou uma collation não determinística, que complica busca por padrão. O custo não se paga para um cadastro de dezenas de linhas cujos nomes padrão já nascem acentuados corretamente.

**Arquivamento reversível, nunca exclusão física.** Não há DELETE em Categoria de Despesa: nem política, nem RPC, nem botão. Arquivar é reversível e registra quem arquivou e quando. Uma exclusão física "só quando nunca usada" seria um segundo caminho com regra própria, e a verificação "nunca usada" teria de ser refeita a cada tabela que passar a referenciar categoria (036 agora, receitas depois), com corrida entre a verificação e a referência. Arquivar uma categoria que nunca foi usada não custa nada: ela some das opções igual. Um nome digitado errado se corrige renomeando.

O arquivamento usa um único carimbo (`archived_at` nulo significa ativa), e não o par `is_active` + `deleted_at` que os cadastros da spec 013 usam em serviços. Duas colunas para o mesmo fato podem divergir. Uma não pode.

Arquivar não exige motivo. Motivo obrigatório é regra de lançamento financeiro (vale, estorno, cancelamento). Categoria é cadastro, e a trilha de autor e momento basta.

**O que arquivar significa para quem referencia.** Esse é o contrato que a 036 e as specs seguintes herdam:

- Categoria arquivada **não pode receber referência nova**: nenhuma Conta a Pagar nova, nenhuma categoria padrão nova de Fornecedor.
- Referências existentes **permanecem intactas**. Arquivar nunca altera, cancela ou reclassifica nada que já aponte para a categoria.
- Categoria arquivada é somente leitura: renomear exige reativar antes.

**Renomear altera como o histórico aparece.** A referência é por identificador, então renomear "Energia" para "Energia elétrica" muda o rótulo de tudo que já foi classificado. É o comportamento desejado para correção de nome. Transformar uma categoria em outra coisa pelo nome é responsabilidade do gestor, e o sistema não guarda snapshot de nome.

**Categorias padrão.** Todo tenant tem, desde o nascimento, estas catorze Categorias de Despesa:

| Chave estável | Nome |
|---|---|
| `aluguel_condominio` | Aluguel e condomínio |
| `energia` | Energia |
| `agua` | Água |
| `internet_telefone` | Internet e telefone |
| `produtos_revenda` | Produtos para revenda |
| `insumos_bancada` | Insumos de bancada |
| `manutencao_reparos` | Manutenção e reparos |
| `marketing` | Marketing |
| `impostos_taxas` | Impostos e taxas |
| `contabilidade` | Contabilidade |
| `software_assinaturas` | Software e assinaturas |
| `salarios_encargos` | Salários e encargos |
| `pro_labore` | Pró-labore |
| `outras_despesas` | Outras despesas |

Os nomes seguem a caixa de frase já usada nos rótulos da interface ("Hub financeiro", "Caixa diário e turnos"). As categorias padrão são categorias comuns: o gestor renomeia, arquiva e reativa como qualquer outra. "Salários e encargos" cobre remuneração fixa, como recepcionista contratado. Comissão, vale e gorjeta têm livro próprio (spec 034) e não são classificados aqui.

**Onde a semeadura acontece: gatilho sobre a criação do tenant, não o wizard de onboarding.** O tenant não nasce no wizard da spec 010. Ele nasce dentro de `handle_new_user`, o gatilho de `auth.users` que cria tenant, usuário gerente e assinatura na mesma transação do cadastro. O wizard só atualiza o tenant já existente e insere serviços pelo cliente, sem atomicidade com a criação. Três lugares foram considerados:

- **No wizard:** rejeitado. É código de cliente, não atômico, e um tenant que não conclui o onboarding ficaria sem categorias.
- **Dentro de `handle_new_user`:** rejeitado. É uma função sensível de segurança, com testes que inspecionam o corpo dela, e cobriria apenas um dos caminhos de criação de tenant. Tenants criados por fixture de teste ou por um futuro fluxo administrativo ficariam de fora.
- **Gatilho `AFTER INSERT` em `tenants`:** escolhido. Cobre todo caminho de criação, roda na mesma transação que cria o tenant e segue precedente existente: já há gatilho de tenant em função de `private`. Consequência aceita: uma falha na semeadura aborta a criação do tenant. É a atomicidade desejada, pois não existe tenant sem categorias padrão.

**Uma única função de semeadura, idempotente pela chave estável.** O gatilho e o backfill chamam a mesma função privada, `SECURITY DEFINER` com `search_path` vazio e sem execução concedida a papéis de API. Ela insere as categorias padrão ignorando conflito. A idempotência se apoia na **chave estável**, com índice único parcial por tenant, e não no nome. Se dependesse do nome, um gestor que renomeou "Energia" para "Luz" ganharia de volta uma "Energia" a cada nova execução. A chave também permite acrescentar uma categoria padrão no futuro rodando a mesma função sobre todos os tenants. O conflito é ignorado sem alvo, então cobre tanto a chave quanto o nome: se o gestor já tiver criado uma categoria com o nome de uma padrão nova, a padrão não é inserida e a do gestor prevalece.

**Backfill.** A migração que cria a tabela chama a função de semeadura para todos os tenants existentes, depois de criar o gatilho. Rodar a migração ou a função de novo não duplica nada.

### Entrega 2 — Fornecedores

```
suppliers
  id, tenant_id
  name                  -- 2 a 120 caracteres, normalizado como o nome de categoria
  document              -- CPF ou CNPJ normalizado, opcional
  phone                 -- só dígitos, 10 ou 11, opcional
  email                 -- minúsculo, opcional
  notes                 -- até 500 caracteres, opcional
  default_category_id   -- Categoria de Despesa padrão, opcional
  archived_at, archived_by
  created_at, created_by, updated_at, updated_by
```

**Nome único por tenant, sem diferenciar maiúsculas, incluindo arquivados.** É a mesma regra das categorias, pelo mesmo motivo: fornecedor duplicado divide o histórico de pagamentos. O risco aumenta com o cadastro rápido que a 036 vai oferecer dentro do formulário de Conta a Pagar, onde é fácil criar "Enel" pela segunda vez sem olhar a lista. O custo é pequeno: dois prestadores homônimos precisam de um complemento no nome ("João eletricista"). Um cadastro de fornecedores com regra de unicidade diferente da regra de categorias seria mais uma coisa a aprender sem ganho proporcional.

**Documento: CPF ou CNPJ com validação de dígito, no banco e na tela.** Não existe validação de CPF ou CNPJ no código. `customers.cpf` é texto livre sem nenhuma checagem, e por isso não há o que reusar. A validação nasce aqui em dois lugares, com papéis distintos:

- **No banco**, uma função privada imutável usada em restrição de verificação da coluna. É a autoridade: nenhuma RPC futura, nem escrita administrativa, grava documento inválido.
- **No módulo de frontend**, uma função pura de domínio. Serve só para retorno imediato no formulário.

As duas implementações do mesmo algoritmo são cobertas pelo **mesmo conjunto de vetores de teste** nas duas suítes, e é isso que impede que divirjam.

Regras do documento:

- A entrada aceita máscara. Pontos, barras, hífens e espaços são descartados, e letras são convertidas para maiúsculas. Grava-se sem máscara. A tela formata na exibição.
- Onze caracteres são CPF, somente dígitos, com os dois dígitos verificadores do algoritmo oficial.
- Catorze caracteres são CNPJ, **incluindo o CNPJ alfanumérico** que a Receita Federal emite desde julho de 2026: doze posições de `0-9A-Z` seguidas de dois dígitos verificadores numéricos, calculados com o valor de cada caractere igual ao seu código ASCII menos 48 e os mesmos pesos do CNPJ numérico. Nesse cálculo, um CNPJ só com dígitos se comporta exatamente como o antigo. Validar só o formato numérico recusaria fornecedores reais abertos há dois meses.
- Qualquer outro comprimento é inválido. Sequências de um único caractere repetido são inválidas, embora passem no cálculo.
- O tipo (CPF ou CNPJ) é derivado do comprimento e não é armazenado. Uma coluna de tipo seria um segundo fato capaz de divergir do primeiro.

**Documento único por tenant, incluindo arquivados**, por índice único parcial onde o documento não é nulo. Dois fornecedores sem documento não colidem.

**Telefone e e-mail.** O telefone é gravado só com dígitos e aceito com 10 ou 11 dígitos (fixo ou celular com DDD; números 0800 têm 11), mesma regra do cadastro de tenant. O e-mail é gravado aparado, em minúsculas, e validado pela mesma expressão já usada em `handle_new_user`.

**Categoria padrão.** É opcional. Quando informada, precisa ser Categoria de Despesa **ativa** do **mesmo tenant**. Ao atualizar um fornecedor, uma categoria padrão que foi arquivada depois de definida é aceita se não mudou, para que editar o telefone de um fornecedor não obrigue a trocar a categoria dele. Arquivar a categoria não altera fornecedores. A leitura de fornecedor devolve a categoria padrão com o estado dela, e o contrato para a 036 é: **a categoria padrão só pré-preenche a Conta a Pagar se estiver ativa**.

**Arquivamento.** É idêntico ao das categorias: reversível, sem exclusão física, sem motivo obrigatório, com o registro arquivado em somente leitura e referências existentes intactas.

### Integridade entre tenants por chave composta

As duas tabelas têm unicidade adicional sobre o par tenant e identificador. A referência de fornecedor para categoria padrão é uma chave estrangeira **composta** sobre esse par. Assim, é o próprio schema que impede um fornecedor de apontar para uma categoria de outro tenant, e não apenas a RPC. A 036 deve referenciar categoria e fornecedor da mesma forma. É esse par único que torna isso possível sem gatilho.

### Escrita por RPC, leitura por tabela

**Escrita exclusivamente por RPC** `SECURITY DEFINER`, com `search_path` vazio, seguindo o padrão das RPCs financeiras vigentes. Cada uma resolve o tenant como as RPCs de vale e quitação já fazem (parâmetro opcional de tenant, recusado quando diverge do tenant do usuário e o usuário não é administrador do SaaS; ausente, vale o tenant do usuário autenticado), revalida internamente o papel de gestão, normaliza e valida a entrada e registra autor e momento. A execução é revogada de `public` e `anon` e concedida a `authenticated` e `service_role`. Contrato:

- Categoria de Despesa: criar (nome), renomear (categoria, nome), arquivar (categoria), reativar (categoria).
- Fornecedor: criar (campos), atualizar (fornecedor, campos), arquivar (fornecedor), reativar (fornecedor).

As RPCs de renomear e atualizar recusam registro arquivado. Arquivar o que já está arquivado e reativar o que já está ativo são recusados com mensagem própria, e não ignorados em silêncio, para que a tela nunca mostre sucesso de uma ação que não aconteceu. Criar ou renomear para um nome, ou documento, já existente é recusado com erro de conflito que identifica o registro existente e informa se ele está arquivado. A validação da RPC trata o caso comum com mensagem clara. O índice único é a garantia sob concorrência, e a violação dele também chega à tela como conflito.

Criar e atualizar são RPCs separadas, e não um único upsert, porque as regras de cada uma divergem: a atualização precisa distinguir "categoria padrão não mudou" e recusar registro arquivado.

**Leitura por tabela com RLS**, porque é leitura simples, sem agregação. As duas tabelas são pequenas por tenant (dezenas de categorias, no máximo algumas centenas de fornecedores), e a tela lê a lista inteira e filtra no navegador.

### Acesso

Uma política de SELECT por tabela, no formato moderno: administrador do SaaS, ou tenant do usuário igual ao da linha com papel `gerente` ou `proprietario`, com as chamadas de contexto de autenticação envolvidas em subconsulta. Não há política de INSERT, UPDATE nem DELETE, e os privilégios de escrita direta na tabela são revogados de `authenticated` e `anon`. Com isso, a escrita por RPC é garantia, não convenção. É exatamente a brecha que `cash_movements` tem hoje e que esta spec não repete. `anon` não tem privilégio nenhum. O profissional (`barbeiro`) não lê nada.

### Índices

Todo FK é indexado desde a criação, inclusive as colunas de autoria (`created_by`, `updated_by`, `archived_by`, que referenciam `public.users` com `on delete set null`, como nas tabelas financeiras recentes). O FK de tenant é coberto pelos índices únicos que começam por tenant, e o FK composto de categoria padrão ganha índice próprio com o tenant na frente. As categorias padrão semeadas têm autor nulo, porque foram criadas pelo sistema.

Não há índice parcial por estado de arquivamento. A orientação de índice parcial vale onde o filtro dominante é por estado **e** o volume justifica. Aqui o índice por tenant já reduz a busca a algumas dezenas de linhas, e um índice parcial adicional só custaria escrita.

### Módulo `src/modules/plano-contas/`

Segue o padrão dos módulos existentes: interface do adaptador em `types.ts` com métodos em português, classe de repositório que valida e normaliza a entrada e delega ao adaptador, funções puras de domínio e adaptador Supabase.

**Interface pequena, comportamento atrás dela.** O repositório expõe listar Categorias de Despesa, criar, renomear, arquivar e reativar categoria, listar Fornecedores, criar, atualizar, arquivar e reativar fornecedor. Normalização de nome, validação e formatação de documento, normalização de telefone e tradução dos erros do banco ficam atrás dessa interface. Nenhuma tela e nenhuma spec seguinte reimplementa essas regras.

**Erros de domínio.** Há dois tipos. Um erro de validação carrega mensagem em português. Um erro de conflito carrega o identificador do registro existente e se ele está arquivado. É o conflito que permite à tela oferecer "Reativar" em vez de só "já existe".

**Dois adaptadores: Supabase e em memória.** O adaptador em memória existe para os testes da aba e para o cadastro rápido da 036, que precisam exercitar fluxos inteiros (criar, colidir, reativar) sem simular o cliente Supabase chamada a chamada. Com dois adaptadores, a seam é real. O banco continua sendo a autoridade das regras: o adaptador em memória reproduz o **contrato de erro** (conflito de nome e de documento, recusa de registro arquivado), não a implementação.

**Hook próprio com repositório injetado.** O hook do módulo recebe o tenant e o repositório, devolve as listas, os estados de carregamento e erro e as ações, e refaz a leitura depois de cada escrita bem-sucedida. Aqui o padrão de `clientes` é seguido na forma, não no detalhe: `useClientes` instancia o próprio repositório por dentro, o que obriga a simular o Supabase para testá-lo. O hook do Plano de Contas recebe o repositório de fora. A aba cria o repositório com o adaptador Supabase uma vez por montagem, e os testes passam o adaptador em memória. Não há assinatura realtime: é um cadastro de baixa concorrência, alterado pela própria tela que o exibe.

### Entrega 3 — Aba Plano de contas (`/financeiro/cadastros`)

**Duas seções, Categorias de Despesa e Fornecedores**, alternadas por controle segmentado com a seção refletida na URL como parâmetro de consulta. Assim a 036 pode levar o gestor direto à seção de fornecedores. Com as duas seções empilhadas, as catorze categorias empurrariam os fornecedores para baixo da dobra no celular.

**Cada seção** mostra por padrão os registros ativos, com um filtro para ver os arquivados. A lista é ordenada alfabeticamente em português. Arquivados aparecem com indicação visual de arquivado e ação de reativar. A seção de Fornecedores tem busca por nome e por documento, que aceita o documento com ou sem máscara. Tabela no desktop, cartões no celular, no mesmo componente, sem visão móvel separada.

**Formulários de categoria e de fornecedor são componentes autônomos**, independentes da aba: recebem valores iniciais e o repositório, e devolvem o registro salvo. A aba os compõe dentro do Drawer do kit de UI. A 036 compõe os mesmos formulários dentro do seu cadastro rápido. A variação entre os dois usos fica no contêiner, nunca em props booleanas de modo ("rápido", "compacto") dentro do formulário. O formulário de fornecedor valida e formata o documento enquanto o gestor digita, e oferece como categoria padrão apenas categorias ativas.

**Confirmação de arquivamento.** O `ConfirmSoftDeleteModal` da spec 013 não é reusado. O texto dele é fixo ("excluir", "novos agendamentos") e descreve uma exclusão que, em serviços, some da lista e não tem volta pela interface. Arquivar aqui é reversível e tem outro verbo. A confirmação usa o `ConfirmDialog` do kit de UI, a mesma base do modal da 013, com texto de arquivamento: o registro sai das opções de lançamento, o histórico é preservado e é possível reativar. No caso de categoria, o texto informa que fornecedores que a usam como padrão mantêm o vínculo, mas deixam de tê-la pré-preenchida. Reativar não pede confirmação, porque desfaz a si mesmo.

**Conflito na criação.** Quando o nome ou o documento já existe e o registro existente está arquivado, a tela oferece reativá-lo ali mesmo. Quando está ativo, informa que já existe e aponta qual é.

### Documentação

A implementação atualiza `CONTEXT.md` com os termos Plano de Contas, Categoria de Despesa e Fornecedor, e revê o verbete Hub Financeiro, que hoje descreve duas abas e passa a descrever abas endereçáveis por sub-rota. Esta spec não prevê ADR: nenhuma das decisões aqui é difícil de reverter, e a ADR 020 da leva pertence à 036.

## Testing Decisions

Um bom teste aqui verifica **comportamento externo observável**: o que um papel consegue ler ou gravar, o que uma RPC aceita e recusa, quantas categorias um tenant novo tem, qual aba a URL abre. Nenhum teste afirma sobre estrutura interna de componente, nome de estado ou ordem de chamadas.

**Seam primária do Plano de Contas — pgTAP**, arquivo novo `28_plano_de_contas.test.sql`, com a arte prévia de `26_conta_do_profissional_gorjeta` para acesso por papel. Cobre:

- Tenant inserido nasce com as catorze categorias padrão.
- A função de semeadura executada de novo não duplica, inclusive depois de uma categoria padrão ser renomeada.
- Unicidade de nome sem diferenciar maiúsculas, inclusive contra arquivada, com o conflito identificando o registro existente.
- Normalização de espaços.
- Arquivar e reativar, com recusa de dupla operação e de renomear ou atualizar registro arquivado.
- Vetores de documento: CPF válido, CNPJ numérico válido, CNPJ alfanumérico válido, dígito verificador errado, sequência repetida, comprimento inválido e letra em CPF. A restrição de verificação recusa documento inválido mesmo em escrita direta como superusuário.
- Documento único por tenant.
- Categoria padrão de outro tenant recusada pelo FK composto.
- Categoria padrão arquivada recusada na criação e aceita na atualização quando não mudou.
- Profissional não lê nenhuma das tabelas.
- Gestor de outro tenant não lê.
- Gestor não consegue INSERT, UPDATE nem DELETE direto.
- `anon` sem privilégio nem execução.

**Seam secundária — módulo (vitest).** Testes do repositório com adaptador falso cobrem validação, normalização e tradução de erro de banco em erro de validação ou de conflito. Testes da função pura de documento usam **os mesmos vetores** do pgTAP. Testes do adaptador Supabase simulam `lib/supabase`, como os adaptadores existentes.

**Interface.** A aba Plano de contas é testada com o adaptador em memória, nos fluxos completos: criar, colidir com arquivada e reativar, arquivar com confirmação, buscar fornecedor por documento com e sem máscara. Os formulários não ganham arquivo de teste próprio. A cobertura passa pela aba, que é a seam de cima, e a 036 cobrirá o outro uso pelo cadastro rápido.

**Prefactor — regressão pelos testes que já existem.** O teste `Financeiro.test.tsx` hoje simula `react-router-dom` inteiro e troca de aba clicando em botão. Ele passa a renderizar o Hub dentro de um roteador em memória, com as mesmas asserções de conteúdo: os cinco KPIs, o resumo por dia, a tabela de comissões, o lançamento de vale e o erro de carregamento. A troca de aba vira navegação por link. Casos novos:

- `/financeiro` abre Caixa.
- Sub-rota desconhecida redireciona para Caixa.
- Alternar Caixa e Comissões preserva o período sem nova busca de métricas.
- A aba Plano de contas não exibe KPIs nem dispara a RPC de métricas.

O teste da `GlassSidebar` ganha o caso de item ativo em sub-rota. A prova de que o prefactor não mudou comportamento é essa suíte passar com as asserções de conteúdo intactas.

## Out of Scope

- **Contas a Pagar**, Baixa, Série, vencimento e qualquer uso das categorias em lançamento: spec 036.
- **Categorias de receita e Contas a Receber.** Decisão do usuário: comanda e caixa já cobrem a entrada. A coluna de natureza fica pronta, mas só `expense` é aceito.
- **Hierarquia de categorias, grupos de DRE, DRE e margem.**
- **Marcação de categoria "fora do resultado"**, como a retirada de sócio, que sai do saldo mas não entra na DRE. Pertence à DRE.
- **Exclusão física** de categoria ou fornecedor.
- **Histórico de alterações** de cadastro além de último autor e momento de criação, alteração e arquivamento.
- **Vínculo de Fornecedor com a entrada de estoque por compra** em `Produtos.tsx` (ver Further Notes).
- **Restaurar categorias padrão** a partir da tela.
- **Importação de fornecedores** por planilha e **consulta de CNPJ** em serviço externo para autopreencher razão social.
- **Endereço, dados bancários e chave PIX do fornecedor.**
- **Anexos** em fornecedor.
- **Correção de defeitos das abas existentes** durante o prefactor, e **adaptação da aba de Comissões para cartões** no celular.
- **Comparação de nomes sem acento.**

## Further Notes

**Origem.** Esta spec nasceu da auditoria `docs/reports/auditoria-qualidade-financeiro-dev-2026-09-11.md` (lacuna de modelo 2 e item 4 da sequência recomendada) e do mapeamento de cadastros auxiliares do AppBarber em `docs/scraping_appbarber_financeiro.md` §4.8. Do AppBarber, ficaram de fora o segundo nível de classificação (tipo de despesa dentro de categoria) e as categorias de receita.

**Relação com a entrada de estoque.** Em `Produtos.tsx`, "Compra de fornecedor" não é um campo de fornecedor: é o tipo de movimento `entry_purchase`, e o fornecedor, quando aparece, está no texto livre do motivo (os testes usam "NF 123"). Tornar o Fornecedor referenciável ali exigiria mexer na RPC de ajuste de estoque e decidir se toda compra de estoque gera Conta a Pagar. É uma decisão que só faz sentido depois da 036 estar em uso. Quando for tomada, o vínculo nasce como referência opcional ao Fornecedor na movimentação, pelo mesmo FK composto.

**Armadilha registrada para a DRE futura.** O custo de produto vendido já é apurado nos snapshots de comanda (specs 014 e 032) a partir de `products.cost_price`. Uma Conta a Pagar classificada em "Produtos para revenda" é o **pagamento da compra** desse mesmo estoque. Se uma DRE somar as duas coisas como despesa, o custo da mercadoria entra duas vezes. A categoria padrão existe porque o gestor precisa pagar a compra e projetar essa saída no caixa, não para servir de linha de custo na DRE.

**Sangrias históricas.** Sangrias passadas usadas para pagar fornecedor não são reclassificadas nem ganham fornecedor. A decisão e a justificativa são da 036.

**Divergências entre o brief da leva e o código, encontradas na investigação:**

- O papel `proprietario` não é dono de tenant: é o administrador do SaaS. No banco DEV, o único usuário `proprietario` não tem tenant, `private.is_saas_admin()` é exatamente "papel `proprietario` ativo", o `AuthGuard` manda esse papel para `/admin` e o `GerenteLayout` só admite `gerente`. A política no formato moderno continua correta, mas o ramo "tenant igual e papel `proprietario`" nunca casa. Na prática, o acesso é gerente do tenant ou administrador do SaaS. As histórias que falam de "proprietário" se referem ao dono da barbearia, que no sistema opera como `gerente`. O tratamento do papel `proprietario` segue a regra comum registrada abaixo.
- `useClientes`, citado como padrão de hook, não recebe o repositório: instancia o próprio. O hook desta spec recebe o repositório injetado (ver Módulo).
- Não existe validação de CPF ou CNPJ em lugar nenhum do código.
- A navegação entre abas do Hub está só na visão de desktop. No celular, apenas o caixa é alcançável hoje.
- A `GlassSidebar` compara o caminho exato para marcar item ativo.
- A extensão `unaccent` não está instalada no banco DEV.

**Papel `proprietario` nas superfícies novas (regra comum às specs 035, 036 e 037).** No banco, `private.is_saas_admin()` é verdadeiro para o papel `proprietario`, que é o administrador do SaaS e não pertence a um tenant. As superfícies novas são do `gerente` do próprio tenant, e o `proprietario` recebe exatamente o tratamento que as RPCs financeiras existentes já dão a ele: a leitura por tabela o admite pelo ramo de administrador do SaaS da política moderna, e as RPCs aceitam dele um tenant informado diferente do próprio, que recusam para o `gerente`. O usuário confirmou em 2026-09-12 que o acesso é intencional: o administrador do SaaS precisa operar qualquer tenant para suporte. Mudá-lo depois é uma decisão única para todo o financeiro, não por spec.

**Dívidas conhecidas mantidas pelo prefactor, candidatas a correção fora desta spec:**

- O filtro de período do painel calcula datas no fuso do navegador, não no do tenant.
- A prévia da gaveta na tela (`calculateExpectedDrawerCash`) ignora repasses e vales. A 036 já prevê corrigi-la.
- O KPI "Lucro líquido livre" não desconta despesa. Quando existirem Contas a Pagar, o nome dele passa a sugerir algo que ele não calcula. Renomeá-lo ou recalculá-lo fica para a DRE: a 037 não altera os KPIs do painel.
