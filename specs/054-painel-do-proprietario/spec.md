# Especificação Técnica: Painel do Proprietário com a cobrança real, cabeçalho que cabe no celular e aviso de cancelamento que some

Triagem: `done`

## Problem Statement

O Proprietário abre Admin > Dashboard para saber quanto a plataforma fatura e quantas barbearias estão de pé, e o painel não conversa com a cobrança da spec 052.

**1. A receita vem de uma tabela que ninguém grava.** `get_admin_dashboard_metrics` soma "Faturamento do mês" e "Evolução da receita" (últimos 12 meses) a partir de `public.invoices`, criada na migration das rotas do Proprietário (2026-07-12) para um desenho de faturas que nunca foi implementado. Nenhum código grava nela: a cobrança recorrente da spec 052 registra cada pagamento em `billing_charges` (mensalidade `recurring` e diferença de plano `upgrade`, com `status`, `amount` e `charged_at`). Visto no DEV em 2026-10-03, logado como Proprietário no site de DEV: `invoices` tem 0 linhas, `billing_charges` tem 7 cobranças aprovadas, R$ 319,80 delas em outubro, e o painel mostra "Faturamento do mês R$ 0,00" e o gráfico zerado. Em produção, depois da promoção da 052, todo dinheiro recebido pelo Mercado Pago ficaria fora do painel.

**2. Os contadores olham a situação crua da assinatura, e não o Estado de Acesso.** O ticket 03 da 052 ajustou a função só no que mudou de nome:
- "Receita recorrente (MRR)" soma o preço do plano das assinaturas `active`. A `past_due` (pagamento recusado, ainda tentando cobrar) fica de fora, e a descida de plano agendada (ticket 11) não entra: o MRR mostra o plano de hoje, e não o valor que a próxima cobrança vai cobrar.
- "Barbearias ativas" conta só `active`: barbearia em teste, em cortesia ou cancelada com o período pago pela frente está liberada e não aparece.
- "Inadimplentes / Suspensas" conta `status = 'blocked'`: a barbearia com Desbloqueio Manual em vigor está liberada e entra como suspensa (limitação registrada no ticket 15), e a que o Estado de Acesso já bloqueou mas a rotina diária ainda não gravou (teste vencido hoje) fica de fora. "Suspensa" é termo a evitar no glossário (`suspended` saiu na 052).

**3. O cabeçalho do Admin não cabe no celular.** Em 375 px de largura, a barra do topo de Admin > Barbearias e de Admin > Dashboard (logo, "Dashboard", "Barbearias" e "Sair") passa 22 px da tela: o botão Sair termina em 397 px, a página inteira ganha rolagem horizontal e o botão fica cortado. O cabeçalho é escrito à mão, duas vezes, um em cada página, então qualquer correção precisa ser feita em dobro.

**4. A faixa de aviso da assinatura cancelada fica fixa na tela do Gerente.** Quando o Gerente cancela a assinatura (spec 052, ticket 12), o Estado de Acesso vira `warning` com o motivo `canceled` e a faixa de aviso "Assinatura cancelada. Acesso até 03/11." aparece no topo de todas as telas do painel e fica lá até o fim do período pago, que pode ser quase um mês. O cancelamento foi decisão do próprio Gerente e a faixa não pede nenhuma providência: vira um lembrete fixo que ocupa a tela e não sai. Visto no site de DEV em 2026-10-03, com captura de tela do usuário, logo depois de cancelar. As outras faixas (teste terminando, pagamento recusado, acesso liberado à mão) são diferentes: pedem uma providência do Gerente e seguem fixas.

## Solution

O painel do Proprietário passa a ler a cobrança real e o Estado de Acesso, o cabeçalho do Admin vira um só, que cabe numa tela de celular, e o aviso de assinatura cancelada do Gerente vira uma mensagem que some, em vez de uma faixa fixa.

