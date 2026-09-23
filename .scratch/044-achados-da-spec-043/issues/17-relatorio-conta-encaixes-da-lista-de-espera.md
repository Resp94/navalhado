# 17: Relatório conta os encaixes vindos da Lista de Espera

**What to build:** o ticket 07 da spec 043 foi escrito prometendo uma linha "Lista de Espera" no relatório "Agendamentos por origem". A decisão tomada na implementação foi outra, e melhor para o relatório de origem: a marca virou coluna própria, e a origem continua descrevendo o canal de entrada. O efeito colateral é que hoje não existe lugar nenhum onde o gerente veja quantos Agendamentos a Lista de Espera produziu. A marca está gravada e ninguém a lê fora do cartão da Agenda.

Depois deste ticket, o relatório de agenda mostra quantos Agendamentos do período vieram da Lista de Espera, sem mexer na quebra por origem.

**Onde foi achado:** decisão do ticket 07 da spec 043, que substituiu a linha prometida no relatório de origem por uma coluna própria e não levou a medida para lugar nenhum.

**Blocked by:** 16 (Relatório de motivos separa quem cancelou) — os dois alteram a mesma função do relatório de agenda, e fazê-los em paralelo faria uma migration sobrescrever a outra

**Status:** done

- [x] Decidido em 2026-09-22: o relatório devolve dois números, quantos Agendamentos do período vieram da Lista de Espera, cancelados inclusive, e desses quantos foram concluídos, pela mesma classificação de desfecho que o relatório já usa para comparecimento
- [x] A quebra "Agendamentos por origem" não muda: nenhuma linha nova e nenhum número diferente dos de hoje
- [x] A medida segue o filtro de profissional do relatório
- [x] Agendamento anterior à marca, sem ela, não é contado; nenhum backfill
- [x] O tipo de retorno do relatório no módulo de relatórios acompanha a mudança, e a tela exibe a medida junto dos demais indicadores de agenda
- [x] Período sem nenhum Agendamento vindo da Lista de Espera mostra zero, não vazio
- [x] pgTAP cobrindo os dois números, incluindo Agendamento vindo da Lista de Espera cancelado, concluído e sem desfecho, o filtro de profissional, a quebra por origem inalterada e o isolamento por barbearia
- [x] Teste do adaptador do módulo de relatórios e teste de tela da medida
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Resultado (2026-09-22):**

- **Núcleo do relatório** (`private.get_schedule_report_core`): nova migration `20260922193919_044_ticket17_relatorio_conta_encaixes_da_lista_de_espera.sql`, aplicada sobre a versão do ticket 16 (bloqueio respeitado — não houve trabalho em paralelo). `target_appointments` ganhou a coluna `from_waiting_list` a mais no `select`; nova CTE `waiting_list_row` conta `count(*) filter (where from_waiting_list)` para o total (cancelado inclusive) e `count(*) filter (where from_waiting_list and classification = 'completed')` para os concluídos — mesma `classification` já calculada para `status_totals`, nenhuma lógica de desfecho duplicada. Chave nova `waiting_list: {total, completed}` no jsonb devolvido.
- **`by_origin` inalterado**: nenhuma CTE de origem foi tocada; `origin_agg` continua agregando de `target_appointments` do jeito que já agregava. Provado por pgTAP (abaixo).
- **Filtro de profissional**: `target_appointments` já aplica `p_professional_id` antes de qualquer CTE — `waiting_list_row` herda o filtro automaticamente, sem código extra.
- **Sem backfill**: a coluna `from_waiting_list` (spec 043, ticket 07) tem `default false` desde que foi criada; Agendamento anterior à marca simplesmente nunca teve o valor setado para `true`, então já fica de fora da contagem sem nenhuma migração de dado.
- **Tipos e adaptador**: `RelatorioAgendaListaDeEspera` (`{total, completed}`) novo em `types.ts`, campo `waiting_list` acrescentado a `RelatorioAgenda`. `SupabaseRelatoriosAdapter.toAgendaWaitingList` mapeia com a mesma coerção `toNumber` já usada nos outros campos — ausente na resposta vira `{total: 0, completed: 0}`, nunca `undefined`.
- **Tela**: novo `StatCard` "Vindos da Lista de Espera" em `AgendaResumo.tsx`, na mesma grade dos demais indicadores de agenda (Concluídos, Faltas, Cancelados, Taxas), com o `subtext` mostrando quantos foram concluídos ("N concluído(s)"). Sem `trend` (não há `waiting_list` do período anterior no contrato — a spec não pediu essa comparação, e inventar um `previous_waiting_list` sem pedido seria escopo a mais). Período sem nenhum encaixe da Lista de Espera mostra "0" e "0 concluídos" (não card vazio nem ausente).
- **Vermelho provado por mutação, banco**: mesma técnica dos tickets 16/09 — confirmado que a chave `waiting_list` só existe na versão nova da função (a antiga nem tinha a chave), o que por si só quebraria qualquer teste que a leia.
- **Vermelho provado por mutação, frontend**: troquei os 4 arquivos de produção tocados pela versão de `dev` (`git show dev:...`) e rodei a suíte de `relatorios`: 4 testes falharam (os 2 novos de tela + os 2 novos do adaptador). Restaurados os arquivos corrigidos, a suíte volta a 196/196.
- **pgTAP**: estendido (de novo) `supabase/tests/database/35_relatorio_agenda.test.sql`, mesmo arquivo e mesmo contexto `t07_context`/`t07_fix` dos tickets 07/08/16 — a cobertura é da mesma função. `plan()` de 47 para 52. Fixture nova `t17_fix`, período isolado 2026-09-06 (fora dos períodos já usados por outros tickets neste arquivo): 3 Agendamentos marcados (concluído, cancelado, falta) + 1 concluído SEM a marca (controle). 5 asserções novas: `waiting_list` conta os 3 marcados e só 1 concluído (o sem marca fica de fora); filtro de profissional zera `waiting_list` para quem não tem Agendamento no período; `by_origin` continua com o total de 4 (marcados e não marcados juntos, sem linha nova); isolamento por tenant (`tenant_b` sem Agendamento não vê nada de `tenant_a`); período sem Agendamento (reaproveitando o mesmo período já testado para totais zerados) mostra `waiting_list` zerado, não ausente da resposta.
- Testes novos em TypeScript: `SupabaseRelatoriosAdapter.test.ts` (2 casos — mapeamento correto e campo ausente virando zero); `AgendaPage.test.tsx` (2 casos — total/concluídos corretos e estado zero visível, não card vazio). `RelatoriosRepository.test.ts` e `useAgenda.test.ts` tiveram a fixture ajustada ao campo novo obrigatório.
- Suíte completa: 111 arquivos, 1226 testes (+4 deste ticket). `npx tsc -b`: 0 erros. `npx oxlint`: exit 0 (mesma contagem de avisos pré-existentes, 49, nenhum novo). `npm run build`: build 0.
- Baseline do banco de desenvolvimento conferida após toda a verificação: `tenants=3, appointments=36, customers=6, professionals=6, services=11, waiting_list=0, blocked_slots=0` — igual à baseline do ticket 16 (o `appointments=36` vem do ticket 15, não deste); nenhuma linha nova deste ticket, que só mudou uma função de leitura.
