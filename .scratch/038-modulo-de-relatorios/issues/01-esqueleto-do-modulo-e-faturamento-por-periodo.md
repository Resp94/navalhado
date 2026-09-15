# 01: Esqueleto do módulo e Faturamento por período, ponta a ponta

**What to build:** o gestor encontra "Relatórios" no menu do painel, abre o catálogo com os dez
relatórios agrupados por assunto, entra em Faturamento e vê, para o período escolhido, o faturamento
bruto, os descontos, o líquido, a divisão entre serviços e produtos e as gorjetas (fora do
faturamento), agrupados por dia, semana ou mês, com o total do período anterior de mesma duração e a
variação. Hoje não existe nenhuma visão de faturamento por período fora do painel de Caixa e
Comissões, e ela não tem evolução nem comparação.

Este é o tracer bullet da spec: atravessa contrato de leitura, módulo e tela com o relatório mais
simples, e deixa pronta a estrutura que todos os outros tickets só estendem (rotas, layout com filtro
de período, repositório, adaptador, hook, regra compartilhada de Receita Reconhecida de Item).

A receita é lida por uma função privada compartilhada que devolve os itens de Comandas fechadas no
intervalo com a mesma regra de reconhecimento das métricas financeiras existentes (snapshot
confirmado ou estimado pelo snapshot; indisponível pelo preço total; revertido ou sem snapshot vale
zero), mais a qualidade do dado por Comanda. A função de métricas existente não é alterada; um teste
cruzado garante que as duas leituras nunca divergem.

O contrato público valida acesso e parâmetros, resolve o dia de negócio de hoje no fuso do tenant e
delega a um núcleo privado que recebe "hoje" como parâmetro.

Spec: `specs/038-modulo-de-relatorios/spec.md`, seções "Posição no produto", "Leitura: um contrato
por página", "Período", "Regras de domínio compartilhadas" (Receita Reconhecida), "1–3.
`get_revenue_report`", "Índices", "Módulo", "Telas" e "Linguagem e documentação".

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Função privada de Receita Reconhecida de Item recebe tenant e intervalo e devolve, por item de
      Comanda fechada, bruto, líquido, quantidade e comissão reconhecidos, tipo do item, serviço ou
      produto, profissional executor, Comanda, cliente, dia de negócio do fechamento e qualidade do
      dado da Comanda (`confirmed`, `estimated`, `legacy`), com a mesma regra de
      `get_tenant_financial_metrics`.
- [ ] Contrato de leitura do Faturamento recebe tenant, data inicial, data final e granularidade, e
      devolve fuso, dia de negócio de hoje, período, período anterior, qualidade do dado, totais do
      período e do anterior (bruto, descontos, líquido, líquido de serviços, líquido de produtos,
      gorjetas, Comandas fechadas) e agrupamentos com os mesmos campos.
- [ ] Função pública em modo definidor com caminho de busca vazio, sem execução para público e
      anônimo, com concessão a autenticado e serviço; núcleo privado recebe "hoje" como parâmetro.
- [ ] Padrões de banco: retorno em `jsonb`; funções pública e núcleo declarados `STABLE`; função
      privada de Receita Reconhecida em `language sql` e `STABLE`, retornando conjunto, sem concessão
      para autenticado nem anônimo; identidade lida como `(select auth.uid())`; resposta sem nulo
      acidental (lista vazia e objeto vazio por padrão).
- [ ] Cada fonte agregada na própria CTE antes de juntar com as outras (faturamento e, mais adiante,
      recebido no mesmo agrupamento): juntar duas fontes com várias linhas por agrupamento no mesmo
      `group by` multiplica os totais.
- [ ] Recorte de período como intervalo meio aberto sobre a coluna, sem envolver coluna indexada em
      função; conversão para dia de negócio só na projeção; agrupamentos gerados por série de datas,
      para que período sem movimento apareça com zero em vez de sumir.
- [ ] Acesso: barbeiro recusado; gerente pedindo outro tenant recusado; gerente com tenant nulo
      recusado; `proprietario` com o tratamento das RPCs financeiras existentes.
- [ ] Validação com mensagens em pt-BR e código de parâmetro inválido: datas nulas, fim antes do
      início, fim depois de hoje, início antes de hoje − 730 dias, extensão acima de 366 dias,
      granularidade desconhecida e diária acima de 92 dias.
- [ ] Agrupamento: semana começa na segunda-feira, mês civil, primeiro e último agrupamento recortados
      ao período, cada agrupamento com as próprias datas.
- [ ] Período anterior = os N dias imediatamente anteriores ao início, com N igual à extensão do
      período, podendo passar do limite de 730 dias.
