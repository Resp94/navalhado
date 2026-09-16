# 07: Comparecimento, cancelamento e no-show

**What to build:** o gestor abre a página Agenda e vê quantos Agendamentos do período foram
concluídos, cancelados, marcados como falta ou continuam sem desfecho, com a taxa de comparecimento
e a taxa de cancelamento comparadas ao período anterior, separadas por origem (Painel, Link público,
Canal do Cliente, WhatsApp) e por profissional, e os motivos de cancelamento agrupados. Assim ele
sabe quanto da agenda virou atendimento e se o agendamento online traz cliente que aparece.

A base são os Agendamentos com início no período. Agendamento sem Desfecho é o pendente, confirmado
ou em andamento com início já passado: fica fora das taxas e aparece em destaque, avisando que a
recepção precisa atualizar o status. Agendamento futuro dentro do período não entra nas taxas.

Spec: `specs/038-modulo-de-relatorios/spec.md`, seção "6–7. `get_schedule_report`" e histórias 42 a
49.

**Blocked by:** 01 — Esqueleto do módulo e Faturamento por período; 04 — Gráfico de evolução e
exportação CSV.

**Status:** done

- [x] Contrato de leitura da Agenda recebe tenant, datas e profissional opcional, e devolve fuso, dia
      de negócio de hoje, período, período anterior, totais por status do período e do anterior
      (total, concluídos, faltas, cancelados, sem desfecho, futuros, taxa de comparecimento, taxa de
      cancelamento), totais por origem, totais por profissional e motivos de cancelamento.
- [x] Mesmo padrão de função pública, núcleo privado com relógio injetado, acesso e validação de
      período do ticket 01.
- [x] Taxa de comparecimento = concluídos ÷ (concluídos + faltas); taxa de cancelamento = cancelados ÷
      (total − futuros); denominador zero devolve vazio.
- [x] Sem desfecho e futuros classificados pelo instante atual; futuros ficam fora das taxas.
- [x] Motivos de cancelamento normalizados (sem espaços nas pontas, sem diferença de maiúsculas),
      vazio como "Sem motivo informado", ordenados por frequência, dez primeiros mais "Outros".
- [x] Profissional informado filtra os totais, a origem e os motivos, mas não a lista por
      profissional; inativos e arquivados com Agendamento no período aparecem marcados.
- [x] Índice de Agendamentos por tenant e início, **sem filtro**, criado se ausente: o índice
      existente com esse par exclui os cancelados, e este relatório precisa justamente deles.
- [x] Totais por status, por origem, por profissional e motivos de cancelamento agregados cada um na
      própria CTE antes de juntar, para não multiplicar contagens.
- [x] Arquivo pgTAP `35_relatorio_agenda` cobrindo acesso, validação, cada status (incluindo
      confirmado passado como sem desfecho e futuro), taxas com denominador zero, motivos e fuso.
- [x] Repositório, adaptador (preservando taxas vazias) e hook da página, com testes.
- [x] Rota `/relatorios/agenda` no layout do módulo; catálogo passa a linkar o relatório.
- [x] Página com cartões de status e taxas com variação vs período anterior, aviso de Agendamentos
      sem Desfecho, tabelas por origem e por profissional, lista de motivos, seletor de profissional,
      estados vazio, carregando e erro e "Exportar CSV", só em layout desktop.
- [x] Teste da página com repositório falso cobrindo o aviso de sem desfecho e taxa vazia.
- [x] `CONTEXT.md` ganha Agendamento sem Desfecho e Taxa de Comparecimento.
- [x] `npm run test` e pgTAP verdes.
