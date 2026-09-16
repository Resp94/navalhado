# Spec 037 — Fluxo de Caixa Projetado

## Problem Statement

Com Contas a Pagar (spec 036), o Hub Financeiro passa a saber o que a barbearia deve e quando vence. Ainda assim, o gestor não consegue responder à pergunta que motivou tudo isso: **vai sobrar ou vai faltar dinheiro nas próximas semanas?**

**As informações estão espalhadas por telas que não conversam.** O recebido do dia fica na aba de Caixa, as Quitações de Comissão e os vales ficam na aba de Comissões e na Conta do Profissional, e as Contas a Pagar ficam em lista própria. Para saber se o aluguel do dia 10 cabe no caixa, o gestor precisa somar à mão o que entrou, o que saiu e o que ainda vai vencer, e ainda chutar quanto vai entrar até lá.

**Não existe nenhuma referência de quanto costuma entrar.** O dono sabe que sábado é o dia forte e segunda é fraco, mas o sistema não usa o histórico que já tem para dizer quanto uma semana típica rende. Sem essa referência, qualquer conta de "vai dar" é feita de cabeça.

**O que já saiu e o que ainda vai sair não aparecem juntos.** Uma conta vencida e não paga é tão urgente quanto uma que vence hoje, mas nenhuma tela as mostra ao lado do dinheiro disponível. O mesmo vale para o que a casa deve à equipe (comissões e gorjetas em aberto): é dinheiro comprometido, mas sem data de pagamento, e hoje não aparece em lugar nenhum junto do resto.

## Solution

Criar o **Fluxo de Caixa Projetado**: uma aba do Hub Financeiro que mostra, por dia, semana ou mês, o que entrou e saiu de fato e o que deve entrar e sair até o fim do período.

- **Entradas realizadas:** pagamentos de Comanda.
- **Saídas realizadas:** Baixas de Contas a Pagar, Quitações de Comissão e vales.
- **Entradas estimadas:** média histórica do recebido por dia da semana, sempre com rótulo de estimativa.
- **Saídas previstas:** Contas a Pagar em aberto pelo saldo restante, com as vencidas destacadas no período de hoje.
- **Compromissos sem data** (comissões e gorjetas a pagar, menos vales a abater) aparecem numa linha própria, sem datas inventadas.

O gestor pode informar, só na tela e sem gravar, o saldo disponível hoje. Sem esse valor, a curva mostra o **resultado acumulado** do período. Com ele, mostra o **saldo projetado**.

## User Stories

1. Como gestor, quero ver entradas e saídas da barbearia agrupadas por dia, semana ou mês num único lugar, para que eu não precise somar valores de várias abas.
2. Como gestor, quero que as entradas realizadas sejam os pagamentos de Comanda na data em que foram recebidos, para que o fluxo mostre dinheiro que entrou e não serviço que foi prestado.
3. Como gestor, quero que uma Comanda reaberta deixe de contar como entrada, para que um pagamento estornado não infle o fluxo.
4. Como gestor, quero que as Baixas de Contas a Pagar apareçam como saída na data do pagamento, com juros e multa somados e desconto abatido, para que a saída reflita o valor que de fato saiu.
5. Como gestor, quero que Quitações de Comissão e vales apareçam como saída, para que o dinheiro repassado à equipe entre no fluxo.
6. Como gestor, quero que um vale abatido numa Quitação de Comissão não conte duas vezes, para que o dinheiro que saiu uma vez apareça uma vez só.
7. Como gestor, quero que Baixas, Quitações e vales estornados deixem de contar como saída, para que uma correção não deixe resíduo no fluxo.
8. Como gestor, quero que sangrias, suprimentos e sobras ou quebras de caixa não apareçam como entrada nem como saída, para que dinheiro que só mudou de lugar não seja tratado como receita ou despesa.
9. Como gestor, quero que uma Baixa paga com dinheiro da gaveta conte uma vez só, e não também como movimento de caixa, para que a saída não seja duplicada.
10. Como gestor, quero ver quanto deve entrar em cada dia futuro, estimado pela média do mesmo dia da semana nas últimas semanas, para que eu tenha uma referência realista de receita.
11. Como gestor, quero que a estimativa apareça sempre rotulada e visualmente diferente do realizado, para que eu nunca confunda previsão com dinheiro recebido.
12. Como gestor, quero saber em quantas semanas de histórico a estimativa se baseia, para que eu calibre a confiança que deposito nela.
13. Como gestor de uma barbearia nova, quero ser avisado de que ainda não há histórico suficiente para estimar entradas, para que eu não tome decisão com base em número inventado.
14. Como gestor, quero que dias em que a barbearia não abre tenham estimativa zero, para que a projeção respeite o horário de funcionamento configurado.
15. Como gestor, quero que o dia de hoje mostre só o que já entrou, sem somar estimativa, para que o realizado de hoje não seja inflado nem duplicado.
16. Como gestor, quero ver as Contas a Pagar em aberto como saída prevista na data de vencimento, pelo saldo restante, para que uma conta paga em parte não seja contada inteira.
17. Como gestor, quero que as Contas a Pagar vencidas e ainda não pagas apareçam no período de hoje, destacadas, para que dívida atrasada não suma do fluxo por ter vencido no passado.
18. Como gestor, quero que Contas a Pagar canceladas não apareçam no fluxo, para que obrigações que deixaram de existir não pesem na projeção.
19. Como gestor, quero ver numa linha própria quanto a barbearia deve à equipe entre comissões e gorjetas, já descontados os vales a abater, para que esse compromisso fique visível sem receber uma data que ninguém definiu.
20. Como gestor, quero que um profissional com vale maior que o valor a receber não reduza o que a casa deve aos outros, para que a dívida de um não esconda o crédito de outro.
21. Como gestor, quero informar na tela o saldo disponível hoje, para que a curva mostre o saldo projetado em vez do resultado acumulado.
22. Como gestor, quero que o saldo informado não fique gravado, para que um número digitado para simular não vire dado oficial.
23. Como gestor, quero ver destacado o primeiro período em que a curva fica negativa, para que eu identifique com antecedência onde vai faltar dinheiro.
24. Como gestor, quero abrir um período e ver o detalhamento de entradas por forma de pagamento, saídas por Categoria de Despesa e por profissional, e a lista de Contas a Pagar previstas, para que eu entenda de onde vem cada número.
25. Como gestor, quero escolher o período por atalhos (próximos 30 dias, este mês, próximos 3 meses, próximos 12 meses) ou por datas, para que eu chegue rápido às perguntas mais comuns.
26. Como gestor, quero que "hoje" e os limites de cada dia sejam os do fuso horário da barbearia, e não os do meu celular ou computador, para que o fluxo seja o mesmo em qualquer aparelho.
27. Como gestor, quero usar o Fluxo de Caixa Projetado no celular, para que eu consulte a projeção fora da recepção.
28. Como profissional, quero não ter acesso ao Fluxo de Caixa Projetado, para que a informação financeira da barbearia fique restrita à gestão.
29. Como gestor, quero ser lembrado de que a estimativa de entradas não desconta as comissões que essa receita futura vai gerar, para que eu não leia a projeção como mais folgada do que é.

