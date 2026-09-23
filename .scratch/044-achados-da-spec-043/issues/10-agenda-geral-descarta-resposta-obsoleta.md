# 10: Agenda Geral descarta resposta obsoleta na troca rápida de dia

**What to build:** trocar de dia dispara uma leitura da agenda. Trocar de dia de novo antes da primeira responder dispara outra. Se a primeira responder depois da segunda, a tela mostra os Agendamentos do dia errado, com o cabeçalho indicando o dia certo.

A Minha Agenda do barbeiro já resolve isso: ela numera as leituras e ignora a resposta que não é a mais recente. A Agenda Geral não, e desde a spec 043 o mesmo vale para o contador de cancelamentos e para o Painel de Cancelados do Dia, que passaram a vir da mesma leitura.

Depois deste ticket, a Agenda Geral ignora resposta obsoleta como a Minha Agenda já ignora.

**Onde foi achado:** limite registrado no ticket 05 da spec 043.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Resposta de uma leitura já superada não altera a grade, o contador de cancelamentos nem o Painel de Cancelados do Dia
- [x] A leitura mais recente sempre vence, qualquer que seja a ordem de chegada das respostas
- [x] Vale para troca de dia, troca de semana e troca entre visão de dia e de semana
- [x] O indicador de carregamento não fica preso ligado quando uma resposta obsoleta chega por último
- [x] A falha de uma leitura obsoleta não mostra aviso de erro na tela, porque o usuário já pediu outro dia
- [x] A leitura de Bloqueios de Horário recebe o mesmo tratamento, já que também acompanha o dia
- [x] Teste de tela reproduzindo a inversão: duas trocas de dia, a primeira resposta chegando por último, e a grade mostrando o dia pedido por último
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Resultado (2026-09-22):**

- **Achado ao investigar:** o componente `Agenda` (`src/pages/gerente/Agenda.tsx`) é compartilhado — a spec 045 (Grade Temporal desktop na Minha Agenda do barbeiro, mesclada em `dev` pouco antes deste ticket) passou a embutir esse mesmo componente, travado por profissional (`lockedProfessionalId`), como a grade da Minha Agenda. Ou seja, a Agenda Geral e a grade da Minha Agenda já rodam o mesmo código de leitura hoje; corrigir `Agenda.tsx` corrige as duas ao mesmo tempo. (O `fetchDay`/`latestDayRequest` próprio que `MinhaAgenda.tsx` ainda mantém — a referência do ticket a "a Minha Agenda já resolve isso" — segue existindo, mas hoje alimenta só os modais da tela, não mais a grade visual.)
- **Correção:** `fetchAppointments` e `fetchBlockedSlots`, cada uma com seu próprio número de sequência (`latestAppointmentsRequest`, `latestBlockedSlotsRequest`, incrementado no início de cada chamada). Depois do `await`, se o número da chamada não bate mais com o mais recente, a resposta é descartada — sem alterar estado, sem tocar o indicador de carregamento, sem mostrar erro. Mesmo padrão que `MinhaAgenda.tsx` já usava em `fetchDay`, adaptado para duas leituras independentes (a falha de uma não esconde a outra, comportamento pré-existente preservado).
- Cobre troca de dia, de semana e entre as duas visões porque `fetchAppointments`/`fetchBlockedSlots` são a mesma função para as três: o intervalo (`startIso`/`endIso`) já reagia a `viewMode`/`weekDays`/`selectedDate` antes deste ticket; só a numeração de sequência é nova.
- **Indicador de carregamento:** o `finally` de `fetchAppointments` só desliga `loading` (e agenda o fim da transição de troca de dia) quando a chamada que terminou ainda é a mais recente. Uma leitura obsoleta que responde por último não mexe no indicador — quem desliga é sempre a leitura válida.
- Teste de tela novo em `src/pages/__tests__/Agenda.test.tsx` (describe "Resposta obsoleta descartada ao trocar de dia rápido"), duas asserções:
  - Reproduz a inversão para Agendamentos: duas leituras pendentes (controladas manualmente via promises seguradas no teste), a mais recente resolvida primeiro, a mais antiga depois — o nome do cliente da leitura antiga nunca aparece na tela, nem antes nem depois dela resolver; o indicador de carregamento acaba desligando sozinho.
  - O mesmo para Bloqueios de Horário, com o mesmo padrão de inversão.
  - **Vermelho provado por mutação:** os dois testes rodados contra o `Agenda.tsx` de antes deste ticket (`git show dev:...`) falham exatamente como esperado (o nome/motivo da leitura obsoleta aparece na tela). Restaurado o código corrigido, os dois passam.
- **Verificado no navegador** (dev server local, sessão de barbeiro já aberta): três cliques rápidos em "Próximo Dia" na Minha Agenda (que usa o `Agenda` corrigido) terminaram exatamente no dia pedido (3 dias à frente), sem erro no console e sem grade travada.
- Suíte completa da aplicação: 110 arquivos, 1200 testes (+2 deste ticket). `npx tsc -b`: 0 erros. `npx oxlint`: exit 0. `npm run build`: build 0.
- Sem migration: mudança só de código de aplicação. Contagens do banco no ambiente de desenvolvimento conferidas antes e depois, sem alteração: `tenants=3, appointments=35, customers=6, professionals=6, services=11, waiting_list=0, blocked_slots=0`.
