# 03: Evolução do ticket médio

**What to build:** na página Faturamento, o gestor vê o ticket médio do período, do período anterior
e de cada agrupamento, e o ticket médio de cada profissional. Assim ele sabe se cada cliente está
gastando mais ou menos e quem vende mais por atendimento.

Ticket médio é o faturamento líquido reconhecido dividido pelo número de Comandas fechadas com ao
menos um item reconhecido. Um agrupamento sem Comanda mostra o ticket vazio, nunca zero, para que um
dia fechado não pareça um dia de ticket ruim. O ticket por profissional divide o líquido dos itens do
profissional pelas Comandas distintas em que ele tem item; uma Comanda dividida conta para cada
profissional, e a tela avisa isso.

Spec: `specs/038-modulo-de-relatorios/spec.md`, seção "1–3. `get_revenue_report`" (ticket médio) e
histórias 28 a 31.

**Blocked by:** 01 — Esqueleto do módulo e Faturamento por período.

**Status:** ready-for-agent

- [ ] O contrato de Faturamento passa a devolver ticket médio nos totais do período, nos totais do
      período anterior e em cada agrupamento.
- [ ] O contrato devolve a lista de ticket por profissional: profissional, se está ativo ou
      arquivado, líquido, Comandas distintas e ticket médio, incluindo inativos e arquivados com item
      no período.
- [ ] Agrupamento ou período sem Comanda fechada devolve ticket vazio.
- [ ] Comanda com dois profissionais conta uma Comanda para cada um, com o valor de cada item para
      quem executou.
- [ ] Adaptador preserva o vazio (não converte em zero).
- [ ] Página Faturamento ganha cartão de ticket médio com variação vs período anterior, coluna de
      ticket na tabela por agrupamento e tabela de ticket por profissional com o aviso "Comanda
      dividida conta para cada profissional".
- [ ] Casos novos no pgTAP `33_relatorio_faturamento` (plano ajustado), teste do adaptador e caso
      novo no teste da página.
- [ ] `npm run test` e pgTAP verdes.