## Implementation Decisions

### Dependência e posição na sequência

Esta spec depende da **036 — Contas a Pagar** e só pode ser implementada depois dela. Da 036 são consumidos:

- **Conta a Pagar:** estado armazenado (`open`, `partially_paid`, `paid`, `cancelled`), vencimento em `date`, saldo restante (valor menos valor baixado), Categoria de Despesa e Fornecedor.
- **Baixa:** valor principal (com o desconto dentro do principal abatido), juros/multa, desconto, **valor pago** (coluna gerada = principal + juros/multa − desconto), data do pagamento em `date`, forma de pagamento, origem e trilha de estorno.
- **Conta a Pagar Vencida:** estado derivado (`open` ou `partially_paid` com vencimento anterior ao dia de negócio de hoje do tenant).

Os nomes físicos de tabela e coluna são os que a 036 fixar. Esta spec fala do domínio. A rota `/financeiro/fluxo-de-caixa` e a divisão do Hub Financeiro em abas endereçáveis vêm do prefactor da spec 035.

### Fontes do realizado, lidas nos livros de origem

A regra que sustenta a spec: **o fluxo lê cada fato financeiro no livro onde ele nasce e nunca lê `cash_movements`.** Movimento de caixa é espelho de fato registrado em outro lugar (repasse de comissão, vale, Baixa pela gaveta) ou é transferência interna (sangria, suprimento). Somar movimentos junto com os livros de origem conta duas vezes. Somar só movimentos ignora tudo que foi pago fora da gaveta. A implementação registra essa regra na **ADR 021**.

**Entradas realizadas** são os pagamentos de Comanda (`comanda_pagamentos.amount`) de Comandas fechadas, agrupados pelo dia de negócio de `paid_at` no fuso do tenant. É o mesmo predicado de "recebido" de `get_daily_financial_summary`. O valor já vem líquido de troco, porque o fechamento grava o valor e o troco separados.

**Não se subtrai `comanda_payment_reversals`.** A reabertura de Comanda copia os pagamentos para essa tabela e os **apaga** de `comanda_pagamentos`. A tabela viva já está líquida de estornos, e subtrair o arquivo de estornos contaria o estorno duas vezes. Consequência aceita: reabrir uma Comanda tira a entrada do dia original. É o mesmo comportamento do resumo diário existente.

A gorjeta está dentro do pagamento, então entra como receita. Ela sai quando é paga ao profissional na Quitação de Comissão e, enquanto não é paga, aparece em Compromissos sem Data. O mesmo dinheiro aparece uma vez na entrada e uma vez na saída, sem duplicidade.

