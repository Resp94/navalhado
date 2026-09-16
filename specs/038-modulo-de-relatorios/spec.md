# Spec 038 — Módulo de Relatórios

## Problem Statement

O Navalhado registra tudo que acontece na barbearia (Agendamentos, Comandas, pagamentos, clientes), mas o gestor não consegue **analisar** esses dados. Hoje as telas são operacionais: a Agenda mostra o dia, o Caixa mostra o turno, a Central 360º mostra um cliente por vez. Nenhuma responde às perguntas que o dono faz no fim do mês.

**Não dá para saber quanto a barbearia faturou num período, nem comparar com o anterior.** O painel de Caixa e Comissões mostra alguns totais do período, mas sem evolução no tempo, sem comparação e sem separar o que é serviço e o que é produto de forma legível. Para saber se setembro foi melhor que agosto, o gestor precisa anotar números à mão.

**Não dá para saber quem e o que sustenta a casa.** Não existe ranking de profissionais por faturamento e atendimentos, nem de serviços por quantidade e valor. A decisão de qual serviço promover ou qual profissional precisa de agenda cheia é feita de intuição.

**A agenda perde dinheiro sem ninguém ver.** Cancelamentos e faltas (no-show) ficam registrados em cada Agendamento, mas não há taxa de comparecimento, nem motivo de cancelamento agrupado, nem visão de quais horários ficam vazios. O gestor também não sabe se o agendamento pelo link público e pelo WhatsApp está trazendo cliente que aparece de verdade.

**Os clientes somem e ninguém percebe a tempo.** O Tempo de Retorno de Serviço já existe e já dispara lembrete por WhatsApp, mas o gestor não tem uma lista de quem passou do prazo sem voltar. Também não sabe quantos clientes novos chegaram, quantos voltaram e quantos vieram uma vez só, nem de onde os clientes estão vindo.

## Solution

Criar o **Módulo de Relatórios** (rota `/relatorios`), uma área própria do painel do gestor, separada do Hub Financeiro, com dez relatórios organizados em cinco páginas:

| Página | Relatórios |
|---|---|
| **Faturamento** | 1. Faturamento por período · 2. Recebido por forma de pagamento · 3. Evolução do ticket médio |
| **Equipe e Serviços** | 4. Ranking de profissionais · 5. Ranking de serviços |
| **Agenda** | 6. Comparecimento, cancelamento e no-show · 7. Mapa de calor por dia e horário |
| **Clientes** | 9. Novos x recorrentes · 10. Origem dos clientes |
| **Clientes sem Retorno** | 8. Lista de clientes que passaram do Tempo de Retorno sem voltar |

Todas as páginas com período usam o mesmo filtro (atalhos e datas no fuso da barbearia), mostram a comparação com o período anterior quando faz sentido, avisam quando o dado histórico é estimado ou incompleto e permitem exportar a tabela em CSV. A página inicial `/relatorios` é um catálogo com os dez relatórios agrupados.

## User Stories

### Acesso e navegação

1. Como gestor, quero um item "Relatórios" no menu do painel, para que eu encontre a análise da barbearia sem passar pelo Financeiro.
2. Como gestor, quero uma página inicial com os relatórios agrupados por assunto (Faturamento, Equipe e Serviços, Agenda, Clientes), com uma frase dizendo o que cada um responde, para que eu escolha o relatório pela pergunta que tenho.
3. Como gestor, quero que cada página de relatório tenha endereço próprio, para que eu possa favoritar e voltar pelo botão do navegador.
4. Como gestor, quero que os relatórios sejam feitos para a tela do computador e que, ao abrir um link de relatório no celular, eu veja um aviso de que estão disponíveis só no computador, com atalho para a Agenda, para que eu analise os números com espaço e nunca fique diante de uma tela quebrada.
5. Como profissional (barbeiro), quero não ter acesso aos relatórios, para que a informação financeira e de desempenho da equipe fique restrita à gestão.
6. Como gestor de um tenant que ainda não concluiu o Wizard de Onboarding, quero ser levado ao Wizard ao tentar abrir Relatórios, como acontece com as outras rotas operacionais.

### Filtro de período (comum)

7. Como gestor, quero escolher o período por atalhos (este mês, mês passado, últimos 30 dias, últimos 90 dias, este ano) ou por datas, para que eu chegue rápido às perguntas mais comuns.
8. Como gestor, quero que "hoje", "este mês" e os limites de cada dia sejam os do fuso da barbearia, e não os do meu aparelho, para que o relatório seja o mesmo em qualquer lugar.
9. Como gestor, quero escolher se vejo os números por dia, semana ou mês, para que eu enxergue tendência em períodos longos e detalhe em períodos curtos.
10. Como gestor, quero ser impedido de pedir um período no futuro ou longo demais, com mensagem clara, para que eu não espere por uma consulta que não faz sentido.
11. Como gestor, quero que o período escolhido continue igual ao trocar de página dentro de Relatórios, para que eu compare Faturamento e Agenda do mesmo mês sem refazer o filtro.

### 1. Faturamento por período

12. Como gestor, quero ver o faturamento bruto, os descontos e o faturamento líquido do período, para que eu saiba quanto a barbearia vendeu de fato.
13. Como gestor, quero ver o faturamento separado em serviços e produtos, para que eu saiba quanto vem de cada fonte.
14. Como gestor, quero ver o faturamento agrupado por dia, semana ou mês num gráfico e numa tabela, para que eu veja a evolução dentro do período.
15. Como gestor, quero ver o total do período anterior de mesma duração e a variação percentual, para que eu saiba se estou melhor ou pior.
16. Como gestor, quero que as gorjetas apareçam separadas e fora do faturamento, para que dinheiro que é do profissional não infle a receita da casa.
17. Como gestor, quero que Comandas abertas ou canceladas não contem como faturamento, para que só venda concluída entre no número.
18. Como gestor, quero que um item estornado de uma Comanda reaberta não conte, para que uma correção não deixe resíduo.
19. Como gestor, quero que o faturamento do relatório seja o mesmo que o painel de Caixa e Comissões mostra para o mesmo intervalo, para que duas telas nunca discordem sobre o mesmo número.
20. Como gestor, quero ser avisado quando parte das Comandas do período tem valores estimados ou é anterior ao registro histórico completo, para que eu saiba quanto confiar no número.
21. Como gestor, quero ver quantas Comandas foram fechadas no período, para que eu tenha a referência de volume ao lado do valor.

### 2. Recebido por forma de pagamento

