# 10: Novos x recorrentes

**What to build:** o gestor abre a página Clientes e vê quantos clientes distintos visitaram a
barbearia no período, separados em novos (primeira Visita da vida no período) e recorrentes (já
tinham Visita antes), com a evolução ao longo do período e a comparação com o período anterior. Vê
também quantos novos ainda não voltaram, com a lista desses Clientes de Uma Visita, e quantos
atendimentos não tinham cliente identificado. Assim ele sabe se a base está crescendo ou só girando.

O relatório reusa a regra de Visita do ticket 09. Um cliente conta uma vez no período, numa só das
duas categorias. Atendimento sem cliente identificado não é Visita e aparece à parte.

Spec: `specs/038-modulo-de-relatorios/spec.md`, seção "9–10. `get_customer_report`" (novos x
recorrentes) e histórias 65 a 70.

**Blocked by:** 09 — Clientes sem Retorno.

**Status:** done

- [x] Contrato de leitura de Clientes recebe tenant, datas e granularidade, e devolve fuso, dia de
      negócio de hoje, período, período anterior, visitantes do período e do anterior (clientes
      únicos, novos, recorrentes, novos de uma visita só, atendimentos sem cliente identificado),
      agrupamentos com novos e recorrentes, e a lista de Clientes de Uma Visita (até 200, mais
      recentes primeiro).
- [x] Mesmo padrão de função pública, núcleo privado com relógio injetado, acesso, permissões de
      execução, `jsonb`, `STABLE` e validação de período e granularidade do ticket 01.
- [x] Visitantes, agrupamentos e atendimentos sem cliente agregados cada um na própria CTE antes de
      juntar, para não multiplicar contagens.
- [x] Novo conta no agrupamento da primeira Visita; recorrente conta no agrupamento da primeira Visita
      dele dentro do período.
- [x] Cliente de Uma Visita deixa de sê-lo quando há Visita posterior ao período, até hoje.
- [x] Comanda fechada sem cliente conta em atendimentos sem cliente identificado.
- [x] Arquivo pgTAP `36_relatorio_clientes` cobrindo acesso, validação, fronteira de novo x
      recorrente no início do período, Cliente de Uma Visita com Visita posterior e atendimento sem
      cliente.
- [x] Repositório, adaptador e hook da página, com testes.
- [x] Rota `/relatorios/clientes` no layout do módulo, usando o filtro de período compartilhado;
      catálogo passa a linkar o relatório.
- [x] Página com cartões (únicos, novos, recorrentes, novos de uma visita só, sem cliente
      identificado) com variação vs período anterior, gráfico de novos e recorrentes por agrupamento
      com tabela equivalente, lista de Clientes de Uma Visita com link para a Central 360º, estados
      vazio, carregando e erro e "Exportar CSV", só em layout desktop.
- [x] Teste da página com repositório falso cobrindo cartões e lista.
- [x] `CONTEXT.md` ganha Cliente Novo, Cliente Recorrente e Cliente de Uma Visita.
- [x] `npm run test` e pgTAP verdes.