**Saídas realizadas** vêm de três fontes, cada uma no seu livro:

| Fonte | Valor | Data | Exclui |
|---|---|---|---|
| Baixa de Conta a Pagar | valor pago da 036 (principal + juros/multa − desconto) | data do pagamento da Baixa | Baixas estornadas |
| Quitação de Comissão (`commission_payouts`) | `amount` | dia de negócio de `paid_at` | quitações com `reversed_at` preenchido |
| Vale (`professional_account_entries`, `entry_type = 'vale'`) | `amount` | dia de negócio de `created_at` | vales estornados |

A Quitação conta por `amount` porque esse campo é **todo o dinheiro efetivamente desembolsado** (comissão e gorjeta). O `advance_amount` é abate de vale e não é dinheiro. O vale conta quando é dado, qualquer que seja a forma de pagamento, porque foi nesse momento que o dinheiro saiu. Quando o vale é abatido depois, a quitação já sai menor pelo abate. Assim o vale abatido nunca é contado de novo.

Quitações antigas, sem rateio, contam do mesmo jeito, porque `amount` continua sendo o dinheiro pago.

A Baixa conta pela coluna de valor pago da 036, sem recompor a fórmula. Uma Baixa de valor pago zero (abatimento concedido pelo fornecedor, aceito só fora do caixa) não gera saída realizada, mas reduz o saldo restante da conta e, com ele, a saída prevista. A data da Baixa é sempre um dia de negócio até hoje: fora do caixa a 036 recusa data futura, e pela gaveta a data é o dia de negócio corrente definido pelo servidor. As Baixas de uma Conta a Pagar contam pelo próprio estado de estorno, qualquer que seja o estado da conta.

**Ficam de fora do realizado:** sangria, suprimento, sobra e quebra de Fechamento de Caixa com Conferência, ajustes de sessão de caixa e entradas de estoque. Compra de fornecedor só entra no fluxo se for lançada como Conta a Pagar.

### Entradas estimadas: média por dia da semana

A receita estimada de um dia futuro é a **média do recebido nas N ocorrências mais recentes do mesmo dia da semana**, com N limitado a 8.

- **Janela:** os `N × 7` dias de negócio imediatamente anteriores a hoje. Hoje fica fora da janela.
- **Por que essa janela e não semanas de calendário:** cada dia da semana aparece exatamente N vezes, sempre em dias inteiros. Isso cumpre a exigência de "semanas completas" sem escolher em que dia a semana começa. Usar semanas de calendário deixaria até seis dias recentes fora da conta, deixando a estimativa mais velha sem nenhum ganho estatístico.
- **Dias sem recebimento** dentro da janela entram como zero na média, porque também são fatos do histórico.
- **Uma média por dia da semana:** a soma do recebido naquele dia da semana dentro da janela, dividida por N e arredondada a duas casas.

**Histórico curto.** N é calculado assim: dias de histórico = hoje − primeiro dia de negócio com pagamento de Comanda vivo no tenant; N = min(8, piso(dias de histórico ÷ 7)).

- **N de 4 a 7:** a estimativa usa as N semanas e a tela informa "baseada em N semanas".
- **N abaixo de 4:** não há estimativa. A tela mostra o aviso "histórico insuficiente para estimar entradas" e as entradas futuras ficam vazias, e não zeradas.
- **Por que o mínimo de 4:** com uma a três amostras, um único dia atípico (inauguração, feriado, chuva forte) domina a média. Quatro semanas cobrem um ciclo mensal completo de pagamento de salário, que muda o movimento de barbearia.
- **Por que contar do primeiro pagamento e não da criação do tenant:** assim o período entre o cadastro e o primeiro atendimento real não entra como semanas de zero.

**Dias sem funcionamento valem zero.** Se `tenants.business_hours` marca o dia da semana como inativo, a estimativa daquele dia é zero, mesmo que o histórico tenha recebimento. Dia ausente na configuração é lido como inativo, a mesma leitura que a agenda já faz. A configuração atual é o melhor sinal do futuro. Usar só a média projetaria receita num dia em que a casa passou a fechar.

No caso inverso, um dia que passou a abrir recentemente fica com média baixa. Isso é conservador e aceito: errar para menos é o lado certo num fluxo de caixa.

**Hoje não recebe estimativa.** O dia de hoje mostra só o realizado até o momento, e a estimativa começa amanhã. Somar a média do dia inteiro ao que já entrou de manhã duplicaria receita. Estimar só o "resto do dia" exigiria uma curva por hora que o produto não tem. A consequência (a receita que ainda falta entrar hoje não aparece) deixa a projeção mais conservadora, o que é aceitável.

**Feriados, sazonalidade e tendência** não entram no cálculo.

A estimativa é calculada a cada consulta e nunca é gravada. A resposta devolve as sete médias, N e o estado da estimativa (`ok` ou `insufficient_history`), para que a tela rotule o número sem recalcular.