22. Como gestor, quero ver quanto foi recebido em PIX, dinheiro, cartão de crédito, cartão de débito e outros, em valor e em percentual, para que eu confira o que caiu na conta e o que ficou na gaveta.
23. Como gestor, quero ver o recebido por forma de pagamento ao longo do período, para que eu perceba mudanças de hábito dos clientes.
24. Como gestor, quero que o recebido conte pela data do pagamento, e não pela data do serviço, para que o relatório bata com o que entrou no caixa.
25. Como gestor, quero que o recebido de um dia seja o mesmo que o resumo diário do Caixa mostra, para que eu nunca veja dois valores diferentes para o mesmo dia.
26. Como gestor, quero que pagamentos de uma Comanda reaberta deixem de contar, para que um estorno não infle o recebido.
27. Como gestor, quero ver quantos pagamentos houve em cada forma, para que eu saiba o valor médio por forma de pagamento.

### 3. Evolução do ticket médio

28. Como gestor, quero ver o ticket médio (faturamento líquido dividido pelo número de Comandas fechadas) em cada dia, semana ou mês do período, para que eu saiba se cada cliente está gastando mais ou menos.
29. Como gestor, quero ver o ticket médio do período anterior e a variação, para que eu saiba se uma ação de venda funcionou.
30. Como gestor, quero ver o ticket médio de cada profissional no período, para que eu identifique quem vende mais por atendimento.
31. Como gestor, quero que um agrupamento sem Comanda fechada mostre o ticket médio vazio, e não zero, para que um dia fechado não pareça um dia de ticket ruim.

### 4. Ranking de profissionais

32. Como gestor, quero ver os profissionais ordenados pelo faturamento líquido gerado no período, para que eu saiba quem mais produz.
33. Como gestor, quero ver, para cada profissional, o número de atendimentos, a quantidade de serviços executados, o valor em produtos vendidos, o ticket médio e a comissão gerada, para que eu avalie o desempenho por mais de um ângulo.
34. Como gestor, quero reordenar o ranking por qualquer uma dessas colunas, para que eu responda perguntas diferentes com a mesma tabela.
35. Como gestor, quero ver a participação percentual de cada profissional no faturamento total, para que eu entenda a dependência da casa em relação a cada um.
36. Como gestor, quero que um profissional inativo ou arquivado que atendeu no período continue no ranking, marcado como tal, para que o histórico não perca quem já saiu.
37. Como gestor, quero que uma Comanda atendida por dois profissionais conte um atendimento para cada um, com o valor de cada item atribuído a quem o executou, para que ninguém receba crédito pelo trabalho do outro.

### 5. Ranking de serviços

38. Como gestor, quero ver os serviços ordenados por faturamento líquido e por quantidade executada, para que eu saiba o que sustenta a barbearia.
39. Como gestor, quero ver a participação percentual de cada serviço no faturamento de serviços e o valor médio cobrado por execução, para que eu perceba serviços com desconto frequente ou preço defasado.
40. Como gestor, quero filtrar o ranking de serviços por profissional, para que eu veja o mix de cada um.
41. Como gestor, quero que um serviço arquivado que foi executado no período continue no ranking, marcado como tal, para que o histórico fique completo.

### 6. Comparecimento, cancelamento e no-show

42. Como gestor, quero ver quantos Agendamentos do período foram concluídos, cancelados, marcados como falta ou ainda estão sem desfecho, para que eu saiba quanto da agenda virou atendimento.
43. Como gestor, quero ver a taxa de comparecimento (concluídos sobre concluídos mais faltas) e a taxa de cancelamento, para que eu acompanhe a saúde da agenda com um número.
44. Como gestor, quero ver os mesmos números separados por origem do Agendamento (painel, link público, Canal do Cliente, WhatsApp), para que eu saiba se o agendamento online traz cliente que aparece.
45. Como gestor, quero ver os mesmos números por profissional, para que eu identifique quem tem mais falta na agenda.
46. Como gestor, quero ver os motivos de cancelamento agrupados e ordenados por frequência, para que eu entenda por que os clientes desmarcam.
47. Como gestor, quero ver quantos Agendamentos já passaram e continuam "pendente" ou "confirmado", para que eu saiba que a recepção não está fechando o status e que as taxas podem estar distorcidas.
48. Como gestor, quero que Agendamentos futuros dentro do período não entrem nas taxas, para que o que ainda não aconteceu não pareça falta de desfecho.
49. Como gestor, quero ver a comparação das taxas com o período anterior, para que eu saiba se a confirmação por WhatsApp está reduzindo faltas.

### 7. Mapa de calor por dia e horário

50. Como gestor, quero ver uma grade com os dias da semana nas colunas e as horas nas linhas, colorida pela quantidade de Agendamentos, para que eu enxergue picos e horários ociosos de relance.
51. Como gestor, quero que a grade mostre só as horas em que a barbearia funciona em algum dia, para que ela não fique cheia de madrugada vazia.
52. Como gestor, quero filtrar o mapa por profissional, para que eu veja a ocupação de cada um.
53. Como gestor, quero que Agendamentos cancelados não contem no mapa, e que faltas contem, para que o mapa mostre a demanda real por horário.
54. Como gestor, quero ver o número exato de cada célula ao tocar ou passar o mouse, e uma tabela equivalente, para que eu não dependa só da cor.
55. Como gestor, quero que o horário de cada Agendamento seja lido no fuso da barbearia, para que um atendimento às 19h não apareça às 22h.

### 8. Clientes sem Retorno

56. Como gestor, quero ver a lista de clientes cuja última visita passou do Tempo de Retorno do serviço realizado, para que eu saiba quem precisa ser chamado de volta.
57. Como gestor, quero ver, para cada cliente, a data da última visita, o serviço, o prazo de retorno, quantos dias já passaram e quantos dias está atrasado, para que eu priorize quem está sumido há mais tempo.
58. Como gestor, quero que clientes com Agendamento futuro já marcado não apareçam na lista, para que eu não chame quem já vai voltar.
59. Como gestor, quero que uma visita de balcão (Comanda fechada sem Agendamento) conte como visita, para que o cliente que veio sem marcar não apareça como sumido.
60. Como gestor, quero filtrar a lista por faixa de atraso (até 15 dias, 16 a 30, 31 a 60, mais de 60) e por profissional da última visita, para que eu faça ações diferentes para cada grupo.
61. Como gestor, quero abrir a Central 360º do cliente e iniciar uma conversa no WhatsApp direto da lista, para que o relatório vire ação.
62. Como gestor, quero ver o total de clientes sem retorno e o total de clientes ativos (dentro do prazo), para que eu saiba o tamanho do problema.
63. Como gestor, quero que a lista seja paginada, para que uma base grande não trave a tela.
64. Como gestor, quero que clientes sem telefone apareçam na lista com a ação de WhatsApp indisponível, para que eu saiba que preciso completar o cadastro.

### 9. Novos x recorrentes

