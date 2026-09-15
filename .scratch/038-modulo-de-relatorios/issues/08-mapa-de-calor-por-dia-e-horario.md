# 08: Mapa de calor por dia e horário

**What to build:** na página Agenda, o gestor vê uma grade com os dias da semana nas colunas e as
horas nas linhas, colorida pela quantidade de Agendamentos do período, e pode filtrar por
profissional. Assim ele enxerga de relance os picos que pedem mais equipe e os horários ociosos que
pedem promoção.

O mapa conta Agendamentos não cancelados (faltas contam, porque eram demanda) pelo dia da semana e
pela hora de início no fuso do tenant. As horas exibidas cobrem do menor horário de abertura ao maior
de fechamento entre os dias ativos da barbearia, ampliadas para incluir qualquer hora com
Agendamento. É contagem de demanda, não taxa de ocupação.

Spec: `specs/038-modulo-de-relatorios/spec.md`, seção "6–7. `get_schedule_report`" (mapa de calor)
e histórias 50 a 55.

**Blocked by:** 07 — Comparecimento, cancelamento e no-show.

**Status:** ready-for-agent

- [ ] O contrato da Agenda passa a devolver o mapa de calor: horas exibidas e células com dia da
      semana, hora e quantidade.
- [ ] Cancelados fora do mapa; faltas, concluídos, sem desfecho e futuros dentro.
- [ ] Dia da semana e hora lidos no fuso do tenant; Agendamento às 19h local aparece às 19h.
- [ ] Horas exibidas derivadas do horário de funcionamento dos dias ativos e ampliadas por
      Agendamento fora dele; dia ausente ou inativo na configuração não amplia a faixa.
- [ ] Profissional informado filtra o mapa.
- [ ] Casos novos no pgTAP `35_relatorio_agenda` (plano ajustado).
- [ ] Adaptador converte o mapa; teste atualizado.
- [ ] Grade em CSS grid com intensidade proporcional à contagem, número exato visível ao tocar ou
      passar o mouse, texto acessível por célula e tabela equivalente; a leitura não depende só de
      cor.
- [ ] Só layout desktop; em telas de computador estreitas a grade rola na horizontal dentro do
      próprio contêiner, nunca a página.
- [ ] "Exportar CSV" da tabela equivalente do mapa.
- [ ] Caso novo no teste da página cobrindo a renderização das contagens.
- [ ] `npm run test` e pgTAP verdes.
