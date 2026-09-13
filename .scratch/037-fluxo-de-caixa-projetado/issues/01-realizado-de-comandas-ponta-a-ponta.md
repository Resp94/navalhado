# 01: Realizado de Comandas ponta a ponta

**What to build:** o gestor abre a aba Fluxo de Caixa Projetado no Hub Financeiro e vê, num único
lugar, quanto a barbearia recebeu de Comandas, agrupado por dia, semana ou mês. Hoje o recebido do
dia vive na aba de Caixa, e qualquer visão de período exige somar à mão.

Este é o tracer bullet da spec: atravessa contrato de leitura, módulo e aba com a fonte mais simples
(pagamentos de Comanda), e deixa pronta a estrutura que os tickets seguintes só estendem. Entradas
realizadas são os pagamentos de Comandas fechadas, no dia de negócio do pagamento no fuso do tenant,
com o mesmo predicado de "recebido" do resumo financeiro diário. A tabela viva de pagamentos já está
líquida de estornos: reabrir a Comanda tira a entrada do dia original, e o arquivo de estornos não é
subtraído, senão o estorno contaria duas vezes.

O contrato é uma única leitura que devolve tudo o que a aba mostra, incluindo o fuso e o dia de
negócio de hoje calculados no banco. A tela nunca decide sozinha qual é o dia de hoje. A função
pública valida acesso e parâmetros, resolve "hoje" e delega a um núcleo privado que recebe "hoje"
como parâmetro, para que os testes que dependem do relógio sejam determinísticos. O campo de fluxo
pendente de cada agrupamento já existe aqui (nesta fatia, só realizado com data posterior a hoje) e
é estendido pelos tickets seguintes.

Não há realtime: o contrato agrega várias tabelas e reagir a cada pagamento refaria uma consulta
pesada durante o movimento da recepção. Não há adaptador em memória: o contrato é só de leitura e
um adaptador simulado cobre repositório e hook.

Spec: `specs/037-fluxo-de-caixa-projetado/spec.md`, seções "Fontes do realizado, lidas nos livros de
origem", "Períodos e agrupamento", "Contrato de leitura", "Índices", "Módulo" e "Tela".

**Blocked by:** 035/02 — Hub Financeiro em sub-rotas.

**Status:** ready-for-agent

- [ ] Contrato de leitura do fluxo recebe tenant, data inicial, data final e granularidade, e
      devolve fuso, dia de negócio de hoje, agrupamentos e, em cada agrupamento, entradas
      realizadas, fluxo pendente e detalhamento de entradas por forma de pagamento.
- [ ] Função pública em modo definidor com caminho de busca vazio, sem execução para público e
      anônimo, e com concessão a autenticado e serviço; núcleo privado recebe "hoje" como parâmetro.
- [ ] O fuso é lido do tenant dentro da função, sem parâmetro de fuso vindo do cliente, e os limites
      de dia seguem o padrão do projeto (início do dia inicial até antes do dia seguinte ao final, no
      fuso do tenant).
- [ ] Acesso: barbeiro recebe erro de acesso; gerente pedindo outro tenant é recusado; o
      `proprietario` recebe exatamente o tratamento das RPCs financeiras existentes (aceito para
      qualquer tenant, intencionalmente).
- [ ] Validação com mensagens em pt-BR e código de erro de parâmetro inválido: datas nulas, fim antes
      do início, início depois de hoje, início antes de hoje − 365 dias, fim depois de hoje + 365
      dias, extensão acima de 366 dias, granularidade desconhecida e granularidade diária acima de 92
      dias.
- [ ] Agrupamento: semanas começam na segunda-feira, meses são civis, primeiro e último agrupamento
      são recortados aos limites do período e cada agrupamento devolve as próprias datas de início e
      fim.
- [ ] Cada agrupamento é classificado como passado (termina antes de hoje), atual (contém hoje) ou
      futuro (começa depois de hoje).
- [ ] Entradas realizadas contam pagamentos de Comandas fechadas pelo valor gravado, já líquido de
      troco, no dia de negócio do pagamento.
- [ ] Um pagamento às 23h30 no horário local cai no dia local, e não no dia UTC.
- [ ] Uma Comanda reaberta deixa de contar como entrada, sem subtrair o arquivo de estornos.
- [ ] Teste cruzado: a entrada de um dia é igual ao recebido do resumo financeiro diário no mesmo
      dia, e falha se as duas definições de "recebido" divergirem.
- [ ] Somas feitas sem precisão fixa e arredondadas a duas casas só na saída, sem truncar valores de
      nenhuma origem.
- [ ] Índice de pagamentos de Comanda por tenant e momento do pagamento criado na migração.
- [ ] Nenhuma função existente é alterada.
- [ ] Arquivo pgTAP novo do fluxo de caixa projetado cobrindo acesso, fuso, entradas realizadas,
      teste cruzado, agrupamento e cada limite de validação; casos dependentes de "hoje" usam o
      núcleo com relógio injetado, casos de acesso e de fuso usam a função pública.
- [ ] Módulo do fluxo de caixa com interface do adaptador, repositório que valida período e
      granularidade com os mesmos limites do banco e rejeita com erro de validação próprio em pt-BR
      antes da ida à rede, adaptador Supabase que converte o retorno em números e tipos do domínio, e
      hook que recebe o repositório injetado e expõe dados, carregamento, erro e recarga.
- [ ] Função pura de atalhos de período a partir do dia de hoje do tenant: próximos 30 dias (padrão,
      hoje a hoje + 29, dia), este mês (primeiro ao último dia, dia), próximos 3 meses (hoje a
      hoje + 89, semana), próximos 12 meses (hoje a hoje + 364, mês) e personalizado; mais sugestão de
      granularidade dentro dos limites.
- [ ] Aba em `/financeiro/fluxo-de-caixa`, montada na estrutura de abas do Hub, composta por partes
      de responsabilidade única: filtros (atalho de período, datas, granularidade), resumo com
      cartão de entradas realizadas e tabela com uma linha por agrupamento.
- [ ] Atalhos e datas iniciais usam o dia de hoje no fuso do tenant, nunca a data local do navegador;
      a classificação de agrupamento usa o dia de hoje devolvido pelo contrato.
- [ ] Em largura de celular a tabela vira lista de cartões pela mesma composição responsiva, sem
      visão móvel separada, e a aba é alcançada pela navegação entre abas do Hub.
- [ ] A aba recarrega ao mudar filtro, ao voltar o foco para a janela e pelo botão "Atualizar", sem
      assinatura em tempo real.
- [ ] A aba usa sempre "recebido", nunca "faturamento".
- [ ] O profissional não alcança a aba nem o contrato.
- [ ] `CONTEXT.md` ganha o termo Fluxo de Caixa Projetado.
- [ ] Testes de módulo: repositório com adaptador simulado (validação e mensagens), atalhos de
      período incluindo virada de mês e um instante em que o dia UTC já é outro, e adaptador Supabase
      (conversão de números e de campos ausentes) mockando o cliente Supabase como nos adaptadores
      existentes.
- [ ] `npm run test` e `npm run test:db` verdes.