65. Como gestor, quero ver quantos clientes distintos visitaram a barbearia no período, separados em novos (primeira visita da vida no período) e recorrentes (já tinham visitado antes), para que eu saiba se a base está crescendo ou só girando.
66. Como gestor, quero ver essa divisão ao longo do período, para que eu perceba se a entrada de clientes novos está caindo.
67. Como gestor, quero ver quantos dos clientes novos do período ainda não voltaram (uma visita só até hoje), para que eu meça a conversão da primeira para a segunda visita.
68. Como gestor, quero abrir a lista desses clientes de uma visita só, com a data da visita e o profissional, para que eu faça uma ação de segunda visita.
69. Como gestor, quero ver quantos atendimentos do período não tinham cliente identificado, para que eu saiba quanto da operação fica fora da análise de clientes.
70. Como gestor, quero comparar os números com o período anterior, para que eu acompanhe o efeito de campanhas.

### 10. Origem dos clientes

71. Como gestor, quero ver quantos clientes foram cadastrados no período, separados pela origem do cadastro (balcão, agenda, link público, Canal do Cliente, WhatsApp, importação), para que eu saiba por onde a base entra.
72. Como gestor, quero ver os mesmos clientes separados pelo canal de aquisição declarado (Instagram, indicação, Google e outros), para que eu saiba onde vale investir.
73. Como gestor, quero ver em destaque quantos clientes estão com canal de aquisição "não informado" e o percentual preenchido, para que eu saiba se a informação é confiável e cobre a recepção para preencher.
74. Como gestor, quero ver, para cada origem e canal, quantos desses clientes já tiveram ao menos uma visita, para que eu saiba qual canal traz cliente que aparece e não só cadastro.
75. Como gestor, quero que variações de escrita do mesmo canal ("instagram", "Instagram ") sejam agrupadas, para que o mesmo canal não apareça duas vezes.

### Qualidade, exportação e estados vazios (comum)

76. Como gestor, quero exportar a tabela de qualquer relatório em CSV, para que eu abra no Excel ou mande ao contador.
77. Como gestor, quero que o CSV use o formato brasileiro (ponto e vírgula, vírgula decimal, datas dd/mm/aaaa), para que ele abra certo no Excel em português.
78. Como gestor de uma barbearia nova, quero ver uma mensagem explicando que ainda não há dados no período, em vez de gráficos zerados, para que eu não confunda falta de dado com resultado ruim.
79. Como gestor, quero um botão "Atualizar" em cada página, para que eu veja um fechamento de Comanda recém-feito sem recarregar o navegador.
80. Como gestor, quero que números monetários apareçam em reais com duas casas e percentuais com uma casa, para que a leitura seja consistente em todo o módulo.
81. Como gestor, quero que gráficos tenham uma tabela equivalente e rótulos em texto, para que nenhuma informação dependa só de cor.

## Implementation Decisions

### Posição no produto

- **Rota própria, fora do Hub Financeiro.** O glossário já reserva para "a futura rota de relatórios" os relatórios analíticos que o Hub Financeiro não deve ter. O Hub continua operacional (Caixa, Comissões, Plano de Contas, Contas a Pagar, Fluxo de Caixa Projetado). Relatórios é análise do passado.
- **Rotas:** `/relatorios` (catálogo), `/relatorios/faturamento`, `/relatorios/equipe-e-servicos`, `/relatorios/agenda`, `/relatorios/clientes`, `/relatorios/clientes-sem-retorno`. Sub-rota desconhecida redireciona para o catálogo.
- **Navegação:** novo item "Relatórios" no menu lateral do gestor, logo depois de Financeiro. As rotas ficam atrás do Gatekeeper de Onboarding como as demais rotas operacionais.
- **Exclusivo do desktop.** O módulo é feito só para a largura de computador, acima do limite de celular que o painel já usa (768px). Em largura de celular:
  - o item "Relatórios" **não aparece** na barra inferior nem na gaveta "Mais";
  - qualquer rota `/relatorios/*` aberta direto (link favoritado ou compartilhado) mostra só o aviso "Os relatórios estão disponíveis apenas no computador", com atalho para a Agenda, **sem chamar nenhum contrato**;
  - ao alargar a janela acima do limite, a página do relatório aparece normalmente, sem recarregar.
  - Tablet em paisagem acima de 768px é tratado como desktop.
- **Por que só desktop.** Relatório é análise, não operação de recepção: tabelas com muitas colunas, rankings reordenáveis, mapa de calor de sete colunas e exportação CSV não cabem numa tela de celular sem virar outra interface. Manter uma versão compacta dobraria o custo de tela e de teste de cada relatório. O que o gestor precisa consultar no celular já está nas telas operacionais (Agenda, Caixa).
- **Catálogo sem números.** A página inicial lista os dez relatórios agrupados por página, cada um com uma frase de pergunta ("Quanto faturei e como foi em relação ao mês anterior?"). Ela não chama nenhum contrato. Cards de resumo com números ficam fora de escopo (ver Out of Scope).

### Leitura: um contrato por página

Cinco RPCs de leitura, uma por página, cada uma devolvendo numa chamada tudo que a página mostra, como o Fluxo de Caixa Projetado já faz:

| RPC | Página | Relatórios |
|---|---|---|
| `get_revenue_report(p_tenant_id, p_start_date, p_end_date, p_granularity)` | Faturamento | 1, 2, 3 |
| `get_team_services_report(p_tenant_id, p_start_date, p_end_date, p_professional_id)` | Equipe e Serviços | 4, 5 |
| `get_schedule_report(p_tenant_id, p_start_date, p_end_date, p_professional_id)` | Agenda | 6, 7 |
| `get_customer_report(p_tenant_id, p_start_date, p_end_date, p_granularity)` | Clientes | 9, 10 |
| `get_customers_without_return(p_tenant_id, p_overdue_band, p_professional_id, p_limit, p_offset)` | Clientes sem Retorno | 8 |

**Por que por página e não uma por relatório nem uma genérica.** Uma RPC por relatório faria cada página esperar duas ou três idas à rede com o mesmo filtro. Um contrato genérico (dimensão, métrica e filtros livres vindos do cliente) abriria espaço para contornar o isolamento por tenant e espalharia regra de negócio pelo navegador. Por página, cada contrato tem uma interface pequena e esconde toda a regra de cálculo.

Todas seguem o padrão financeiro do projeto: `SECURITY DEFINER`, `search_path = ''`, revoke de `public` e `anon`, grant a `authenticated` e `service_role`, mensagens em pt-BR, `errcode 42501` para acesso e `22023` para validação.

### Padrões de banco

Levantados contra as práticas do Supabase e o estado atual do projeto dev:

