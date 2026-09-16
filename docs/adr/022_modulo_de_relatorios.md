# ADR 022: Módulo de Relatórios

## Status

Aceita em 2026-09-15.

## Contexto e Problema

A spec 038 introduz um módulo de análise gerencial — Faturamento, Equipe e Serviços, Agenda,
Clientes, Clientes sem Retorno — cada relatório cruzando fatos que hoje já existem em livros
próprios (Comanda, Agendamento, Cadastro de Cliente). Três decisões atravessam toda a spec e
valiam a pena registrar juntas: onde o módulo mora em relação ao Hub Financeiro, quantos contratos
de leitura ele expõe, e onde vivem as regras de negócio que mais de um relatório compartilha.

## Decisões Tomadas

1. **Relatórios vive em rota própria (`/relatorios`), fora do Hub Financeiro, e é exclusivo do
   desktop.** Analisar séries históricas e tabelas densas de várias colunas não é a mesma tarefa
   que operar o caixa do dia ou lançar uma Baixa — misturar as duas dentro do Hub Financeiro
   sobrecarregaria uma navegação pensada para operação diária. Em largura de tela `<= 768px` a
   tela mostra um aviso e não chama nenhum contrato — nunca tenta renderizar (nem carregar dados
   de) uma tabela densa que não cabe em tela de celular.

2. **Um contrato de leitura (RPC) por página do módulo, nunca por relatório individual nem um
   contrato genérico, e sem persistência ou rollup.** Faturamento, Equipe e Serviços, Agenda,
   Clientes e Clientes sem Retorno são cinco RPCs — uma por página, cada uma calculando tudo que a
   página precisa a partir dos livros de origem, a cada consulta. Um contrato por relatório
   individual multiplicaria round-trips para telas que mostram vários números relacionados de uma
   vez; um contrato genérico (parametrizado por "métrica" ou "dimensão") empurraria para o cliente
   a responsabilidade de montar uma consulta seguro, o mesmo erro que a spec 037 já evitou ao
   recusar reaproveitar `cash_movements` como fonte única. Nenhum número é pré-calculado ou
   guardado em tabela de rollup: cada consulta lê os livros de origem na hora, pelo mesmo motivo
   que a média por dia da semana do Fluxo de Caixa Projetado (ADR 021) não persiste — persistir
   criaria uma fonte de verdade paralela, defasada a cada novo lançamento.

3. **Regras de domínio compartilhadas por mais de um relatório — Receita Reconhecida de Item e
   Visita — vivem em funções `private` (SQL, `STABLE`, sem `GRANT` a `authenticated` nem
   `anon`), nunca duplicadas dentro de cada contrato.** Faturamento e Equipe e Serviços concordam
   sobre o que conta como receita de um item de Comanda (aberta e cancelada não contam, `reverted`
   não conta, `unavailable` conta por `total_price`); Agenda e Clientes concordam sobre o que conta
   como Visita. Escrever a mesma regra dentro de cada RPC arriscaria as duas cópias divergirem
   silenciosamente na primeira mudança que só lembrasse de corrigir uma delas; `STABLE` deixa o
   otimizador reaproveitar o resultado dentro da mesma consulta, e a ausência de `GRANT` deixa
   essas funções inacessíveis fora das RPCs que as chamam — não é uma leitura pública nova, é
   lógica interna fatorada.

## Consequências

- Um sexto relatório futuro que precise de receita por item ou de contagem de Visita reaproveita
  as mesmas duas funções `private` — não recalcula a regra, não adiciona parâmetro genérico às
  RPCs existentes.
- As duas funções `private` não ganham teste (pgTAP) próprio: são cobertas pelos contratos que as
  usam, no mesmo padrão de seam já adotado pela spec 037.
- Uma tela do módulo aberta em `<= 768px` nunca deve disparar a consulta ao contrato de leitura
  "só para ter os dados prontos quando a tela crescer" — o bloqueio é também de chamada, não só de
  exibição.
- Divergir Faturamento de Equipe e Serviços sobre o que conta como receita de item (ou Agenda de
  Clientes sobre o que conta como Visita) é sinal de bug na função `private`, nunca de "regra de
  negócio específica daquele relatório" — os testes cruzados da spec 038 existem para pegar essa
  divergência cedo.