### Saídas previstas

Toda Conta a Pagar em estado `open` ou `partially_paid` gera uma saída prevista **pelo saldo restante**, na data de vencimento. Contas `paid` e `cancelled` não geram previsão. Juros e multa de atraso futuros não são projetados, porque só existem quando a Baixa acontece.

Uma Conta a Pagar Vencida (`open` ou `partially_paid`, com vencimento anterior ao dia de negócio de hoje) entra no **período que contém hoje**, destacada como atrasada e com a data original de vencimento no detalhamento. Sumir com uma dívida porque ela venceu no passado é o erro mais caro que um fluxo pode cometer. Contas com vencimento depois do fim do período ficam fora.

### Compromissos sem Data

É o valor que a barbearia deve à equipe hoje e que não tem data de pagamento. Fica numa linha própria, calculada no momento da consulta, e **não é distribuído entre os períodos nem entra na curva**. Distribuí-lo exigiria inventar uma data de quitação, e a decisão de quando quitar é do gestor.

**Composição:** para cada profissional do tenant (ativo, inativo ou arquivado, para que dívida com ex-profissional não suma), o fluxo lê o `suggested_net_amount` de `get_professional_commission_balance`. Esse valor é comissão em aberto, legado incluído, mais gorjetas em aberto menos vales em aberto, com piso zero por profissional.

- **Soma por profissional com piso zero:** o total é a soma desses líquidos. Um profissional que deve vale acima do que tem a receber aparece como zero e não reduz o que a casa deve aos colegas. Vale é dívida do profissional com a casa, não dinheiro que vai entrar.
- **Componentes na tela:** comissões em aberto, gorjetas em aberto e vales a abater aparecem como detalhe. A tela avisa que o total pode ser maior que "comissões + gorjetas − vales" quando algum vale supera o devido.

**Por que reusar `get_professional_commission_balance` e não `get_tenant_current_commission_balance`:** a função por profissional é a mesma origem do líquido que a Quitação de Comissão exibe e liquida (decisão da spec 034). Montar o total do tenant a partir dela garante que a linha do fluxo e a soma das telas de quitação nunca divirjam. A função do tenant tem três problemas para este uso:

- cobre só comissão;
- calcula o legado no tenant inteiro, compensando profissionais entre si;
- conta como pago o legado de quitações estornadas (ver Further Notes).

O custo é uma chamada por profissional, o mesmo padrão que `get_tenant_financial_metrics` já usa, e aceitável para o tamanho de equipe de uma barbearia.

A resposta mostra dois totais finais: saldo ou resultado **ao fim do período** e o mesmo valor **depois dos Compromissos sem Data**.

### Períodos e agrupamento

- **Início:** de hoje − 365 dias até hoje.
- **Fim:** de início até hoje + 365 dias.
- **Extensão máxima:** 366 dias.
- **Granularidade:** `day`, `week` ou `month`. A granularidade diária só é aceita em períodos de até 92 dias, porque acima disso o gráfico fica ilegível.
- **Semana:** começa na segunda-feira.
- **Mês:** mês civil.
- **Primeiro e último agrupamento:** são recortados aos limites do período, e cada agrupamento devolve as próprias datas de início e fim.

**O início nunca é depois de hoje.** Um período começando no futuro deixaria um vão entre hoje e o início, com contas vencendo e receita entrando fora da tela, e nem o resultado acumulado nem o saldo projetado fariam sentido. A pergunta "e o mês que vem?" se responde com "de hoje até o fim do mês que vem".

Cada agrupamento é classificado como `past` (termina antes de hoje), `current` (contém hoje) ou `future` (começa depois de hoje). Um período inteiramente passado mostra só realizado: sem estimativa, sem previsão, sem vencidas e sem campo de saldo.

**Atalhos da tela:**

| Atalho | Datas | Granularidade |
|---|---|---|
| Próximos 30 dias (padrão) | hoje a hoje + 29 | dia |
| Este mês | primeiro ao último dia do mês | dia |
| Próximos 3 meses | hoje a hoje + 89 | semana |
| Próximos 12 meses | hoje a hoje + 364 | mês |
| Personalizado | escolhidas pelo gestor | escolhida dentro dos limites |

### Contrato de leitura

Uma única RPC de leitura, `get_projected_cash_flow(p_tenant_id, p_start_date, p_end_date, p_granularity)`, `SECURITY DEFINER` com `search_path = ''`, revoke de `public` e `anon` e grant a `authenticated` e `service_role`. Ela devolve numa chamada tudo que a aba mostra:

```
timezone, business_today
estimate        { status, weeks_used, weekday_averages{mon..sun} }
buckets[]       { start_date, end_date, kind,
                  inflow_realized, inflow_estimated,
                  outflow_realized, outflow_forecast, outflow_overdue,
                  pending_flow,
                  detail { inflow_by_method, estimated_days, closed_days,
                           payables_paid_by_category, payouts_by_professional,
                           advances_by_professional, forecast_payables[] } }
undated_commitments { commission_open, tips_open, advances_open, net_due }
```

