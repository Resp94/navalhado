# 05: Ranking de profissionais

**What to build:** o gestor abre a página Equipe e Serviços e vê os profissionais ordenados pelo
faturamento líquido gerado no período, com participação no total, atendimentos, serviços executados,
valor em produtos vendidos, ticket médio e comissão gerada, podendo reordenar por qualquer coluna.
Assim ele sabe quem mais produz e avalia o desempenho por mais de um ângulo.

A página ganha o próprio contrato de leitura, que reusa a Receita Reconhecida de Item do ticket 01.
Atendimento é Comanda distinta em que o profissional tem item de serviço; venda só de produto não é
atendimento. Comissão gerada é a do snapshot, não a paga, e a tela diz isso. Entram todos os
profissionais com item no período, inclusive inativos e arquivados, diferente do painel de Caixa e
Comissões, que lista só os ativos.

Spec: `specs/038-modulo-de-relatorios/spec.md`, seção "4–5. `get_team_services_report`" e histórias
32 a 37.

**Blocked by:** 01 — Esqueleto do módulo e Faturamento por período; 04 — Gráfico de evolução e
exportação CSV.

**Status:** ready-for-agent

- [ ] Contrato de leitura de Equipe e Serviços recebe tenant, datas e profissional opcional, e
      devolve fuso, dia de negócio de hoje, período, qualidade do dado, totais (líquido, líquido de
      serviços, atendimentos) e lista de profissionais (líquido, bruto, participação, atendimentos,
      quantidade de serviços, líquido de produtos, ticket médio, comissão gerada, ativo, arquivado).
- [ ] Mesmo padrão de função pública, núcleo privado, acesso (barbeiro, outro tenant, tenant nulo,
      `proprietario`), permissões de execução, `jsonb`, `STABLE` e validação de período do ticket 01.
- [ ] Itens de serviço e de produto agregados cada um na própria CTE antes de juntar por
      profissional: um profissional com vários serviços e vários produtos no período teria os totais
      multiplicados se as duas fontes fossem juntadas num mesmo `group by`. Um teste com dois
      serviços e dois produtos do mesmo profissional trava essa regra.
- [ ] Comanda com dois profissionais conta um atendimento para cada um, com o valor de cada item para
      quem executou.
- [ ] Venda só de produto não conta atendimento.
- [ ] Profissional arquivado ou inativo com item no período aparece marcado.
- [ ] Soma do líquido por profissional igual ao líquido total.
- [ ] Arquivo pgTAP `34_relatorio_equipe_e_servicos` cobrindo acesso, validação e as regras acima.
- [ ] Repositório, adaptador e hook da página no módulo de relatórios, com testes de validação e
      conversão.
- [ ] Rota `/relatorios/equipe-e-servicos` no layout do módulo, usando o filtro de período
      compartilhado; catálogo passa a linkar o relatório.
- [ ] Tabela de ranking com barra inline de participação, reordenação por coluna feita na tela sobre
      os dados carregados, aviso "comissão gerada, não paga", estados vazio, carregando e erro e
      "Exportar CSV"; só layout desktop, com a tabela rolando na horizontal dentro do contêiner em
      telas estreitas.
- [ ] Teste da página com repositório falso cobrindo reordenação e estado vazio.
- [ ] `npm run test` e pgTAP verdes.