- **Formato de retorno:** `jsonb` nos cinco contratos, como `get_projected_cash_flow` e `get_cash_session_statement` (e não `json`, como as funções mais antigas). O contrato paginado devolve `total_count` junto com os totais, e não repetido por linha como em `list_payables` (o porquê está na seção 8).
- **Volatilidade:** as funções públicas e os núcleos privados são **`STABLE`**. Só leem e, com `STABLE`, o planejador pode reaproveitar o resultado dentro da mesma consulta. As RPCs financeiras existentes são voláteis por omissão; esta spec não as altera, mas as novas nascem corretas.
- **Funções privadas compartilhadas** (Receita Reconhecida de Item e Visita) em `language sql`, `STABLE`, retornando conjunto, para que o planejador possa embutir a consulta e empurrar os filtros de tenant e data para dentro. Em `plpgsql` a consulta viraria uma caixa preta, e os filtros seriam aplicados só depois de materializar tudo. Elas vivem no schema `private`, sem `grant` para `authenticated` nem `anon`: só as funções definidoras as chamam.
- **Identidade do usuário:** lida como `(select auth.uid())`, o padrão já usado nas RPCs financeiras, e nunca a partir de `user_metadata`.
- **Agregações múltiplas por agrupamento:** cada fonte é agregada na **própria CTE** antes de juntar com as outras. Juntar duas fontes com várias linhas por agrupamento num mesmo `group by` gera produto cartesiano e multiplica os totais. É a armadilha já registrada na 037, e aqui ela aparece em vários lugares: faturamento e recebido no mesmo agrupamento, itens de serviço e de produto por profissional, agendamentos e motivos de cancelamento.
- **Filtros que usam índice:** o recorte de período é sempre um intervalo meio aberto sobre a coluna (`>= início` e `< dia seguinte ao fim`, convertidos no fuso do tenant). A coluna indexada nunca é envolvida em função (nada de `date(closed_at)` ou `date_trunc` no filtro); a conversão para dia de negócio acontece só na projeção, ao montar os agrupamentos.
- **Agrupamentos** gerados por `generate_series` sobre datas no fuso do tenant, e não deduzidos das linhas encontradas, para que período sem movimento apareça com zero em vez de sumir da tabela.
- **Respostas sem nulo acidental:** `jsonb_build_object` e `jsonb_agg` com `coalesce` para lista vazia (`'[]'::jsonb`) e objeto vazio (`'{}'::jsonb`). Nulo só onde ele significa "vazio de propósito" (ticket médio e taxas sem denominador).
- **Tempo limite:** o papel `authenticated` tem limite de 8 segundos por consulta neste projeto. É por isso que o período é limitado a 366 dias, a granularidade diária a 92 dias e a lista de Clientes sem Retorno é paginada com teto de 100 linhas.
- **Migrações:** índices criados com `create index if not exists`, sem `concurrently` (não funciona dentro da transação da migração). Cada contrato novo é verificado com `explain (analyze, buffers)` antes de fechar o ticket, para confirmar que os índices novos são realmente usados.
- **Lint esperado:** cada RPC nova soma uma ocorrência do alerta `authenticated_security_definer_function_executable` do advisor de segurança (hoje com 73 ocorrências). É consequência da arquitetura de RPC do projeto e aceito, desde que a função valide o usuário e o papel e **nunca** receba `grant` para `anon`. O `pgTAP` de cada contrato verifica essas permissões.
- **Sem tabelas, views ou colunas novas.** Não há mudança de RLS nesta spec; as leituras acontecem dentro de funções definidoras que fazem o próprio controle de acesso.

**Acesso.** Leitura do `gerente` do próprio tenant. Para o `gerente`, a função recusa um `p_tenant_id` diferente do tenant do usuário **e recusa gerente com tenant nulo** (o mesmo bloqueio do teste pgTAP 32). O `proprietario` recebe o tratamento das RPCs financeiras existentes, aceito como intencional (acesso de suporte do administrador do SaaS). O `barbeiro` recebe erro de acesso.

**Relógio injetável.** Cada função pública valida acesso e parâmetros, resolve o dia de negócio de hoje a partir de `tenants.timezone` e delega a um núcleo em `private` que recebe "hoje" como parâmetro. A resposta devolve `timezone` e `business_today`, e a tela nunca decide sozinha qual é o dia de hoje.

**Sem realtime e sem persistência.** Nenhum relatório é gravado nem pré-calculado. A página recarrega ao mudar filtro, ao voltar o foco para a janela e pelo botão "Atualizar". Tabelas de agregação diária (rollup) ficam para quando o volume justificar (ver Further Notes).

### Período (comum às páginas 1, 4, 6 e 9)

- **Fim:** no máximo hoje. Relatório é sobre o que já aconteceu.
- **Início:** no mínimo hoje − 730 dias, para permitir comparar este ano com o anterior.
- **Extensão máxima:** 366 dias.
- **Granularidade** (onde existe): `day`, `week` ou `month`. Diária só até 92 dias. Semana começa na segunda-feira; mês é civil; primeiro e último agrupamento são recortados aos limites do período.
- **Limites de dia** no fuso do tenant, pelo padrão do projeto: `>= p_start::timestamp at time zone tz` e `< (p_end + 1)::timestamp at time zone tz`.
- **Período anterior de comparação:** os N dias imediatamente anteriores ao início, com N igual à extensão do período. Uma regra só, sem ambiguidade de tamanho de mês. A resposta devolve as datas do período anterior e a tela as mostra no rótulo ("vs 17/08 a 31/08"). O período anterior pode ultrapassar o limite de 730 dias.

**Atalhos da tela** (calculados com o dia de hoje no fuso do tenant):

| Atalho | Datas | Granularidade sugerida |
|---|---|---|
| Este mês (padrão) | 1º dia do mês a hoje | dia |
| Mês passado | mês civil anterior inteiro | dia |
| Últimos 30 dias | hoje − 29 a hoje | dia |
| Últimos 90 dias | hoje − 89 a hoje | semana |
| Este ano | 1º de janeiro a hoje | mês |
| Personalizado | escolhidas pelo gestor | escolhida dentro dos limites |

O período escolhido fica na URL (parâmetros de busca) e é preservado ao navegar entre as páginas do módulo, o que resolve favoritar e compartilhar ao mesmo tempo. Diferente do saldo informado do Fluxo de Caixa, período não é dado sensível.

### Regras de domínio compartilhadas

Duas definições são usadas por mais de um contrato e ficam, cada uma, numa função `private` de conjunto (set-returning), consumida pelos núcleos. Diferente da dívida aceita na 037, aqui a mesma regra seria copiada em três ou quatro contratos, e a extração tem uma interface realmente profunda: tenant e intervalo entram, linhas já reconhecidas saem.

**Receita Reconhecida de Item** (`private.report_recognized_items`). Itens de Comandas `fechada` cujo `closed_at` cai no intervalo, com a mesma regra de reconhecimento de `get_tenant_financial_metrics`:

