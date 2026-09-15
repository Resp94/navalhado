# 06: Ranking de serviços

**What to build:** na página Equipe e Serviços, o gestor vê os serviços ordenados por faturamento
líquido e por quantidade executada, com participação no faturamento de serviços e valor médio
cobrado por execução, e pode filtrar pelo profissional para ver o mix de cada um. Assim ele sabe o
que sustenta a barbearia e percebe serviço com desconto frequente ou preço defasado.

O filtro de profissional afeta só a lista de serviços; o ranking de profissionais continua mostrando
todos. Serviços arquivados executados no período continuam no ranking, marcados. O nome exibido é o
atual do cadastro.

Spec: `specs/038-modulo-de-relatorios/spec.md`, seção "4–5. `get_team_services_report`" (serviços) e
histórias 38 a 41.

**Blocked by:** 05 — Ranking de profissionais.

**Status:** ready-for-agent

- [ ] O contrato de Equipe e Serviços passa a devolver a lista de serviços: serviço, nome, categoria,
      arquivado, quantidade, líquido, participação no líquido de serviços e valor médio por execução.
- [ ] Só itens de serviço entram; itens de produto ficam fora da lista.
- [ ] Profissional informado filtra só a lista de serviços; a lista de profissionais não muda.
- [ ] Serviço arquivado com item no período aparece marcado.
- [ ] Soma do líquido por serviço igual ao líquido de serviços do período (sem filtro).
- [ ] Casos novos no pgTAP `34_relatorio_equipe_e_servicos` (plano ajustado).
- [ ] Adaptador e repositório tratam o profissional opcional; testes atualizados.
- [ ] Página ganha seção "Ranking de serviços" com seletor de profissional, alternância entre ordenar
      por líquido e por quantidade, barra inline de participação e "Exportar CSV", só em layout
      desktop.
- [ ] Caso novo no teste da página cobrindo o filtro por profissional.
- [ ] `npm run test` e pgTAP verdes.