- **Faturamento do mês** é a soma das cobranças aprovadas (`billing_charges.status = 'approved'`, mensalidade e diferença de plano) com `charged_at` no mês corrente. **Evolução da receita** usa a mesma regra, mês a mês, nos últimos 12 meses. O mês é o do calendário de Brasília (`America/Sao_Paulo`), o fuso da plataforma, e não o de cada barbearia. A cobrança estornada ou contestada deixa de ser `approved` e sai da soma sozinha.
- **Receita recorrente (MRR)** é o valor mensal que a próxima cobrança vai cobrar de cada assinatura que segue sendo cobrada: as `active` e as `past_due`, pelo preço do plano agendado quando há descida agendada e pelo preço do plano atual quando não há, mais a cancelada que assinou de novo e teve a assinatura nova autorizada (a cobrança dela recomeça no fim do período pago). Cancelada sem assinatura nova, cortesia, teste e bloqueada não entram (a cortesia não é cobrada, e a cancelada sem assinatura nova não renova).
- **Barbearias liberadas** (no lugar de "Barbearias ativas") conta as barbearias cujo Estado de Acesso de agora é `allowed` ou `warning`, seja qual for o motivo (teste, pagante, cortesia, cancelada com período pago, Desbloqueio Manual).
- **Barbearias bloqueadas** (no lugar de "Inadimplentes / Suspensas") conta as barbearias cujo Estado de Acesso de agora é `blocked`, seja qual for o motivo.
- O contrato da RPC muda de nome onde muda de sentido (ver Implementation Decisions), e a tela acompanha.
- `public.invoices` sai do banco, porque não tem dono nem escritor; antes, confere-se que está vazia no DEV e na PROD.
- O cabeçalho do Admin vira um componente único, usado pelas duas páginas, que cabe em 375 px sem rolagem horizontal da página e com o Sair inteiro na tela.
- Depois de cancelar a assinatura, o Gerente vê a confirmação "Assinatura cancelada. Acesso até DD/MM." como uma mensagem que some sozinha (toast), e o painel não mostra mais a faixa fixa para a assinatura cancelada. A situação continua à vista em Ajustes > Assinatura ("Cancelada até DD/MM" e "Assinar de novo") e, no fim do período pago, na tela de bloqueio. As faixas que pedem providência (teste terminando, pagamento recusado, acesso liberado à mão) não mudam.

## User Stories

1. Como Proprietário, quero que "Faturamento do mês" mostre o dinheiro que o Mercado Pago aprovou neste mês, para saber quanto a plataforma faturou de verdade.
2. Como Proprietário, quero que a diferença de plano cobrada numa subida entre no faturamento do mês, para o número bater com o extrato do Mercado Pago.
3. Como Proprietário, quero que uma cobrança recusada, em análise ou pendente não entre no faturamento, para não contar dinheiro que não veio.
4. Como Proprietário, quero que uma cobrança estornada ou contestada saia do faturamento, para o painel não mostrar receita que foi devolvida.
5. Como Proprietário, quero que o mês do faturamento seja o do calendário de Brasília, para uma cobrança feita às 22h do dia 31 em Manaus não pular para o mês seguinte só no painel.
6. Como Proprietário, quero ver a evolução da receita mês a mês nos últimos 12 meses com a mesma regra do faturamento do mês, para o gráfico e o cartão nunca discordarem.
7. Como Proprietário, quero ver meses sem cobrança como zero no gráfico, para enxergar os buracos sem confundir com erro de carga.
8. Como Proprietário, quero que o MRR some o valor da próxima cobrança das assinaturas pagantes, para estimar a receita do mês que vem.
9. Como Proprietário, quero que a assinatura com pagamento recusado (`past_due`) ainda conte no MRR enquanto o Mercado Pago tenta cobrar, para o MRR não despencar no primeiro dia de recusa.
10. Como Proprietário, quero que a descida de plano agendada já conte no MRR pelo plano menor, porque é esse valor que o Mercado Pago vai cobrar.
11. Como Proprietário, quero que cortesia, teste, cancelada sem assinatura nova e bloqueada fiquem fora do MRR, porque nenhuma delas vai gerar a próxima cobrança; e que a cancelada que assinou de novo, com a assinatura nova autorizada, entre, porque a cobrança dela recomeça no fim do período pago.
12. Como Proprietário, quero saber quantas barbearias estão liberadas agora, contando teste, pagante, cortesia, cancelada com período pago e desbloqueio manual, para saber quantas estão usando a plataforma.
13. Como Proprietário, quero saber quantas barbearias estão bloqueadas agora, pelo mesmo Estado de Acesso que fecha o painel do Gerente, para o número bater com o que o cliente vê.
14. Como Proprietário, quero que a barbearia que eu desbloqueei à mão conte como liberada, e não como bloqueada, enquanto o desbloqueio vale.
15. Como Proprietário, quero que a barbearia com teste vencido hoje já conte como bloqueada, mesmo antes de a rotina diária gravar o bloqueio.
16. Como Proprietário, quero que o painel use as palavras do domínio ("liberadas", "bloqueadas") e não "suspensas", para não confundir com um estado que não existe mais.
17. Como Proprietário, quero que só eu consiga ler essas métricas, para os números da plataforma não vazarem para um Gerente.
18. Como Gerente com `tenant_id` nulo, Barbeiro ou anônimo, quero receber recusa ao chamar a RPC das métricas, para a guarda valer para todo papel que não é o Proprietário.
19. Como Proprietário, quero abrir Admin > Dashboard e Admin > Barbearias no celular sem rolar a página para o lado, para conferir uma barbearia longe do computador.
20. Como Proprietário, quero o botão Sair inteiro na tela do celular, para sair da conta sem procurar o botão.
21. Como Proprietário, quero o mesmo cabeçalho nas duas telas do Admin, com a aba atual marcada, para saber onde estou.
22. Como desenvolvedor, quero um cabeçalho do Admin único, para uma correção futura valer nas duas telas de uma vez.
23. Como desenvolvedor, quero que a tabela morta `public.invoices` saia do banco, para ninguém voltar a somar receita de uma tabela sem escritor.
24. Como desenvolvedor, quero um teste pgTAP que prove as métricas com cobranças e assinaturas montadas na transação, para a regra não regredir sem aviso.
25. Como Gerente, quero ver uma confirmação que some sozinha depois de cancelar a assinatura, para saber que o cancelamento valeu sem ficar com um aviso preso na tela.
26. Como Gerente, quero que a confirmação do cancelamento diga até quando o acesso continua, para saber quanto tempo ainda tenho.
27. Como Gerente que cancelou, quero navegar pelo painel sem uma faixa fixa no topo, para trabalhar sem ser lembrado toda hora de uma decisão que eu mesmo tomei.
28. Como Gerente que cancelou, quero ver "Cancelada até DD/MM" e o botão "Assinar de novo" em Ajustes > Assinatura, para consultar a situação e voltar atrás quando eu quiser.
29. Como Gerente cuja assinatura cancelada chegou ao fim do período pago, quero a tela de bloqueio com a explicação, para saber por que perdi o acesso e como voltar.
30. Como Gerente em teste, com pagamento recusado ou com acesso liberado à mão, quero que a faixa de aviso continue fixa no topo, porque nesses casos preciso agir.
31. Como desenvolvedor, quero que o Estado de Acesso devolvido pelo banco para a cancelada continue o mesmo (`warning` com o motivo `canceled`), para o Canal do Cliente, o WhatsApp e o porteiro do painel não mudarem de comportamento.