**Uma chamada em vez de duas.** O detalhamento de cada agrupamento vem junto, e não por uma segunda chamada. Ele é agregado (formas de pagamento, categorias e profissionais são conjuntos pequenos), e a única lista item a item é a de Contas a Pagar previstas, limitada pelas contas em aberto dentro de um período de no máximo 366 dias. Abrir o detalhamento não faz a tela esperar.

**Realizado não é listado item a item.** O detalhamento mostra totais por forma de pagamento, por Categoria de Despesa e por profissional. Cada Conta a Pagar prevista leva para a própria conta na aba de Contas a Pagar.

**`business_today` e `timezone` vêm do banco.** A tela nunca decide sozinha qual é o dia de hoje para classificar agrupamentos. O fuso é lido de `tenants.timezone` dentro da função, sem parâmetro de fuso vindo do cliente. Os limites de dia seguem o padrão do projeto: `>= p_start::timestamp at time zone tz` e `< (p_end + 1)::timestamp at time zone tz`.

**`pending_flow` guarda o que ainda não está no saldo de hoje.** Ele soma entradas estimadas, saídas previstas e vencidas, e qualquer realizado com data posterior a hoje (possível, por exemplo, numa Quitação com `paid_at` informado adiante). É isso que permite à tela compor o saldo projetado sem saber o que já está no dinheiro disponível.

**Acesso.** A superfície é do `gerente` do próprio tenant: a função rejeita, para o `gerente`, um `p_tenant_id` diferente do tenant do usuário. O `proprietario` recebe exatamente o tratamento que as RPCs financeiras existentes já dão a ele (ver Further Notes). Barbeiro recebe erro de acesso.

**Relógio injetável.** A função pública valida acesso e parâmetros, resolve o dia de negócio de hoje e delega a um núcleo em `private` que recebe "hoje" como parâmetro. O relógio é a única dependência que muda o resultado de um dia para o outro. Injetá-lo torna determinísticos os testes de estimativa, vencidas e classificação de agrupamento.

**Validação** com mensagens em pt-BR e `errcode` `22023`: datas nulas, fim antes do início, início depois de hoje, limites de extensão, granularidade desconhecida e granularidade diária acima de 92 dias.

### Índices

A consulta filtra por tenant e intervalo de data em tabelas que hoje não têm índice para isso. A migração cria:

- `comanda_pagamentos (tenant_id, paid_at)`;
- `commission_payouts (tenant_id, paid_at)` parcial com `reversed_at is null`.

`professional_account_entries (tenant_id, created_at)` já existe. Os índices das tabelas da 036 são criados por ela: por tenant e data de pagamento, parcial nas Baixas não estornadas, e por tenant e vencimento, parcial nas Contas a Pagar `open` e `partially_paid`. Esta spec não cria índice nessas tabelas.

### Curva: resultado acumulado ou saldo projetado

Cada agrupamento tem um **resultado** = entradas realizadas + entradas estimadas − saídas realizadas − saídas previstas − vencidas. `outflow_forecast` guarda só as contas com vencimento dentro do agrupamento e a partir de hoje, e `outflow_overdue` guarda só as vencidas, que existem apenas no agrupamento `current`. Assim nenhuma conta é contada nos dois campos. A curva é composta no navegador por uma **função pura do módulo**, porque o saldo informado é entrada só de tela. Mandá-lo ao banco a cada tecla refaria a consulta inteira sem necessidade.

- **Saldo não informado (zero, o padrão):** a curva se chama **Resultado acumulado** e é a soma corrida dos resultados desde o primeiro agrupamento do período.
- **Saldo informado (maior que zero):** a curva se chama **Saldo projetado**. Ela começa no agrupamento `current` com saldo informado + `pending_flow` desse agrupamento e soma o `pending_flow` de cada agrupamento seguinte.
  - O realizado até hoje não entra, porque já está dentro do saldo informado.
  - Agrupamentos `past` não mostram saldo. Reconstruir saldo passado subtraindo movimentos fingiria conhecer dinheiro que o sistema não registra, como sangria depositada no banco ou receita de fora.

**O saldo informado nunca é gravado**, nem enviado ao banco, nem posto na URL, nem guardado em armazenamento do navegador. Saldo persistido por conta pertence à futura spec de subcontas e contas bancárias. Aceita valor maior ou igual a zero, lido com `parseCurrencyInput`.

Zero é tratado como "não informado", como o usuário decidiu. Um saldo real de exatamente zero aparece como resultado acumulado.

A função também devolve o **primeiro agrupamento com curva negativa**, que a tela destaca com texto adequado ao rótulo: "saldo projetado negativo a partir de..." ou "resultado acumulado negativo a partir de...".