| `snapshot_status` do item | Bruto | Líquido | Quantidade | Comissão |
|---|---|---|---|---|
| `confirmed` ou `estimated` | `snapshot_gross_amount` | `snapshot_net_amount` | `snapshot_quantity` (ou `quantity`) | `snapshot_commission_amount` |
| `unavailable` | `total_price` | `total_price` | `quantity` | 0 |
| `reverted` ou nulo | 0 | 0 | 0 | 0 |

Cada linha devolve também tipo do item, serviço ou produto, profissional executor, Comanda, cliente, dia de negócio do fechamento e a qualidade do dado por Comanda (`confirmed`, `estimated`, `legacy`) com a mesma classificação de `get_tenant_financial_metrics`. **`get_tenant_financial_metrics` não é alterada** nesta spec; a igualdade das duas leituras é garantida por teste cruzado.

- **Faturamento bruto** = soma do bruto reconhecido. **Líquido** = soma do líquido reconhecido. **Descontos** = bruto − líquido.
- **Gorjeta** (`comandas.tip_amount`) é mostrada à parte e **nunca** entra em faturamento.
- A página diz sempre "faturamento" para o relatório 1 (base `closed_at`) e "recebido" para o relatório 2 (base `paid_at`), a mesma distinção já fixada no glossário do Fluxo de Caixa Projetado.

**Visita** (`private.report_customer_visits`). Um cliente identificado esteve na barbearia num dia de negócio. É **Visita** o dia em que houve, para o cliente, ao menos um destes fatos:

- Agendamento com status `completed` (dia de negócio de `start_time`);
- Comanda `fechada` com `customer_id` preenchido (dia de negócio de `closed_at`).

Os dois fatos no mesmo dia são uma Visita só. Cada Visita devolve os serviços realizados (dos itens de serviço da Comanda, ou do serviço do Agendamento quando não houver Comanda) e o profissional (do Agendamento, ou do item de serviço de maior valor da Comanda). Atendimento sem cliente identificado não é Visita e é contado à parte.

**Por que os dois fatos e não só um.** Só Agendamento concluído ignoraria o cliente de balcão, que apareceria como sumido. Só Comanda fechada ignoraria o Agendamento concluído cuja Comanda ainda não foi fechada ou foi cancelada por engano. A união é a leitura mais fiel de "o cliente veio".

### 1–3. `get_revenue_report`

```
timezone, business_today, period{start,end}, previous_period{start,end}
data_quality { status, confirmed_comandas, estimated_comandas, legacy_comandas }
totals          { gross, discounts, net, services_net, products_net, tips,
                  closed_comandas, average_ticket, received_total }
previous_totals { mesmos campos }
buckets[]       { start_date, end_date,
                  gross, discounts, net, services_net, products_net, tips,
                  closed_comandas, average_ticket,
                  received_by_method { pix, cash, credit_card, debit_card, other },
                  payments_count_by_method {…} }
received_by_method[]      { method, amount, payments_count, share }
ticket_by_professional[]  { professional_id, name, is_active, archived, net, comandas, average_ticket }
```

- **Ticket médio** = líquido ÷ Comandas fechadas com ao menos um item reconhecido. Agrupamento sem Comanda devolve `null`, nunca zero.
- **Ticket por profissional** = líquido dos itens do profissional ÷ Comandas distintas em que ele tem item. A soma das Comandas por profissional pode passar do total de Comandas (Comanda dividida), e a tela avisa isso.
- **Recebido** = `comanda_pagamentos.amount` de Comandas `fechada`, pelo dia de negócio de `paid_at`, sem subtrair `comanda_payment_reversals` (a tabela viva já está líquida, mesma decisão da 037). Formas: `pix`, `cash`, `credit_card`, `debit_card`, `other`, com rótulos PIX, Dinheiro, Crédito, Débito, Outros.
- **`data_quality.status`**: `confirmed`, `estimated`, `legacy`, `mixed` ou `unavailable`, pela mesma regra de `get_tenant_financial_metrics`. A tela mostra aviso sempre que não for `confirmed`.

### 4–5. `get_team_services_report`

```
timezone, business_today, period, data_quality
professionals[] { professional_id, name, is_active, archived,
                  net, gross, share, attendances, services_quantity,
                  products_net, average_ticket, commission }
services[]      { service_id, name, category, archived,
                  quantity, net, share, average_unit_net }
totals          { net, services_net, attendances }
```

- **Atendimentos** de um profissional = Comandas distintas em que ele tem **item de serviço** reconhecido. Venda só de produto não é atendimento.
- **Comissão gerada** = soma da comissão reconhecida dos itens (snapshot). Não é comissão paga; a tela usa "comissão gerada".
- Entram **todos** os profissionais e serviços com item reconhecido no período, inclusive inativos e arquivados (`deleted_at`), marcados. Diferente de `get_tenant_financial_metrics`, que lista só profissionais ativos: um ranking histórico não pode perder quem saiu.
- Nome do serviço e do profissional é o **atual** do cadastro. O item não guarda nome no snapshot; renomear um serviço renomeia o histórico. Aceito.
- `p_professional_id` (opcional) filtra só a lista de serviços. O ranking de profissionais sempre mostra todos.
- Ordenação e reordenação por coluna são feitas na tela sobre os dados já carregados.

### 6–7. `get_schedule_report`

```
timezone, business_today, period, previous_period
status_totals  { total, completed, no_show, canceled, unresolved, future,
                 attendance_rate, cancellation_rate }
previous_status_totals { … }
by_origin[]       { origin, total, completed, no_show, canceled, unresolved, attendance_rate }
by_professional[] { professional_id, name, is_active, archived, total, completed, no_show, canceled, unresolved, attendance_rate }
cancellation_reasons[] { reason, count }
heatmap { hours[] , cells[] { weekday, hour, count } }
```

- Base: Agendamentos cujo `start_time` cai no período. Não há corte por dia de funcionamento; o que foi agendado conta.
- **Classificação:** `completed`; `no_show`; `canceled`; **Agendamento sem Desfecho** = `pending`, `confirmed` ou `in_progress` com `start_time` já passado; **futuro** = qualquer status não cancelado com `start_time` depois de agora (possível quando o período termina hoje).
- **Taxa de comparecimento** = concluídos ÷ (concluídos + faltas). **Taxa de cancelamento** = cancelados ÷ (total − futuros). Denominador zero devolve `null`.
- Sem Desfecho fica fora das duas taxas e aparece em destaque com o aviso de que a recepção precisa atualizar o status.
- **Origem:** `manual` (Painel), `online` (Link público), `client_channel` (Canal do Cliente), `whatsapp` (WhatsApp).
- **Motivos de cancelamento:** `cancellation_reason` normalizado (sem espaços nas pontas, sem diferença de maiúsculas), vazio agrupado como "Sem motivo informado", ordenados por frequência, limitados aos 10 primeiros mais "Outros".
- **Mapa de calor:** conta Agendamentos não cancelados (faltas contam) por dia da semana e hora de `start_time` no fuso do tenant. `hours` vai da menor hora de abertura à maior hora de fechamento entre os dias ativos de `tenants.business_hours`, ampliado para incluir qualquer hora que tenha Agendamento. `p_professional_id` filtra o mapa e os totais por profissional, não a lista `by_professional`.
- **Não é taxa de ocupação.** O mapa mostra demanda (contagem), não percentual da agenda ocupada. Ocupação real depende de escala, bloqueios e almoço e fica fora de escopo.