## Implementation Decisions

- **A regra mora no banco, numa RPC só.** `public.get_admin_dashboard_metrics()` continua sendo a única fonte do painel (security definer, `search_path` vazio, `EXECUTE` só para `authenticated`) e é reescrita por migration. A guarda passa a ser `private.assert_saas_admin()`, a mesma das Ferramentas do Proprietário (recusa com `ADMIN_ONLY`/42501), no lugar do `if not exists ... raise exception` com texto livre.
- **Contrato novo da RPC** (jsonb), com os nomes acompanhando o sentido:
  - `mrr` (numeric): soma, para cada assinatura `active` ou `past_due`, do preço do plano agendado (`scheduled_plan_id`) quando houver, senão do plano atual. Entra também a `canceled` que assinou de novo e teve a assinatura nova autorizada, reconhecida pelo Estado de Acesso (`allowed` com o motivo `active`), e não por uma cópia do critério.
  - `revenue_this_month` (numeric): soma de `billing_charges.amount` com `status = 'approved'` e `charged_at` no mês corrente de `America/Sao_Paulo`.
  - `released_tenants` (integer): barbearias com `private.tenant_access_state(tenant, now())` em `allowed` ou `warning`. Substitui `active_tenants`.
  - `blocked_tenants` (integer): barbearias com Estado de Acesso `blocked`. Substitui `suspended_tenants`.
  - `revenue_trend` (array de 12 itens, do mais antigo ao mês corrente): `month` (`YYYY-MM`) e `revenue` (o `month_label` em inglês do `to_char` saiu depois da entrega: a tela monta o nome do mês em português a partir de `month`), com zero no mês sem cobrança aprovada; mesma regra e mesmo fuso de `revenue_this_month`.
