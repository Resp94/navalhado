# Especificação: Faturamento diário e detalhamento do caixa

**Status:** ready-for-agent  
**Escopo:** painel financeiro operacional, desktop e mobile  
**Ambientes:** primeiro desenvolvimento; produção somente após validação

## Problem Statement

O painel financeiro já apresenta indicadores consolidados e valores recebidos no turno, mas não permite ao gerente responder rapidamente quanto a barbearia faturou em uma data específica.

Quando uma sessão de caixa permanece aberta por dois ou mais dias, os valores ficam associados ao acumulado da sessão. Isso mistura duas informações diferentes: o faturamento gerado por comandas finalizadas e o dinheiro que efetivamente entrou no caixa por pagamentos. Também não existe uma consulta simples por data para localizar, por exemplo, o faturamento do sábado anterior.

O sistema precisa acrescentar o detalhamento diário sem remover ou alterar o comportamento funcional de abertura, fechamento, gaveta, sangria, suprimento, recebimentos por meio de pagamento ou comissões.

## Solution

Adicionar ao módulo de caixa um resumo financeiro diário que mostre, por data e no fuso horário configurado pelo tenant:

- faturamento realizado em comandas fechadas;
- valor efetivamente recebido por pagamentos;
- distribuição dos recebimentos por dinheiro, PIX, cartão e outros;
- quantidade de comandas fechadas e pagamentos;
- detalhamento separado para cada dia coberto pela consulta ou pela sessão de caixa.

O resumo será apresentado na aba operacional de Caixa, em desktop e mobile, com filtro por data. O faturamento diário será uma informação adicional. Os indicadores e cálculos atuais continuarão disponíveis e com a mesma finalidade.

### Definição de domínio

1. **Faturamento realizado:** soma de `comandas.total_amount` para comandas com status de fechada, agrupada pelo instante de `closed_at` convertido para o fuso do tenant.
2. **Recebido/entrada no caixa:** soma de `comanda_pagamentos.amount`, agrupada pelo instante de `paid_at` convertido para o fuso do tenant.
3. **Dinheiro em gaveta:** cálculo atual com troco inicial, recebimentos em dinheiro, suprimentos e sangrias. Não será substituído pelo faturamento diário.
4. Uma comanda fechada será contada uma única vez no faturamento, mesmo quando possuir pagamentos divididos. Os pagamentos continuarão sendo contados individualmente para a distribuição de recebimentos.
5. A consulta usará o intervalo local `[início do dia, início do dia seguinte)`, evitando erros de limite e de conversão UTC.

## User Stories

1. Como gerente, quero ver o faturamento realizado do dia atual, para saber quanto a barbearia já produziu.
2. Como gerente, quero ver o valor recebido no caixa separadamente do faturamento realizado, para distinguir venda realizada de entrada financeira.
3. Como gerente, quero consultar o faturamento de uma data específica, para verificar dias anteriores sem depender de um relatório acumulado.
4. Como gerente, quero consultar o sábado anterior por meio de um filtro de data, para conferir o movimento daquele dia.
5. Como gerente, quero visualizar o faturamento por dia quando uma sessão de caixa atravessar a meia-noite, para não confundir dias diferentes.
6. Como gerente, quero visualizar também dias sem movimentação dentro do intervalo da sessão, para saber que o valor daquele dia foi zero e não um dado ausente.
7. Como gerente, quero ver os recebimentos diários divididos por método, para conferir PIX, cartões, dinheiro e outros meios.
8. Como gerente, quero saber quantas comandas foram finalizadas em cada dia, para relacionar o valor faturado ao volume de atendimentos e vendas.
9. Como gerente, quero saber quantos pagamentos compõem cada dia, para identificar pagamentos divididos ou múltiplos recebimentos.
10. Como gerente, quero que uma comanda com pagamento dividido não duplique o faturamento, para manter o total correto.
11. Como gerente, quero que um pagamento realizado em data diferente do fechamento da comanda apareça na data do recebimento, sem alterar a data do faturamento realizado.
12. Como gerente, quero que o resumo respeite o fuso horário configurado na minha barbearia, para que a virada do dia siga o relógio local.
13. Como gerente, quero continuar vendo o saldo esperado da gaveta, para conferir o dinheiro físico sem confundi-lo com PIX ou cartão.
14. Como gerente, quero continuar registrando suprimentos e sangrias, para manter a conciliação da gaveta operacional.
15. Como gerente, quero que a atualização do resumo ocorra quando uma comanda for finalizada ou um pagamento for registrado, para acompanhar a operação sem recarregar manualmente.
16. Como gerente, quero usar o mesmo resumo no desktop e no celular, para que os valores sejam consistentes em qualquer dispositivo.
17. Como gerente, quero receber um estado de carregamento, vazio ou erro compreensível, para diferenciar ausência de movimento de falha na consulta.
18. Como usuário autorizado de um tenant, quero consultar somente os dados financeiros daquele tenant, para preservar o isolamento entre barbearias.
19. Como usuário sem permissão financeira, quero que o resumo diário não seja acessível, para impedir exposição de informações financeiras.
20. Como responsável pela manutenção, quero que a funcionalidade seja adicionada sem alterar os indicadores existentes, para reduzir risco de regressão.