### 8. `get_customers_without_return`

Sem período: é uma fotografia de hoje.

```
timezone, business_today
totals { without_return, within_return, no_visit_ever }
bands  { up_to_15, d16_30, d31_60, over_60 }
items[] { customer_id, name, phone, has_phone, last_visit_date, last_service_name,
          last_professional_name, return_period_days, days_since, days_overdue }
total_count
```

**Em `jsonb`, e não em linhas como `list_payables`.** A leitura paginada de Contas a Pagar repete `total_count` em cada linha, o que funciona lá porque não há mais nada além do total. Aqui a página mostra totais e faixas que precisam aparecer **mesmo quando a página vem vazia** (o gestor filtrou "mais de 60 dias" e não há ninguém, mas ainda quer ver quantos clientes estão em dia). Em `returns table`, zero linha levaria zero total junto. Com `jsonb`, totais e faixas vivem fora da lista e sempre chegam, e a lista, limitada a 100 linhas, mantém a resposta pequena. `total_count` é calculado sobre o conjunto filtrado, antes da paginação.

- Para cada cliente com ao menos uma Visita, a **última Visita** define o prazo.
- **Prazo de retorno** = o menor `return_period_days` entre os serviços da última Visita; sem serviço identificável ou sem prazo configurado, 20 dias, o mesmo padrão de `get_pending_return_reminders`.
- **Cliente sem Retorno** = dias desde a última Visita > prazo, e **nenhum Agendamento** `pending` ou `confirmed` com `start_time` depois de agora.
- `days_overdue` = dias desde a última Visita − prazo. Faixas: até 15, 16–30, 31–60, mais de 60.
- Ordenação padrão: mais atrasado primeiro. Paginação por `p_limit` (máximo 100) e `p_offset`. Totais e faixas ignoram paginação e filtros de faixa, mas respeitam o filtro de profissional.
- Ações por linha na tela: abrir a Central 360º do cliente e abrir o WhatsApp com `formatWhatsAppUrl` (sem texto pré-preenchido nesta spec).
- **O relatório não dispara mensagem.** A régua de lembrete de retorno continua sendo a do WhatsApp.

### 9–10. `get_customer_report`

```
timezone, business_today, period, previous_period
visitors  { unique_customers, new_customers, returning_customers,
            new_single_visit, unidentified_attendances }
previous_visitors { … }
buckets[] { start_date, end_date, new_customers, returning_customers }
single_visit_customers[] { customer_id, name, phone, visit_date, professional_name }
registrations { total, provisional,
                by_registration_origin[] { origin, total, with_visit },
                by_acquisition_channel[] { channel, total, with_visit },
                acquisition_channel_filled_share }
```

- **Cliente Novo** no período = cliente cuja primeira Visita da vida cai no período. **Cliente Recorrente** = teve Visita no período e já tinha Visita antes do início. Um cliente é contado uma vez no período, e numa só das duas categorias.
- Nos agrupamentos, o Cliente Novo conta no agrupamento da primeira Visita. O Recorrente conta no agrupamento da primeira Visita dele dentro do período.
- **Cliente de Uma Visita** = Cliente Novo do período cuja única Visita, até hoje, é a do período. A lista vem limitada a 200 linhas, mais recentes primeiro.
- **Atendimentos sem cliente identificado** = Comandas `fechada` sem `customer_id` no período.
- **Origem do cadastro** (automática, sempre preenchida) e **canal de aquisição** (declarado, opcional) aparecem **separados**, porque respondem perguntas diferentes: por qual porta o cadastro entrou e como a pessoa conheceu a barbearia.
- Base de cadastros: clientes com `created_at` no período. `registration_origin`: `balcao`, `agenda`, `online`, `canal_cliente`, `whatsapp_bot`, `importacao`.
- `acquisition_channel` é texto livre: agrupado por texto normalizado (sem espaços nas pontas, sem diferença de maiúsculas), exibido com a grafia mais frequente. Nulo ou vazio vira "Não informado", sempre mostrado, com o percentual preenchido.
- `with_visit` = clientes do grupo que já tiveram ao menos uma Visita até hoje.
- `provisional` = quantos dos cadastrados estão com `cadastro_completo = false`.

### Índices

Conferido contra os índices existentes no banco dev. A migração cria, se ausentes:

- `comandas (tenant_id, closed_at)` parcial com `status = 'fechada'` — hoje só existe `(tenant_id, status)`, que não ajuda no recorte por data;
- `appointments (tenant_id, start_time)` **sem filtro** — já existe um índice `(tenant_id, start_time)` parcial que exclui cancelados (usado pela Agenda), e o relatório de comparecimento precisa justamente dos cancelados;
- `appointments (tenant_id, customer_id, start_time)` — hoje só existe índice por cliente isolado, e a busca da última Visita e do Agendamento futuro filtra pelos três;
- `customers (tenant_id, created_at)`.

`comanda_pagamentos (tenant_id, paid_at)` já existe (criado pela 037), e os itens de Comanda já têm índice por Comanda. Nenhum índice novo em `comanda_itens`.

O advisor de desempenho marca índice sem uso como alerta informativo, e no dev, sem tráfego, os novos vão aparecer assim por um tempo. O critério de manter cada índice é o `explain` do contrato que o motiva, não o advisor.

### Módulo `src/modules/relatorios/`

Segue o padrão dos módulos existentes (`fluxo-caixa`, `contas-pagar`):

- `types.ts` com a interface do adaptador: cinco consultas, uma por contrato.
- `RelatoriosRepository`, que valida período, granularidade e paginação antes de chamar o adaptador e rejeita com `RelatoriosValidationError` em pt-BR. Os limites espelham os do banco.
- Funções puras de domínio:
  - atalhos de período a partir do dia de hoje do tenant e granularidade sugerida;
  - leitura e escrita do período nos parâmetros da URL;
  - variação percentual entre período atual e anterior (anterior zero devolve `null`, nunca infinito);
  - geração de CSV no formato brasileiro (`;`, vírgula decimal, `dd/mm/aaaa`, BOM UTF-8 para o Excel, escape de aspas).
