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

**Status:** done

- [x] O contrato de Equipe e Serviços passa a devolver a lista de serviços: serviço, nome, categoria,
      arquivado, quantidade, líquido, participação no líquido de serviços e valor médio por execução.
- [x] Só itens de serviço entram; itens de produto ficam fora da lista.
- [x] Profissional informado filtra só a lista de serviços; a lista de profissionais não muda.
- [x] Serviço arquivado com item no período aparece marcado.
- [x] Soma do líquido por serviço igual ao líquido de serviços do período (sem filtro).
- [x] Casos novos no pgTAP `34_relatorio_equipe_e_servicos` (plano ajustado).
- [x] Adaptador e repositório tratam o profissional opcional; testes atualizados.
- [x] Página ganha seção "Ranking de serviços" com seletor de profissional, alternância entre ordenar
      por líquido e por quantidade, barra inline de participação e "Exportar CSV", só em layout
      desktop.
- [x] Caso novo no teste da página cobrindo o filtro por profissional.
- [x] `npm run test` e pgTAP verdes.