## Implementation Decisions

### 1. Estado atual levantado

- A rota financeira já possui KPIs consolidados por período por meio de `get_tenant_financial_metrics`.
- A RPC atual calcula `total_revenue` a partir de comandas fechadas e filtra por `closed_at`.
- A distribuição por forma de pagamento é calculada a partir de `comanda_pagamentos` relacionados às comandas fechadas.
- O `CaixaRepository` já concentra abertura, fechamento, histórico, recebimentos, resumo do turno e movimentações.
- O adapter Supabase já é o ponto de acesso persistente usado pela tela financeira.
- A visão mobile usa o mesmo estado carregado pela tela financeira, mas possui apresentação própria.
- Já existem helpers compartilhados para converter um dia local em intervalo UTC e formatar instantes no fuso do tenant.

### 2. Seam e arquitetura

O seam principal será o `CaixaRepository`, por meio de uma operação de resumo financeiro diário com uma interface pequena e estável. O adapter Supabase será responsável pela consulta persistente e a camada de domínio será responsável por validar parâmetros e normalizar o resultado.

Desktop e mobile serão adaptadores visuais do mesmo contrato. Não será criada uma segunda regra de faturamento para o mobile nem lógica SQL dentro dos componentes de apresentação.

O resultado deverá representar uma coleção de linhas diárias, com valores numéricos normalizados e campos explícitos para faturamento, recebimentos, métodos e contagens. A tela poderá derivar totais de apresentação durante a renderização, sem duplicar esse resultado em estados redundantes.

### 3. Consulta e performance

- A filtragem temporal deverá usar timestamps de início e fim exclusivo, preservando o uso de índices sobre as colunas de data.
- O agrupamento por dia local poderá ocorrer na consulta, desde que a filtragem continue sargable, ou em uma etapa controlada do adapter quando isso produzir um plano melhor.
- A consulta deverá restringir sempre por `tenant_id` e pelo intervalo solicitado.
- O plano de execução será verificado antes de decidir por novos índices.
- Índices candidatos, somente se comprovadamente necessários, são `comandas(tenant_id, closed_at)` e `comanda_pagamentos(tenant_id, paid_at)`. Um índice adicional com `cash_session_id` será considerado apenas se o caso de sessão histórica exigir.
- Índices existentes marcados como não utilizados pelos advisors não serão removidos automaticamente, pois os ambientes ainda possuem volume pequeno e o uso pode surgir com a nova funcionalidade.

### 4. Escopo da consulta

A interface deverá aceitar tenant, intervalo de datas e, opcionalmente, a sessão de caixa selecionada. Para a sessão ativa, o intervalo padrão será a data local de abertura até a data local atual. Para uma consulta livre, o intervalo será definido pelo filtro de data.