- `adapters/SupabaseRelatoriosAdapter.ts`, que converte o JSON em números e tipos do domínio.
- Um hook por página (`useRelatorioFaturamento`, `useRelatorioEquipeServicos`, `useRelatorioAgenda`, `useRelatorioClientes`, `useClientesSemRetorno`) com repositório injetado, expondo dados, carregamento, erro e recarga.
- **Sem adaptador em memória.** O contrato é só de leitura e um adaptador `vi.fn()` cobre repositório e hooks, a mesma decisão da 037.

### Telas

- Um **layout do módulo** (sem segmento de URL) com o título, a navegação entre as cinco páginas e o **filtro de período**, compartilhado pelas páginas 1, 4, 6 e 9. A página Clientes sem Retorno esconde o filtro de período e mostra os próprios filtros.
- Cada página é composta por partes de responsabilidade única (resumo em cartões, gráfico, tabela, avisos), sem componente monolítico.
- **Gráficos em SVG próprio, sem biblioteca nova**, pelo precedente do painel administrativo e do Fluxo de Caixa Projetado. Barras e linhas para evolução; barras horizontais inline para rankings e participação; o mapa de calor é uma grade (CSS grid) com a contagem em texto acessível.
- **Toda visualização tem tabela equivalente**, e a tabela é o que o CSV exporta.
- **Só desktop:** nenhuma tela do módulo tem layout de celular (sem lista de cartões, sem visão móvel). O layout do módulo decide uma única vez, pela largura, entre o conteúdo e o aviso de "disponível apenas no computador"; as páginas não repetem essa decisão. Em larguras de desktop estreitas (notebook), tabelas e mapa de calor rolam na horizontal dentro do próprio contêiner, nunca a página.
- **Estados:** carregando (Skeleton), vazio (EmptyState com texto específico por relatório), erro com botão de tentar de novo.
- **Avisos obrigatórios:** qualidade do dado quando não for `confirmed`; Agendamentos sem Desfecho quando houver; percentual de canal de aquisição preenchido; "comissão gerada, não paga"; "Comanda dividida conta para cada profissional".
- Componentes existentes a reusar: `SegmentedControl`, `CustomDatePicker`, `StatCard`, `DataTable`, `EmptyState`, `Skeleton`, `Badge`, `Pagination`, `Drawer`.

### Linguagem e documentação

A implementação atualiza `CONTEXT.md` com:

- **Módulo de Relatórios (Rota /relatorios)**
- **Receita Reconhecida de Item**
- **Visita**
- **Cliente Novo**, **Cliente Recorrente** e **Cliente de Uma Visita**
- **Cliente sem Retorno**
- **Agendamento sem Desfecho**
- **Taxa de Comparecimento**
- **Origem do Cadastro** x **Canal de Aquisição**

E cria a **ADR 022**, registrando: relatórios em rota própria, fora do Hub Financeiro e exclusiva do desktop; um contrato de leitura por página, sem contrato genérico nem persistência; Receita Reconhecida e Visita como funções `private` compartilhadas.

## Testing Decisions

Um bom teste aqui verifica **o número que o gestor lê**: quanto faturou num dia, quantos atendimentos um profissional teve, se um cliente aparece como sem retorno, quem consegue ler. Nenhum teste afirma sobre ordem de CTE, nome de variável ou forma interna da consulta.

**Seams propostas (duas, as mesmas da 037):**

1. **Contrato do banco** — as cinco RPCs públicas (e os núcleos com relógio injetado). É onde vivem todas as regras de dinheiro, Visita e classificação.
2. **Interface do módulo** — `RelatoriosRepository`, funções puras e hooks, com adaptador falso. A tela é testada por página com repositório falso injetado.

As duas funções `private` compartilhadas **não** ganham seam própria: são cobertas pelos contratos que as usam.

### Banco (pgTAP, primária)

Arte prévia: `09_metricas_historicas_snapshots`, `31_fluxo_de_caixa_projetado`, `32_bloqueia_gerente_tenant_nulo`. Um arquivo por contrato, numerados a partir de 33:

- `33_relatorio_faturamento`
- `34_relatorio_equipe_e_servicos`
- `35_relatorio_agenda`
- `36_relatorio_clientes`
- `37_relatorio_clientes_sem_retorno`

Casos comuns a todos: barbeiro recusado; gerente pedindo outro tenant recusado; gerente com tenant nulo recusado; `proprietario` com o tratamento das RPCs financeiras; cada limite de período e granularidade; Comanda fechada às 23h30 no horário local cai no dia local, e não no dia UTC. Cada arquivo confirma também as **permissões** da função (sem execução para `public` e `anon`, com execução para `authenticated` e `service_role`) e que as funções privadas compartilhadas não são executáveis por `authenticated`.

Além dos testes, cada contrato é conferido uma vez com `explain (analyze, buffers)` sobre um período de 366 dias, para confirmar que os índices novos são usados e que a consulta fica bem abaixo do limite de 8 segundos do papel `authenticated`. O resultado vai nas notas do ticket, não no teste.

- **Faturamento:**
  - Comanda aberta e cancelada não contam; item `reverted` não conta; item `unavailable` conta por `total_price`.
  - Gorjeta fica fora do líquido e aparece em `tips`.
  - **Teste cruzado:** para o mesmo intervalo, `net` é igual a `operational_revenue` e `data_quality` é igual a `historical_data_quality` de `get_tenant_financial_metrics`.
  - **Teste cruzado:** o recebido de um dia é igual ao `received_total` de `get_daily_financial_summary`.
  - Comanda reaberta some do recebido.
  - Ticket médio `null` em agrupamento sem Comanda.
  - Período anterior com as datas e totais corretos.
- **Equipe e Serviços:**
  - Comanda com dois profissionais conta um atendimento para cada um, com o valor de cada item para quem executou.
  - Venda só de produto não é atendimento.
  - Profissional arquivado e serviço arquivado com item no período aparecem marcados.
  - Soma do líquido por profissional igual ao total.
  - Filtro de profissional afeta só a lista de serviços.
- **Agenda:**
  - Cada status classificado corretamente, incluindo sem desfecho (passado `confirmed`) e futuro.
  - Taxas com denominador zero devolvem `null`.
  - Cancelado fora do mapa de calor, falta dentro.
  - Hora do mapa no fuso do tenant.
  - Motivos normalizados e "Sem motivo informado".
  - Horas do mapa cobrindo o horário de funcionamento e ampliadas por Agendamento fora dele.
- **Clientes:**
  - Agendamento concluído e Comanda fechada no mesmo dia viram uma Visita só.
  - Comanda sem cliente conta em `unidentified_attendances` e não é Visita.
  - Cliente Novo x Recorrente na fronteira do início do período.
  - Cliente de Uma Visita deixa de sê-lo quando há Visita posterior ao período.
  - Canal de aquisição com grafias diferentes agrupado; nulo em "Não informado"; percentual preenchido.
