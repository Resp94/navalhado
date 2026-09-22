# 02: `MinhaAgenda` usa `Agenda` em modo travado

**What to build:** `MinhaAgenda.tsx` (a página `/minha-agenda` do barbeiro) deixa de renderizar `MobileAgendaView` diretamente e passa a renderizar o componente `Agenda` do gerente, em modo travado ao `professionalId` do barbeiro autenticado (o modo criado na ticket 01). O callback de clique num Agendamento, no modo travado, abre o mesmo bottom sheet de ações que a Minha Agenda já usa hoje (WhatsApp, Reagendar, Marcar não compareceu, Cancelar) — sem introduzir um segundo componente de menu de ações.

Resultado visível para o barbeiro: acima de 768px, a Minha Agenda mostra a Grade Temporal contínua do seu dia, com Encaixe, Bloquear horário e Cancelados do dia continuando disponíveis como hoje. Abaixo de 768px, a experiência continua exatamente como é hoje (`MobileAgendaView`).

**Blocked by:** 01 (Modo travado ao profissional em `Agenda.tsx`)

**Status:** ready-for-agent

- [x] Acima de 768px, `/minha-agenda` mostra a Grade Temporal contínua com apenas a coluna do profissional autenticado.
- [x] Abaixo de 768px, `/minha-agenda` continua mostrando `MobileAgendaView`, sem mudança de comportamento em relação a hoje.
- [x] Na Grade Temporal desktop da Minha Agenda, filtro de equipe, alternância Dia/Semana e botão/gaveta de Espera não aparecem.
- [x] Clicar num Agendamento na Grade Temporal desktop da Minha Agenda abre o bottom sheet de ações (WhatsApp/Reagendar/Marcar não compareceu/Cancelar) e não o Checkout de Comanda.
- [x] Encaixe, Bloquear horário e Cancelados do dia continuam funcionando na Minha Agenda, tanto na visão desktop quanto na mobile.
- [x] Redimensionar a janela entre desktop e mobile alterna automaticamente entre Grade Temporal e `MobileAgendaView`, sem exigir recarregar a página.
- [x] Testes de `MinhaAgenda.test.tsx` são atualizados para cobrir a composição com `Agenda` em modo travado, incluindo os cenários acima.
- [x] A Agenda do gerente (`/agenda`) permanece sem nenhuma mudança de comportamento.

> Achados durante a implementação:
> - No desktop, Encaixe/Bloquear/Cancelados passam a vir do próprio cabeçalho da Grade Temporal (`Agenda.tsx`, os mesmos botões que o gestor usa — "Bloquear" em vez de "Bloquear horário", por exemplo), não do cabeçalho próprio da Minha Agenda. Por isso o cabeçalho próprio da Minha Agenda (Novo agendamento/Encaixe/Bloquear horário/Cancelados) passou a aparecer só no mobile (`hidden max-md:flex`) — no desktop ele duplicaria as mesmas ações. Um `data-testid="minha-agenda-mobile-header"` foi acrescentado para os testes conseguirem mirar nesse cabeçalho especificamente.
> - `Agenda.tsx` ganhou um segundo par de props opcionais, `selectedDate`/`onSelectedDateChange`, para operar em modo controlado: sem eles, continua guardando a data internamente (gestor, sem mudança); com eles, quem usa o componente decide a data — necessário porque a Minha Agenda precisa saber qual dia está sendo navegado dentro da Grade Temporal para os próprios botões de Novo Agendamento/Encaixe/Bloqueio (mobile) abrirem no dia certo.
> - `BarbeiroLayout.tsx` precisou do mesmo tratamento de altura de viewport que `GerenteLayout.tsx` já dava à rota `/agenda` (`h-dvh`/`overflow-hidden` em vez de altura livre), replicado para `/minha-agenda` — sem isso a Grade Temporal (que rola dentro de si mesma) não tinha onde rolar.
> - `MinhaAgenda.tsx` perdeu o estado `loading`/`setLoading` próprio: a Grade Temporal (componente `Agenda`) tem seu próprio skeleton de carregamento: `fetchDay`/`loadSupportData` continuam existindo, só para alimentar os modais próprios do barbeiro (Novo/Reagendar/Cancelar/Não compareceu/Bloqueio no mobile).
> - Efeito colateral aceito, não resolvido aqui: com `Agenda` embutida, a Minha Agenda passa a disparar duas leituras independentes de profissionais/agendamentos/bloqueios para o mesmo dia (a sua própria e a de `Agenda.tsx`), além de dois canais realtime. Correto, mas redundante — otimizar isso ficaria para uma spec futura de consolidação, se o custo se mostrar relevante.