### Módulo `src/modules/fluxo-caixa/`

O módulo segue o padrão do projeto:

- `types.ts` com a interface do adaptador (`obterFluxoCaixaProjetado`).
- `FluxoCaixaRepository`, que valida período e granularidade antes de chamar o adaptador e rejeita com `FluxoCaixaValidationError` em pt-BR. Os limites espelham os do banco, para que o erro apareça antes da ida à rede.
- Funções puras de domínio: composição da curva, atalhos de período a partir do dia de hoje do tenant, e sugestão de granularidade.
- `adapters/SupabaseFluxoCaixaAdapter.ts`, que converte o JSON em números e tipos do domínio.
- Hook `useFluxoCaixa`, que recebe o repositório injetado e expõe dados, carregamento, erro e recarga.

**Sem adaptador em memória.** O contrato é só de leitura, e um adaptador `vi.fn()` cobre repositório e hook. Com um adaptador só, a seam é hipotética, e um adaptador em memória não pagaria o custo de manter.

**A interface do módulo é pequena:** uma consulta e uma função de curva. Toda a regra de fontes, estimativa e vencidas fica atrás do contrato do banco, onde os invariantes de dinheiro vivem.

**Sem realtime.** A aba não assina mudanças em tempo real. O contrato agrega meia dúzia de tabelas, e reagir a cada pagamento de Comanda refaria uma consulta pesada durante o movimento da recepção. A aba recarrega ao mudar filtro, ao voltar o foco para a janela e pelo botão "Atualizar".

### Tela `/financeiro/fluxo-de-caixa`

A aba é composta por partes com responsabilidade única, e não por um componente monolítico como `Financeiro.tsx`. O estado de filtro e saldo mora no componente da aba, e cada parte recebe só o que exibe:

- **Filtros:** atalho de período (`SegmentedControl`), datas (`CustomDatePicker`), granularidade e campo "Saldo disponível hoje (opcional)".
- **Resumo:** cartões de entradas realizadas, entradas estimadas, saídas realizadas, saídas previstas (com vencidas em destaque), valor ao fim do período e valor depois dos Compromissos sem Data.
- **Gráfico:** barras de entrada e saída por agrupamento e a curva.
- **Tabela:** uma linha por agrupamento. Em largura de celular vira lista de cartões pela mesma composição responsiva, sem uma "MobileView" separada. No celular, a aba é alcançada pela navegação entre abas do Hub, que a 035 passa a exibir em largura de celular com rolagem horizontal.
- **Compromissos sem Data:** cartão com total e componentes, e link para a aba de Comissões.
- **Detalhamento:** `Drawer` aberto ao tocar num agrupamento na tabela ou no gráfico.

**Estimado e previsto são variantes explícitas, não um atributo booleano espalhado.** Todo número estimado ou previsto aparece com rótulo textual ("estimado" ou "previsto"), e no gráfico com preenchimento distinto (hachurado ou translúcido) e legenda. A distinção nunca depende só de cor.

**Avisos obrigatórios:**

- histórico insuficiente, ou "estimativa baseada em N semanas";
- "a estimativa de entradas não desconta comissões que essa receita vai gerar";
- "hoje mostra apenas o realizado".

**Gráfico em SVG próprio, sem biblioteca nova.** O `package.json` não tem biblioteca de gráficos, e o projeto já tem precedente de gráfico SVG feito à mão no painel administrativo (`src/pages/admin/Dashboard.tsx`). Um gráfico de barras com uma linha, com no máximo 92 agrupamentos, não justifica uma dependência de dezenas de kB no bundle de todos os usuários. Em granularidade diária com muitos agrupamentos, o gráfico rola na horizontal dentro do próprio contêiner. A tabela é o equivalente acessível do gráfico, e o SVG leva um título descritivo.

**Datas da tela.** Atalhos e datas iniciais são calculados com o dia de hoje no fuso do tenant (`dateInZone` com o fuso de `GerenteLayout`), nunca com a data local do navegador. A classificação de agrupamento usa `business_today` da resposta.

### Linguagem e documentação

A implementação atualiza `CONTEXT.md` com os termos:

- **Fluxo de Caixa Projetado**
- **Entrada Estimada**
- **Saída Prevista**
- **Compromissos sem Data**
- **Resultado Acumulado**
- **Saldo Projetado**

E cria a **ADR 021**, que registra três decisões: o fluxo lê livros de origem e nunca movimentos de caixa; a entrada futura é estimada pela média por dia da semana, sem persistência; o saldo inicial é só de tela.

## Testing Decisions

Um bom teste aqui verifica **o número que o gestor vê**: quanto entrou num dia, quanto está previsto num agrupamento, qual é o total de Compromissos sem Data, quem consegue ler. Nenhum teste afirma sobre ordem de CTE, nome de variável ou forma interna do cálculo.