- **Barbearia sem linha de assinatura** não entra em nenhum contador (o Estado de Acesso dela não é calculável); a migration do ticket 03 deu assinatura a todas, então isso só cobre dado quebrado.
- **O mês é de Brasília**, fixo, porque o painel é da plataforma e as barbearias têm fusos diferentes; as datas por barbearia continuam sendo do fuso dela nas Ferramentas do Proprietário.
- **A tela** (`Admin > Dashboard`) lê os campos novos, troca os rótulos para "Barbearias liberadas" ("com acesso liberado agora") e "Barbearias bloqueadas" ("com acesso bloqueado agora"), e mantém MRR, faturamento e gráfico como estão visualmente.
- **`public.invoices` sai**: um ticket confere, só com leitura, que a tabela está vazia no DEV e (com o OK do usuário) na PROD, e uma migration a remove junto com as policies e o índice. Se a PROD tiver linhas, o ticket para e volta ao usuário. `docs/modelagem_banco.md` acompanha.
- **Cabeçalho único do Admin**: um componente compartilhado, usado por `Admin > Dashboard` e `Admin > Barbearias`, com logo, as duas abas (a atual marcada), o nome e o papel do usuário (escondidos em tela estreita, como hoje) e o Sair. Em 375 px nada passa da largura da tela. O componente recebe o nome do usuário e a ação de sair; cada página continua buscando o nome como hoje.
- **A faixa da cancelada sai e a confirmação vira toast, só no front.** O Estado de Acesso não muda: o banco continua devolvendo `warning` com o motivo `canceled` e a data relevante (o fim do período pago), porque o porteiro, o Canal do Cliente e o WhatsApp dependem desse estado. O layout do Gerente deixa de mostrar a faixa de aviso quando o motivo é `canceled`; os outros motivos de `warning` seguem com a faixa. Ao cancelar, a tela de Assinatura mostra um toast com o texto que a faixa tinha ("Assinatura cancelada. Acesso até DD/MM.", ou só "Assinatura cancelada." quando não há data), que some pela duração padrão dos toasts do app. A mensagem passageira dentro da própria seção ("Assinatura cancelada." no lugar do botão enquanto a assinatura é relida) fica como está, porque guarda o botão contra um segundo clique. O toast aparece uma vez, na hora do cancelamento: quem cancelou e volta no dia seguinte não vê aviso nenhum além da situação em Ajustes.
- **Ordem**: a migration vai só para o DEV (`selvxobcjbkligxighlp`) pelo MCP. A PROD recebe tudo na promoção da spec 052, que ainda não tem spec; esta spec depende de `billing_charges`, `private.tenant_access_state` e `private.assert_saas_admin`, que só existem com a 052.

## Testing Decisions

- **Bom teste aqui** prova o comportamento que o Proprietário vê (os números devolvidos para um conjunto conhecido de assinaturas e cobranças; o texto e a largura da tela), e não como a função monta a consulta.
- **Seam 1: a RPC, por pgTAP** (`supabase/tests/database/80_painel_do_proprietario.test.sql`, rodado pelo MCP em `begin; ... rollback;`). Monta barbearias na transação, uma por situação (`trialing`, `active`, `past_due`, `blocked`, `canceled` com e sem período pago, `courtesy`, desbloqueada à mão, teste vencido sem bloqueio gravado, `active` com descida agendada) e cobranças `approved`, `rejected`, `in_process` e `refunded`, inclusive uma na virada do mês em Brasília e outra 13 meses atrás. Compara com o estado real do DEV somando por diferença (antes e depois de inserir), para não depender das barbearias de teste que já existem. Prova a guarda para Gerente, Barbeiro, anônimo e Gerente com `tenant_id` nulo. Prior art: `78_ferramentas_do_proprietario.test.sql` (matriz de autorização e datas de borda por fuso).
- **Seam 2: a tela, por Vitest** (`Dashboard.test.tsx`, que já mocka `supabase.rpc`): os rótulos novos com os campos novos do contrato, e o gráfico com meses zerados.
- **Seam 3: o cabeçalho, por Vitest e navegador.** Vitest prova que as duas páginas usam o mesmo componente, que a aba atual fica marcada e que Sair chama a saída. jsdom não mede largura: a prova de "cabe em 375 px" é no navegador (Browser pane com `resize_window` em mobile), com `document.documentElement.scrollWidth` igual a `clientWidth` nas duas rotas.
- **Seam 4: o layout do Gerente e o cancelamento, por Vitest** (`GerenteLayout.test.tsx` e `CancelarAssinatura.test.tsx`, que já cobrem a faixa da cancelada e o cancelamento). Com o Estado de Acesso `warning` e o motivo `canceled`, a faixa não aparece; ao cancelar, o toast com a data aparece e some depois da duração padrão (timers falsos); com os motivos teste terminando, pagamento recusado e acesso liberado à mão, a faixa continua aparecendo. O teste que hoje exige a faixa depois do cancelamento passa a exigir o toast. Prior art: os testes das outras telas que mockam `useToast` e os da própria faixa. A barbearia MP Teste do DEV está cancelada com acesso até 03/11 desde 2026-10-03 (a assinatura dela no Mercado Pago foi cancelada no teste), então abrir o painel dela mostra a faixa antes da correção e nada depois; o toast só se vê cancelando uma assinatura viva (novo checkout, que o usuário digita), então a prova dele fica nos testes.
- Gates de sempre: `rtk proxy npx oxlint src supabase/functions`, Vitest completo rodando sozinho, `npm run build`.

