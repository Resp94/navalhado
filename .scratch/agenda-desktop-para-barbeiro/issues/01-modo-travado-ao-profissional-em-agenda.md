# 01: Modo travado ao profissional em `Agenda.tsx`

**What to build:** O componente `Agenda` do gerente (`src/pages/gerente/Agenda.tsx`) ganha um modo travado a um único profissional, ativado por uma prop nova. Nesse modo:

- A grade sempre mostra só o profissional informado pela prop — sem seleção de equipe.
- A visão fica sempre em Dia — sem alternância Dia/Semana.
- O botão e a gaveta de Lista de Espera não aparecem.
- Clicar num Agendamento na Grade Temporal dispara um callback recebido por prop, em vez de abrir o Checkout de Comanda.

O modo padrão de `Agenda` (sem a prop, como o gerente usa hoje) continua idêntico em todos os aspectos: multi-profissional, filtro de equipe, Dia/Semana, Lista de Espera e Checkout de Comanda ao clicar num Agendamento. Nenhuma página ainda consome o modo travado — esta ticket só cria a capacidade dentro do componente, verificável por teste.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Com a prop de modo travado ativa, a Grade Temporal desktop mostra só a coluna do profissional informado, mesmo havendo outros profissionais cadastrados no tenant.
- [x] Com a prop de modo travado ativa, `AgendaEquipeFilter` não é renderizado.
- [x] Com a prop de modo travado ativa, a alternância Dia/Semana não é renderizada e a visão nunca muda para Semana.
- [x] Com a prop de modo travado ativa, o botão "Espera" e a `EsperaDrawer` não são renderizados.
- [x] Com a prop de modo travado ativa, clicar num card de Agendamento na Grade Temporal chama o callback recebido por prop e não abre o Checkout de Comanda.
- [x] Sem a prop (modo padrão), todo o comportamento atual de `Agenda.tsx` permanece — testes existentes de `Agenda.tsx` continuam passando sem alteração.
- [x] A visão mobile (`MobileAgendaView`, abaixo de 768px) no modo padrão não é afetada por esta ticket.

> Achado durante a implementação: o critério original previa a visão mobile intocada nos dois modos, mas isso deixaria o modo travado inconsistente — o barbeiro veria, no celular, abas de outros profissionais e o texto "Toque para abrir a comanda". Corrigido: no modo travado, `MobileAgendaView` também recebe só o profissional travado (reaproveitando `visibleProfessionals`, já filtrado) e a dica do card passa a ser "ver as ações do agendamento" em vez de "abrir a comanda" — preparando a paridade que a ticket 02 exige. O card desktop também troca o texto do `title` no modo travado pelo mesmo motivo.