**Seam primária: testes de banco (pgTAP, `supabase test db`).** Os invariantes de dinheiro vivem no contrato de leitura. Arte prévia: `22_extrato_sessao_caixa`, `23_reabertura_comanda_rastro_correto`, `25_validar_saldo_gaveta_quitacao_comissao`, `27_abate_vale_na_quitacao_comissao` e os arquivos da 036.

Um arquivo novo, `31_fluxo_de_caixa_projetado`. Os casos que dependem de "hoje" usam o núcleo com relógio injetado. Os de acesso e os de ligação com o fuso usam a função pública. Cobertura:

- **Acesso:** barbeiro recusado; gerente pedindo outro tenant recusado; `proprietario` com o mesmo tratamento das RPCs financeiras existentes.
- **Fuso:** pagamento às 23h30 no horário local cai no dia local, e não no dia UTC.
- **Entradas realizadas:**
  - Comanda reaberta some da entrada.
  - A entrada de um dia é igual ao `received_total` de `get_daily_financial_summary` no mesmo dia. Esse teste cruza os dois contratos e falha se as duas definições de "recebido" divergirem.
- **Movimentos de caixa ignorados:** sangria e suprimento não alteram nada; Baixa pela gaveta conta uma vez.
- **Baixas:** a saída é o valor pago da 036, somando juros e multa e abatendo o desconto; Baixa de valor pago zero não gera saída e reduz a previsão pelo principal abatido; Baixa estornada some.
- **Quitações e vales:** a Quitação conta `amount` sem `advance_amount`; Quitação estornada some; vale conta na data de criação; vale abatido não conta de novo.
- **Estimativa:**
  - média com 8 semanas;
  - média com N entre 4 e 7, com `weeks_used` correto;
  - estado `insufficient_history` abaixo de 4;
  - dia inativo em `business_hours` estimado como zero;
  - dias sem recebimento contam como zero na média;
  - hoje sem estimativa.
- **Saídas previstas:** conta parcialmente paga prevista pelo saldo restante; conta cancelada ausente; vencida no agrupamento `current`, marcada como atrasada; vencimento depois do fim do período ausente.
- **Agrupamento:** semanas começando na segunda e recortadas ao período; meses civis; período inteiramente passado sem estimativa nem previsão.
- **Validação:** cada limite de período e de granularidade.
- **Compromissos sem Data:** o total é igual à soma dos `suggested_net_amount` por profissional; profissional com vale acima do devido contribui com zero; profissional inativo com saldo em aberto é incluído.

**Seam secundária: módulo (vitest).**

- `FluxoCaixaRepository` com adaptador `vi.fn()`: validação e mensagens.
- Função de curva:
  - acumulado sem saldo;
  - saldo projetado começando no agrupamento `current`;
  - agrupamentos passados sem saldo;
  - realizado de hoje não somado ao saldo;
  - primeiro agrupamento negativo;
  - troca de rótulo entre zero e valor informado.
- Atalhos de período calculados a partir do dia de hoje do tenant, incluindo virada de mês e um instante em que o dia UTC já é outro.
- Adaptador Supabase: conversão de números e de campos ausentes, mockando `lib/supabase` como nos adaptadores existentes.

**Interface.** Um teste da aba, com repositório falso injetado, cobre: rótulo de estimativa visível; aviso de histórico insuficiente; campo de saldo trocando o rótulo da curva; destaque de vencidas; abertura do detalhamento. Gráfico, tabela e cartões não ganham arquivos próprios, e a cobertura vem pela aba.

**Regressão.** Nenhuma função existente é alterada, então nenhuma suíte existente precisa mudar. O teste cruzado com `get_daily_financial_summary` protege a definição compartilhada de "recebido".

## Out of Scope

- **Contas a Receber**, fiado e recebíveis de cartão. Decisão do usuário: comanda e caixa já cobrem a entrada. Pagamento em cartão conta como entrada na data do pagamento, sem prazo de repasse da adquirente. O "total a receber" do sistema de referência não é reproduzido.
- **Saldo persistido, subcontas e contas bancárias**, e transferência entre elas. O saldo disponível hoje é só de tela. Gravar saldo por conta e conciliar pertence à spec de subcontas e bancos.
- **DRE, margem e regime de competência.** O fluxo é regime de caixa. A data de competência gravada pela 036 fica para o demonstrativo futuro.
- **Projeção de comissões futuras** sobre a receita estimada. A tela avisa que a estimativa não as desconta.
- **Feriados, sazonalidade, tendência e remoção de dias atípicos** na estimativa.
- **Agendamentos futuros como fonte de entrada prevista.** A estimativa escolhida é a média histórica.
- **Juros e multa projetados** sobre Contas a Pagar vencidas.
- **Cenários e simulação** além do saldo informado, como incluir ou excluir contas ou alterar a estimativa à mão.
- **Exportação e impressão** (PDF ou planilha) do fluxo.
- **Alertas e notificações** de saldo negativo projetado fora da própria tela.
- **Acesso do profissional** a este contrato.
- **Correção do filtro de período** do painel de Caixa e Comissões (ver Further Notes).
- **KPIs do painel de Caixa e Comissões**, incluindo o nome e o cálculo de "Lucro líquido livre", que ficam para a DRE (ver Further Notes da 035).