Quando houver sessão selecionada, o detalhamento de recebimentos respeitará os pagamentos associados à sessão. O faturamento realizado continuará sendo definido pelo fechamento das comandas no intervalo local consultado, evitando duplicação por pagamento dividido.

A regra para estornos ou reembolsos não será inventada nesta spec, pois o schema atual não possui uma entidade de estorno financeiro. Caso essa necessidade apareça, deverá ser tratada em uma spec própria.

### 5. Interface desktop

- Manter os cinco KPIs consolidados e os filtros de período atuais.
- Acrescentar, na aba Caixa, um destaque de “Faturamento realizado” separado de “Entradas no caixa”.
- Acrescentar filtro de data com estado inicial na data local atual.
- Exibir uma tabela ou lista “Resumo por dia” com faturamento, recebido, métodos e contagens.
- Permitir que a sessão de caixa atravessando dias seja lida por linhas independentes, sem exibir somente um acumulado.
- Manter a tabela de histórico de sessões e o cálculo atual de arrecadação da sessão.

### 6. Interface mobile

- Reutilizar os dados do resumo diário já carregados pelo container financeiro.
- Exibir os valores principais em cards compactos, preservando os cards atuais de gaveta, PIX, cartão e status do caixa.
- Exibir o detalhamento diário em lista vertical com filtro de data acessível por toque.
- Manter ações de abrir, fechar, suprimento e sangria.
- Respeitar os padrões existentes de touch target, safe area, estados de carregamento e design tokens.

### 7. Supabase, segurança e migration

- As tabelas atuais necessárias são `cash_sessions`, `cash_movements`, `comandas`, `comanda_itens`, `comanda_pagamentos` e `tenants`.
- Os dois ambientes possuem essas estruturas, os timestamps necessários e o campo de fuso do tenant.
- As tabelas financeiras relevantes estão protegidas por RLS para usuários autenticados.
- Se for criada uma RPC, ela deverá validar autenticação, papel financeiro e pertencimento ao tenant, definir `search_path` seguro e revogar execução para `PUBLIC` e `anon`.
- Se houver alteração de schema ou criação de RPC/índice, deverá ser criada uma migration numerada seguindo a sequência vigente. A numeração será conferida no momento da implementação.
- A migration, se necessária, será primeiro aplicada em desenvolvimento por MCP, verificada com consulta e somente depois promovida para produção.
- Não haverá alteração de dados existentes, backfill ou criação de tabela de faturamento nesta spec.

### 8. Paridade observada entre ambientes

Na consulta de levantamento, dev e produção apresentaram o mesmo schema relevante e os mesmos índices financeiros principais.

- Dev: uma sessão aberta, 23 comandas, 3 comandas fechadas e 3 pagamentos; o total das comandas fechadas e dos pagamentos consultados coincidiu em R$ 118,00.
- Produção: quatro sessões, duas atravessando dias locais, 50 comandas, 22 comandas fechadas e 22 pagamentos; os totais consultados coincidiram em R$ 1.095,00.
- Não havia movimentações de suprimento ou sangria nos dados consultados.

Esses números são apenas uma fotografia do levantamento e não devem ser codificados como fixtures de produção.

### 9. Advisors conhecidos e impacto nesta spec

Os advisors foram consultados nos dois projetos. Há avisos existentes de funções `SECURITY DEFINER` executáveis por roles autenticadas, tabelas com RLS sem políticas e índices não utilizados. Esses avisos não foram criados por esta funcionalidade e não serão corrigidos incidentalmente durante a implementação.

O novo acesso financeiro deverá, contudo, manter o padrão já exigido de autorização explícita, isolamento por tenant, privilégio mínimo e validação da função privilegiada. Após qualquer migration, os advisors serão consultados novamente para garantir que nenhum novo aviso relevante foi introduzido.

### 10. Carregamento e atualização React