- [ ] Comanda aberta e cancelada não contam; item revertido não conta; item indisponível conta pelo
      preço total; gorjeta fica fora do líquido e aparece em gorjetas.
- [ ] Comanda fechada às 23h30 no horário local cai no dia local, e não no dia UTC.
- [ ] Teste cruzado: para o mesmo intervalo, o líquido é igual à receita operacional e a qualidade do
      dado é igual à qualidade histórica de `get_tenant_financial_metrics`.
- [ ] Índice de Comandas por tenant e fechamento, parcial nas fechadas, criado com "se não existir" e
      sem `concurrently` (não funciona dentro da transação da migração); nenhuma função existente
      alterada.
- [ ] Arquivo pgTAP `33_relatorio_faturamento` cobrindo acesso, validação, fuso, reconhecimento,
      período anterior, teste cruzado e as permissões de execução (nada para público e anônimo,
      execução para autenticado e serviço; função privada não executável por autenticado).
- [ ] `explain (analyze, buffers)` do contrato num período de 366 dias registrado nas notas do
      ticket, confirmando uso do índice novo e folga em relação ao limite de 8 segundos do papel
      autenticado.
- [ ] Módulo de relatórios com interface do adaptador, repositório que valida período e granularidade
      com os mesmos limites do banco e rejeita com erro de validação próprio em pt-BR antes da ida à
      rede, adaptador Supabase que converte o retorno em números e tipos do domínio, e hook de
      Faturamento com repositório injetado expondo dados, carregamento, erro e recarga.
- [ ] Funções puras: atalhos de período (este mês como padrão, mês passado, últimos 30 dias, últimos
      90 dias, este ano, personalizado) a partir do dia de hoje do tenant, com granularidade
      sugerida; leitura e escrita do período nos parâmetros da URL; variação percentual (anterior
      zero devolve vazio, nunca infinito).
- [ ] Item "Relatórios" no menu lateral, logo depois de Financeiro. Em largura de celular (até
      768px, o limite que o painel já usa) o item não aparece na barra inferior nem na gaveta "Mais".
- [ ] Módulo exclusivo do desktop: em largura de celular, qualquer rota `/relatorios/*` mostra só o
      aviso "Os relatórios estão disponíveis apenas no computador", com atalho para a Agenda, sem
      chamar nenhum contrato; ao alargar a janela, o conteúdo aparece sem recarregar. A decisão fica
      no layout do módulo, uma vez só, e as páginas não a repetem.
- [ ] Rotas `/relatorios` (catálogo) e `/relatorios/faturamento`; sub-rota desconhecida volta ao
      catálogo; rotas atrás do Gatekeeper de Onboarding; barbeiro não alcança o módulo.
- [ ] Catálogo sem números, com os dez relatórios agrupados por página e uma frase de pergunta em
      cada um; os que ainda não existem aparecem sem link ou marcados como em breve.
- [ ] Layout do módulo com título, navegação entre páginas e filtro de período (atalho, datas,
      granularidade) preservado na URL ao trocar de página.
- [ ] Página Faturamento com cartões de resumo (bruto, descontos, líquido, serviços, produtos,
      gorjetas, Comandas fechadas, variação vs período anterior com as datas no rótulo) e tabela por
      agrupamento; aviso de qualidade do dado quando não for confirmado; estado vazio, carregando e
      erro.
- [ ] Nenhum layout de celular (sem lista de cartões); em desktop estreito a tabela rola na horizontal
      dentro do próprio contêiner, nunca a página.
- [ ] Recarrega ao mudar filtro, ao voltar o foco para a janela e pelo botão "Atualizar", sem
      realtime.
- [ ] `CONTEXT.md` ganha Módulo de Relatórios (exclusivo do desktop) e Receita Reconhecida de Item;
      ADR 022 registra rota própria fora do Hub e exclusiva do desktop, um contrato por página sem persistência e regras compartilhadas em funções
      privadas.
- [ ] Testes de módulo: repositório (validação e mensagens), atalhos incluindo virada de mês, virada
      de ano, "mês passado" em janeiro e instante em que o dia UTC já é outro; período na URL;
      variação percentual; adaptador Supabase. Teste da página com repositório falso (aviso de
      qualidade, estado vazio, troca de atalho), teste de rota para o barbeiro, teste do layout em
      largura de celular (aviso visível e repositório não chamado) e teste da navegação móvel sem o
      item "Relatórios".
- [ ] `npm run test` verde e pgTAP verde via MCP do Supabase (begin + migration + teste + rollback).