## Further Notes

**Origem.** O painel de fluxo de caixa do sistema de referência (`docs/scraping_appbarber_financeiro.md` §4.7) compara receitas e despesas por dia e mês. A armadilha registrada em §6, de que reentrada de sangria não é receita nova, é a mesma que esta spec resolve de forma estrutural: o fluxo não lê movimentos de caixa. O que o sistema de referência chama de total a receber depende de recebíveis de cartão, fora de escopo.

**Contrato da 036 que esta spec assume.** O valor que saiu numa Baixa é a coluna gerada de valor pago da 036 (principal + juros/multa − desconto, com o desconto dentro do principal abatido), e esta spec não tem segunda definição. O saldo restante de uma Conta a Pagar é o valor menos o valor baixado, projetado sem juros nem desconto futuros. As Baixas contam sempre pela data do pagamento, que a 036 nunca aceita no futuro.

**Defeito registrado e não corrigido: filtro de período no navegador.** `src/pages/gerente/Financeiro.tsx:134-154` calcula "este mês" e "últimos N dias" com a data local do navegador e envia os instantes a `get_tenant_financial_metrics`. Num aparelho em outro fuso, os KPIs do painel de Caixa e Comissões pegam dias errados. Esta spec não repete o erro, porque o dia de hoje vem do banco e os atalhos usam o fuso do tenant. A correção fica fora porque o prefactor da 035 move esse painel e as abas sem corrigir defeitos, e corrigir em paralelo geraria conflito. Fica como candidato a ajuste logo após a 035.

**Divergência encontrada: saldo de comissão do tenant ignora estorno no legado.** `get_tenant_current_commission_balance` (migração `20260911133521`) soma como pago o `amount` de quitações legadas **sem filtrar `reversed_at`**. A migração de estorno de quitação (`20260912020000`) atualizou só a versão por profissional. O KPI "comissão pendente" de `get_tenant_financial_metrics` herda o desvio. Esta spec não usa a função e registra o defeito para correção própria.

**Precedente de acesso.** As RPCs financeiras existentes (`get_daily_financial_summary`, `get_tenant_financial_metrics`, `get_professional_commission_balance`, `register_commission_payout` e outras) aceitam `p_tenant_id` de qualquer tenant quando o papel é `proprietario`, e recusam para o `gerente` um tenant diferente do próprio. `get_professional_commission_balance`, da qual os Compromissos sem Data dependem, segue esse mesmo tratamento.

**Papel `proprietario` nas superfícies novas (regra comum às specs 035, 036 e 037).** No banco, `private.is_saas_admin()` é verdadeiro para o papel `proprietario`, que é o administrador do SaaS e não pertence a um tenant. As superfícies novas são do `gerente` do próprio tenant, e o `proprietario` recebe exatamente o tratamento que as RPCs financeiras existentes já dão a ele: a leitura por tabela o admite pelo ramo de administrador do SaaS da política moderna, e as RPCs aceitam dele um tenant informado diferente do próprio, que recusam para o `gerente`. O usuário confirmou em 2026-09-12 que o acesso é intencional: o administrador do SaaS precisa operar qualquer tenant para suporte. Mudá-lo depois é uma decisão única para todo o financeiro, não por spec.

**Dois nomes para dinheiro que entrou.** O painel de Caixa e Comissões do Hub Financeiro mostra faturamento por `closed_at` da Comanda (`get_tenant_financial_metrics`). O fluxo mostra recebido por `paid_at` do pagamento. Hoje os dois instantes coincidem, porque o pagamento é gravado no fechamento, mas as definições são diferentes. A aba usa sempre "recebido", nunca "faturamento".

**Dívida aceita: definição de "recebido" repetida.** O predicado de recebido (pagamentos de Comanda fechada por `paid_at`) já aparece em `get_daily_financial_summary`, nas fórmulas de gaveta e no repositório de Caixa, e passa a aparecer também neste contrato. Extrair um auxiliar comum exigiria parâmetros que só um consumidor usa: o filtro por sessão do resumo diário e a forma de pagamento das fórmulas de gaveta. O resultado seria uma interface rasa. A divergência fica vigiada pelo teste cruzado com o resumo diário.

**Precisão monetária.** `comanda_pagamentos`, `commission_payouts` e `professional_account_entries` usam `numeric(10,2)`, e as tabelas da 036 usarão `numeric(12,2)`. O fluxo soma em `numeric` sem precisão fixa e arredonda a duas casas só na saída, sem truncar valores de nenhuma origem.