- **Clientes sem Retorno** (com relógio injetado):
  - Prazo pelo menor `return_period_days` dos serviços da última Visita; padrão 20.
  - Cliente com Agendamento futuro `confirmed` fora da lista; com futuro `canceled` dentro.
  - Visita de balcão (Comanda sem Agendamento) conta como última Visita.
  - Faixas de atraso nas fronteiras 15/16, 30/31, 60/61.
  - Paginação não altera totais.

### Módulo (vitest, secundária)

Arte prévia: `src/modules/fluxo-caixa/__tests__` (`periodo.test.ts`, `FluxoCaixaRepository.test.ts`, `useFluxoCaixa.test.ts`, `SupabaseFluxoCaixaAdapter.test.ts`).

- `RelatoriosRepository` com adaptador `vi.fn()`: validação e mensagens de cada consulta.
- Atalhos de período a partir do dia de hoje do tenant, incluindo virada de mês, virada de ano, "mês passado" em janeiro e um instante em que o dia UTC já é outro.
- Período na URL: ida e volta, parâmetros inválidos caindo no padrão.
- Variação percentual: anterior zero, ambos zero, negativo.
- CSV: separador, vírgula decimal, datas, BOM, campo com `;` e aspas.
- Adaptador Supabase: conversão de números, `null` preservado (ticket médio, taxas), campos ausentes, mockando `lib/supabase` como nos adaptadores existentes.

### Interface

Um teste por página, com repositório falso injetado, cobrindo o comportamento visível: aviso de qualidade do dado; estado vazio; troca de atalho chamando a consulta com as datas certas; reordenação do ranking; aviso de Agendamentos sem Desfecho; paginação e ação de WhatsApp indisponível sem telefone em Clientes sem Retorno. Um teste de rota confirma que o barbeiro não alcança `/relatorios`. Um teste do layout do módulo, simulando largura de celular, confirma que aparece o aviso de "disponível apenas no computador" e que o repositório não é chamado; e um teste da navegação confirma que o item "Relatórios" não está na barra inferior nem na gaveta "Mais". Gráficos, cartões e tabelas não ganham arquivos próprios.

### Regressão

Nenhuma função existente é alterada. Os testes cruzados com `get_tenant_financial_metrics` e `get_daily_financial_summary` protegem as definições compartilhadas de faturamento e recebido.

## Out of Scope

- **Relatórios fora dos dez**, deixados para depois na priorização: DRE e entradas x saídas; estoque (curva ABC, movimentação, estoque baixo); lucro por serviço e por produto; ranking de produtos; taxa de ocupação real da agenda; aniversariantes; comissões, fechamentos de caixa e contas a pagar (já cobertos pelo Hub Financeiro).
- **Fidelidade, assinaturas e acessos ao app do cliente** do sistema de referência: não existem essas entidades no Navalhado.
- **Cards de resumo com números no catálogo** (resumo executivo). A página inicial é só catálogo.
- **Versão para celular** de qualquer relatório, incluindo layout em cartões e acesso pela navegação móvel. O módulo é exclusivo do desktop.
- **Exportação em PDF e impressão.** Só CSV.
- **Envio de mensagem pelo relatório**, incluindo disparo em massa para Clientes sem Retorno ou Clientes de Uma Visita. O relatório abre o WhatsApp de um cliente por vez, sem texto pré-preenchido.
- **Relatórios agendados ou enviados por e-mail/WhatsApp.**
- **Acesso do profissional** a qualquer relatório, inclusive aos próprios números.
- **Tabelas de agregação pré-calculadas** (rollup diário, views materializadas).
- **Comparação ano contra ano** e comparação com período escolhido livremente. Só o período anterior de mesma duração.
- **Filtros por categoria de serviço, forma de pagamento ou origem** além dos descritos.
- **Correção dos defeitos registrados** em Further Notes.

## Further Notes

**Origem.** A priorização saiu do mapeamento do sistema de referência (`docs/scraping_appbarber_relatorios.md`): dos mais de 145 sub-relatórios, foram escolhidos os dez que respondem às perguntas mais frequentes do dono, usam dado que o Navalhado já captura com confiança e não repetem o que o Hub Financeiro já mostra.

**Dado ralo no canal de aquisição e na data de nascimento.** No banco dev, todos os clientes estão com `acquisition_channel` e `birth_date` vazios. Isso é consequência do Perfil Progressivo do Cliente (o agendamento público não pede esses dados). Por isso o relatório 10 mostra a Origem do Cadastro (sempre preenchida) ao lado do canal declarado e destaca o percentual de "Não informado", e aniversariantes ficou fora. Tornar o canal obrigatório em algum ponto do cadastro é decisão de produto separada.

**Volume atual.** O dev tem 33 Agendamentos, 34 Comandas (6 fechadas) e 6 clientes. As consultas rodam sobre as tabelas de origem com os índices listados. Quando algum tenant passar de dezenas de milhares de Comandas por ano, avaliar tabela de agregação diária, sem mudar o contrato das RPCs.

**Defeito registrado e não corrigido: métricas da Central 360º do Cliente.** `calculateLTVMetrics` (`src/modules/clientes/utils.ts`) filtra Comandas por `status === 'closed'`, mas o banco grava `fechada` e o adaptador repassa o valor sem traduzir. Na prática, a Central 360º nunca usa Comandas e cai sempre no cálculo por Agendamento concluído × preço do serviço. O mesmo cálculo soma gorjeta ao total gasto e conta datas pelo fuso do navegador. O relatório de clientes desta spec não usa essa função. A correção fica para um ajuste próprio, idealmente reusando a definição de Visita desta spec.

**Divergência registrada: lembrete de retorno ignora visita de balcão.** `get_pending_return_reminders` olha só o último Agendamento `completed`. Um cliente atendido no balcão sem Agendamento pode receber lembrete como se estivesse sumido, enquanto o relatório 8 corretamente não o lista. As duas listas podem divergir até o lembrete adotar a definição de Visita. Fica fora desta spec para não mexer na régua de WhatsApp em produção.

**Divergência herdada: profissionais inativos no painel de Caixa e Comissões.** `get_tenant_financial_metrics` lista em `commissions_by_professional` só profissionais ativos. O ranking desta spec inclui inativos e arquivados, então a soma por profissional das duas telas pode diferir quando alguém saiu no período. O total geral continua igual e é coberto pelo teste cruzado.

**Precedente de acesso.** O tratamento do `proprietario` segue a regra comum às specs 035, 036 e 037, confirmada como intencional em 2026-09-12. O bloqueio de gerente com tenant nulo segue o teste pgTAP 32 e já nasce nas RPCs novas, independente de quando o fix das RPCs financeiras existentes for aplicado.

**Precisão monetária.** As somas usam `numeric` sem precisão fixa e arredondam a duas casas só na saída. Percentuais e taxas saem com quatro casas decimais (fração de 0 a 1) e a tela formata com uma casa.
