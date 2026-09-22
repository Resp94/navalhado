# 11: Falha ao ler Bloqueios de Horário é sinalizada na tela

**What to build:** quando a leitura de Bloqueios de Horário falha, a Agenda Geral abre normalmente, com os Agendamentos no lugar e nenhum Bloqueio. O erro vai só para o registro do console. Para quem está na recepção, a grade parece correta e mostra como livres horários que estão bloqueados, o que leva a agendar em cima de um bloqueio.

O isolamento de falha é o comportamento certo e foi restaurado no ticket 08 da spec 043: a falha de Bloqueios não deve esconder os Agendamentos. Falta a outra metade, dizer ao usuário que aquela parte da grade não carregou.

Depois deste ticket, a grade continua abrindo, e quem a lê sabe que os Bloqueios não estão ali.

**Onde foi achado:** limite registrado no ticket 08 da spec 043, que restaurou o isolamento de falha e deixou a falha sinalizada só no console, como era antes do ticket 03 da spec 043. O mesmo limite registra que a falha não foi provada no navegador, só em teste de tela.

**Blocked by:** 10 (Agenda Geral descarta resposta obsoleta na troca rápida de dia) — os dois mexem nas mesmas funções de leitura da Agenda Geral, e o 10 muda a forma delas

**Status:** done

- [x] Falha na leitura de Bloqueios de Horário é sinalizada na Agenda Geral, de forma visível para quem olha a grade
- [x] Os Agendamentos continuam aparecendo; a falha de Bloqueios nunca esconde a grade
- [x] O aviso some quando uma leitura seguinte tem sucesso
- [x] O aviso distingue "não carregou" de "não há Bloqueio neste dia"
- [x] A Minha Agenda do barbeiro recebe o mesmo tratamento, onde a falha também é silenciosa hoje
- [x] A falha na leitura de Agendamentos continua com o aviso que já existe, sem duplicar mensagem quando as duas falham
- [x] O aviso segue o design system: sem fundo sólido de alerta ocupando a grade, e sem cor fora dos tokens
- [x] Teste de tela cobrindo o aviso presente na falha, ausente no sucesso, e a grade com os Agendamentos nos dois casos
- [x] Verificado no navegador forçando a falha da leitura de Bloqueios de Horário, nas duas agendas
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Resultado (2026-09-22):**

- **Um só ponto de correção para as duas agendas:** o ticket 12 desta spec já tinha achado que `MobileAgendaView.tsx` é sempre renderizado por `Agenda.tsx` (escondido por CSS, não por condicional de JS), e que a Minha Agenda do barbeiro embute o mesmo `Agenda` travado por profissional. `fetchBlockedSlots` (a leitura de Bloqueios) é uma função só, usada pelas duas telas; corrigir ali resolve as duas de uma vez, como já tinha acontecido no ticket 12.
- `blockedSlotsComErro` (estado booleano) passa a `false` a cada sucesso e `true` a cada falha de `fetchBlockedSlots`, respeitando a mesma guarda de resposta obsoleta que o ticket 10 desta spec introduziu (uma leitura que já não é a mais recente não mexe no estado). Isso cobre sozinho o critério "o aviso some quando uma leitura seguinte tem sucesso": a próxima leitura bem-sucedida sempre desliga.
- **Aviso segue o design system:** `bg-warning-bg border-warning text-warning` — o mesmo trio de tokens que `Badge`'s variante `warning` (`subtle`) já usa, sem fundo sólido e sem hexadecimal solto. Uma faixa compacta (`role="status"`) acima da grade no desktop e acima da lista no celular, nunca ocupando o espaço da grade em si — os Agendamentos continuam visíveis do mesmo jeito.
- **Distingue "não carregou" de "não há Bloqueio":** o aviso só aparece quando `blockedSlotsComErro` é `true` (a leitura falhou); um dia sem nenhum Bloqueio, com a leitura bem-sucedida, mostra a grade vazia de Bloqueios normalmente, sem aviso nenhum — são dois estados de `blockedSlots`/`blockedSlotsComErro` independentes.
- **Sem duplicar aviso com a falha de Agendamentos:** as duas leituras (`fetchAppointments`, `fetchBlockedSlots`) continuam independentes, cada uma com seu próprio aviso (o toast de erro para Agendamentos, já existente desde antes; a faixa nova para Bloqueios) — não há caminho em que as duas mensagens se sobrepõem ou se substituem.
- **Vermelho provado por mutação:** os três testes novos rodados contra `Agenda.tsx` e `MobileAgendaView.tsx` de antes do ticket falham como esperado (o texto do aviso nunca aparece, mesmo forçando a falha). Restaurado o código corrigido, os três passam.
- **Verificado no navegador**, sessão de barbeiro já aberta: interceptei `window.fetch` no console da página (script de depuração, não alteração do app) para fazer toda requisição a `blocked_slots` devolver `500`, sem mexer em Agendamentos. Trocando de dia com o intercepto ativo: o aviso apareceu na grade desktop e na lista mobile (375px), com os Agendamentos e os horários "Toque para agendar" intactos nos dois. Restaurado o `fetch` original e trocado de dia de novo: o aviso sumiu sozinho, sem F5.
- Testes de tela novos em `src/pages/__tests__/Agenda.test.tsx` (describe "aviso de falha na tela", dentro de "Bloqueios de Horário lidos por caminho único"): aviso presente na falha (grade e visão de celular, 2 ocorrências) com os Agendamentos intactos; aviso ausente quando a leitura simplesmente não tem Bloqueio no dia; aviso some sozinho após uma leitura seguinte com sucesso.
- Suíte completa da aplicação: 110 arquivos, 1209 testes (+3 deste ticket). `npx tsc -b`: 0 erros. `npx oxlint`: exit 0. `npm run build`: build 0.
- Sem migration: mudança só de código de aplicação. Contagens do banco no ambiente de desenvolvimento conferidas depois de toda a verificação: `tenants=3, appointments=35, customers=6, professionals=6, services=11, waiting_list=0, blocked_slots=0` — idênticas à linha de base do ticket 01.