## Out of Scope

- Promover esta spec ou a 052 para a PROD.
- Levar `Admin > Barbearias` e `Admin > Dashboard` ao padrão de módulo (repositório e adaptador): continuam chamando o Supabase direto, como hoje (anotado no ticket 15 da 052).
- Receita líquida de taxas do Mercado Pago, previsão de churn, coortes ou qualquer métrica nova além das quatro e do gráfico.
- Ajustes de acessibilidade da gaveta compartilhada (`Drawer` não leva, prende nem devolve o foco): problema antigo, de outra spec.
- O cartão sem os 4 últimos dígitos na assinatura criada pelo checkout do Mercado Pago (o final só vem na primeira cobrança).
- Um lembrete perto do fim do acesso de quem cancelou (e-mail ou faixa nos últimos dias): hoje o ticket 08 da 052 só avisa teste terminando, pagamento recusado e bloqueio. Se quem cancelou deve ser avisado antes de o acesso fechar, é decisão e spec à parte.
- Tornar dispensáveis as faixas que pedem providência (teste terminando, pagamento recusado, acesso liberado à mão).

## Further Notes

- Achado no teste das specs 052 e 053 no site de DEV, logado como Proprietário, em 2026-10-03 (achados 4 e 5 da rodada). A faixa fixa da cancelada (problema 4) foi apontada pelo usuário, com captura de tela, logo depois do teste de cancelar a assinatura como Gerente da barbearia MP Teste, no mesmo dia.
- O nome da spec e da pasta ficou "painel do Proprietário" porque nasceu dos problemas 1 a 3; o problema 4 é do painel do Gerente.
- O texto e as consultas que provaram o problema são só de leitura no DEV; a PROD não foi consultada.
- Rótulos do gráfico: ficaram como estavam na entrega (`TMMonth YY`, em inglês pelo idioma do banco); depois o `month_label` saiu da RPC e a tela passou a mostrar o mês em português (`Set/26` no eixo, `Setembro de 2026` no tooltip).

## Fechamento

Fechada em 2026-10-05. Os cinco tickets estão `done` (`.scratch/painel-do-proprietario/issues/`), mergeados na `dev` por fast-forward e enviados por push, com as migrations só no DEV. Os quatro problemas estão resolvidos e conferidos no site de DEV (`dev.navalhado.com.br`):

1. Faturamento do mês e Evolução da receita vêm das cobranças aprovadas, no mês de Brasília.
2. MRR pela próxima cobrança e Barbearias liberadas e bloqueadas pelo Estado de Acesso.
3. Cabeçalho único do Admin, que cabe em 375 px.
4. A confirmação do cancelamento é um toast, e a faixa fixa da cancelada saiu do painel do Gerente.

`public.invoices` saiu do banco (0 linhas no DEV e na PROD; a PROD foi só consultada).

Mudanças depois da entrega, a pedido do usuário: os meses do gráfico em português (a tela monta o nome a partir de `month`) e o `month_label` fora da RPC; o MRR inclui a cancelada que assinou de novo e teve a assinatura nova autorizada (reconhecida pelo Estado de Acesso `allowed` com o motivo `active`). Decidido manter: a `past_due` com 5 dias ou mais conta em bloqueadas e segue no MRR até a rotina diária gravar o bloqueio.

Versões das migrations (todas só no DEV): `20261003204038`, `20261003204455`, `20261003231247`, `20261003232615`, `20261004004203` e `20261004011352`. pgTAP `80_painel_do_proprietario` com 34 asserções e `65` com 76, ambos verdes; Vitest completo verde.

Fica fora desta spec, como já estava em Out of Scope: promover esta spec e a 052 para a PROD (as migrations seguem em ordem de versão, a 02 e a 03 antes da 04). O toast do cancelamento só foi provado pelos testes, porque exige cancelar uma assinatura viva.