- Consultas independentes poderão ser iniciadas em paralelo para evitar cascatas desnecessárias.
- O resumo diário deverá ser atualizado pelos mesmos eventos Realtime já observados para comandas, pagamentos e sessões, sem criar listeners duplicados.
- O filtro de data deverá controlar a consulta e não gerar estado derivado redundante.
- O contrato do repository deverá ser mockável, permitindo testar a tela sem depender do Supabase.
- Não será adicionada dependência de cache ou biblioteca de fetching sem evidência de que o projeto já a utiliza ou de que ela seja necessária.

## Testing Decisions

Um bom teste deverá verificar o comportamento observável e o contrato do seam do `CaixaRepository`, não detalhes de SQL ou de layout que não sejam relevantes para o usuário.

### Módulos e testes

1. **Domínio e repository:** validar tenant obrigatório, intervalo válido, retorno vazio, normalização numérica e separação entre faturamento e recebimentos.
2. **Adapter Supabase:** validar filtros de tenant, timestamps inclusivos/exclusivos, agrupamento diário, métodos de pagamento e sessão opcional.
3. **Financeiro desktop:** validar os novos cards, filtro por data, linhas diárias e preservação dos indicadores existentes.
4. **Caixa mobile:** validar leitura dos valores diários, filtro, lista vertical e manutenção das ações atuais.
5. **Banco em dev:** executar consultas de verificação antes e depois de finalizar comandas ou registrar pagamentos de teste, sem usar produção para dados de teste.
6. **Segurança:** validar que usuário não autorizado ou tenant diferente não consiga obter o resumo.
7. **Performance:** revisar `EXPLAIN` da consulta em dev e consultar advisors antes e depois de eventual migration.

### Cenários obrigatórios

- Um dia com uma comanda fechada e um pagamento integral.
- Um dia com várias comandas fechadas.
- Uma sessão atravessando dois dias, com uma linha para cada data.
- Um dia sem movimento apresentado como zero.
- Pagamento dividido em PIX e cartão sem duplicar o faturamento da comanda.
- Comanda fechada em um dia e pagamento realizado em outro.
- Virada do dia no fuso `America/Manaus`.
- Virada do dia no fuso `America/Sao_Paulo`.
- Consulta sem resultados.
- Erro de rede ou de RPC com mensagem amigável.
- Realtime após finalização de comanda e após novo pagamento.
- Regressão do saldo da gaveta, suprimento, sangria e fechamento.
- Validação visual desktop e mobile no ambiente de desenvolvimento.

### Prioridade de entrega

1. MVP: faturamento realizado do dia, entradas no caixa do dia e filtro por uma data.
2. Detalhamento por método e contagens.
3. Linhas de todos os dias da sessão, inclusive dias zerados.
4. Otimizações de consulta e índices somente após evidência do plano de execução.

## Out of Scope

- Alterar o cálculo atual de dinheiro em gaveta.
- Substituir os KPIs de período existentes.
- Recriar o módulo completo de relatórios ou DRE.
- Criar tabela histórica ou materializada de faturamento.
- Implementar estorno, reembolso, competência contábil ou emissão fiscal.
- Alterar abertura, fechamento, sangria, suprimento ou quitação de comissões.
- Remover índices apenas porque aparecem como não utilizados nos advisors.
- Corrigir avisos de segurança antigos que não sejam necessários para o novo acesso.
- Criar dados de teste em produção.

## Further Notes

- A feature deverá ser aditiva e compatível com as comandas e pagamentos já persistidos.
- A fotografia atual mostrou que produção contém o cenário de sessão atravessando dias que precisa ser coberto; dev deverá receber dados controlados para reproduzi-lo.
- O total de faturamento realizado e o total recebido podem divergir legitimamente quando fechamento e pagamento ocorrerem em momentos diferentes. Essa diferença deve ser exibida, não escondida por um `max` ou por um acumulado único.
- Toda mudança de banco deverá ser versionada, revisada, aplicada por MCP e validada primeiro em dev.
- O arquivo foi gerado localmente para revisão. Nenhum ticket externo, migration, deploy ou alteração de dados foi criado nesta etapa.
