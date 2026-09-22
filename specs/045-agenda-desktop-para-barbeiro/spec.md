# Especificação Técnica: Grade Temporal desktop na Minha Agenda do barbeiro

## Problem Statement

A Minha Agenda do barbeiro (`/minha-agenda`) sempre renderiza `MobileAgendaView` — a visão em lista vertical de horários, pensada para tela estreita — não importa a largura da janela. É o mesmo componente que a Agenda do gerente usa apenas abaixo de 768px; acima disso, o gerente vê uma Grade Temporal contínua com colunas por profissional, navegação de dia/semana e cards posicionados por horário.

O barbeiro, ao abrir a Minha Agenda num desktop ou notebook, fica preso à lista vertical mobile mesmo tendo tela e mouse disponíveis, enquanto o gerente — inclusive quando o gerente é o próprio Barbeiro Titular logado como `gerente` — enxerga a grade rica no mesmo hardware. A experiência do papel `barbeiro` degrada artificialmente em telas grandes.

## Solution

A Minha Agenda passa a usar o mesmo componente de Agenda do gerente (`Agenda.tsx`), com um modo travado ao profissional autenticado, em vez de manter sua própria página que só renderiza `MobileAgendaView`. Acima de 768px, o barbeiro enxerga a Grade Temporal contínua do dia, com os cards do seu próprio profissional; abaixo de 768px, continua vendo `MobileAgendaView`, exatamente como hoje — nada muda na experiência mobile do barbeiro.

No modo travado ao profissional:
- O filtro de equipe (`AgendaEquipeFilter`) fica oculto; a grade sempre mostra só o profissional autenticado, sem opção de ver outros.
- A alternância Dia/Semana fica oculta; a Grade Temporal do barbeiro é sempre visão de dia, como já é hoje na Minha Agenda.
- O botão e a gaveta de Lista de Espera ficam ocultos — recurso de recepção/balcão, não faz parte do escopo do barbeiro hoje.
- O clique num Agendamento que hoje abriria o Checkout de Comanda (ação exclusiva do gestor) abre, em vez disso, o mesmo menu de ações que a Minha Agenda já oferece hoje (WhatsApp, Reagendar, Marcar não compareceu, Cancelar) — a Comanda e a cobrança continuam exclusivas do gestor, tanto no modo travado quanto no mobile.
- Encaixe, Bloquear horário e Cancelados do dia continuam disponíveis, como já são hoje na Minha Agenda.

## User Stories

1. Como barbeiro acessando a Minha Agenda num desktop, quero ver a Grade Temporal contínua do meu dia, para enxergar meus horários livres e ocupados na mesma forma visual que o gerente usa.
2. Como barbeiro acessando a Minha Agenda num celular ou tela estreita, quero continuar vendo a lista vertical de horários que já uso hoje, para não perder a experiência mobile já validada.
3. Como barbeiro na Grade Temporal desktop, quero ver só a minha própria coluna de horários, para não me confundir com a agenda de outros profissionais que não me dizem respeito.
4. Como barbeiro na Grade Temporal desktop, quero que o filtro de equipe e a alternância Dia/Semana não apareçam, para não me oferecerem uma navegação que não faz sentido pra mim.
5. Como barbeiro na Grade Temporal desktop, quero clicar num Agendamento e ver as mesmas ações que já tenho hoje na Minha Agenda mobile (WhatsApp, Reagendar, Marcar não compareceu, Cancelar), para operar meu dia sem depender do gestor pra essas tarefas.
6. Como barbeiro, não quero conseguir abrir o Checkout de Comanda a partir da Grade Temporal desktop, para que a cobrança e o fechamento financeiro continuem exclusivos do gestor.
7. Como barbeiro na Grade Temporal desktop, quero continuar podendo criar Encaixe, Bloquear horário e ver os Cancelados do dia, para manter as mesmas ações que já tenho hoje na Minha Agenda mobile.
8. Como barbeiro, não quero ver o botão nem a gaveta de Lista de Espera na Grade Temporal desktop, para não me oferecerem um recurso de balcão que não faz parte do meu papel hoje.
9. Como gerente, quero que a Agenda continue funcionando exatamente como hoje (multi-profissional, Dia/Semana, filtro de equipe, Checkout de Comanda, Lista de Espera), para que a mudança no barbeiro não introduza nenhuma regressão na minha própria tela.
10. Como desenvolvedor, quero que a Grade Temporal continue vivendo num único componente (`Agenda.tsx`), para não duplicar o cálculo de posição de cards, a régua de horários nem o layout horizontal de encaixes concorrentes entre duas telas.
11. Como barbeiro redimensionando a janela do navegador entre desktop e mobile, quero que a transição entre Grade Temporal e lista vertical aconteça automaticamente, do mesmo jeito que já acontece hoje na Agenda do gerente.

## Implementation Decisions

- `MinhaAgenda.tsx` deixa de renderizar `MobileAgendaView` diretamente e passa a renderizar o componente `Agenda` do gerente (`src/pages/gerente/Agenda.tsx`), num modo travado ao profissional autenticado. `Agenda` recebe os dados de tenant/profissional/serviços/clientes já carregados por `MinhaAgenda` via `BarbeiroContextType`, mantendo o padrão atual de que toda escrita passa pelas RPCs do `AgendaRepository`.
- Novo parâmetro no componente `Agenda` (ex.: uma prop de bloqueio de profissional) indica: profissional único e fixo (sem seleção de equipe), visão de dia fixa (sem alternância Dia/Semana), Lista de Espera oculta, e clique em Agendamento abrindo o menu de ações do barbeiro em vez do Checkout de Comanda.
- No modo travado, o menu de ações aberto ao clicar num Agendamento na Grade Temporal desktop é o mesmo já usado hoje em `MobileAgendaView`/`MinhaAgenda` (bottom sheet com WhatsApp, Reagendar, Marcar não compareceu, Cancelar) — sem introduzir um segundo componente de menu de ações.
- A visão mobile (`MobileAgendaView`, abaixo de 768px) do componente `Agenda` continua sendo usada tanto pelo gerente quanto pelo barbeiro, sem alteração de comportamento.
- O botão "Espera" e a `EsperaDrawer` do componente `Agenda` ficam condicionados ao modo não travado (isto é, seguem existindo só para o gerente).
- O `AgendaEquipeFilter` e a alternância Dia/Semana do cabeçalho desktop ficam condicionados ao modo não travado.
- Nenhuma mudança de schema, RPC ou contrato de rede: a mudança é só de composição de UI e de qual profissional/ação fica disponível em cada modo.
- `BarbeiroLayout.tsx` e a rota `/minha-agenda` em `App.tsx` continuam apontando para a página `MinhaAgenda`; só o corpo de `MinhaAgenda.tsx` muda internamente.

## Testing Decisions

- Um bom teste aqui verifica comportamento visível ao usuário (o que aparece, o que é clicável, o que fica oculto), não detalhes de implementação como nomes internos de estado.
- Testes de `Agenda.tsx` (gerente) devem continuar passando sem alteração — cobrem o modo não travado (multi-profissional, Dia/Semana, Checkout de Comanda, Lista de Espera).
- Novos testes cobrem o modo travado ao profissional, reaproveitando o padrão já usado em `MinhaAgenda.test.tsx` e `MobileAgendaView.test.tsx` (render com `InMemory`/dublês de repositório, sem Supabase real):
  - Acima de 768px, a Grade Temporal aparece com apenas a coluna do profissional travado.
  - O filtro de equipe, a alternância Dia/Semana e o botão/gaveta de Lista de Espera não aparecem no modo travado.
  - Clicar num Agendamento no modo travado abre o menu de ações do barbeiro (WhatsApp/Reagendar/Marcar não compareceu/Cancelar), não o Checkout de Comanda.
  - Abaixo de 768px, o modo travado continua renderizando `MobileAgendaView` como hoje.
- `MinhaAgenda.test.tsx` é atualizado para refletir que a página passa a compor `Agenda` em modo travado, em vez de `MobileAgendaView` diretamente.

## Out of Scope

- Dar ao barbeiro acesso ao Checkout de Comanda, à cobrança ou ao fechamento de caixa a partir da Grade Temporal desktop — continua exclusivo do gestor.
- Dar ao barbeiro visão de outros profissionais, filtro de equipe ou visão de Semana.
- Dar ao barbeiro acesso à Lista de Espera (fila de balcão).
- Qualquer mudança de comportamento na Agenda do gerente.
- Qualquer mudança de schema, RPC ou regra de negócio no banco — a mudança é só de composição de UI no frontend.

## Further Notes

- A Minha Agenda mobile do barbeiro já é, hoje, o mesmo componente `MobileAgendaView` usado pelo gerente em tela estreita; esta spec estende esse reuso para a visão desktop, em vez de manter duas implementações divergentes da mesma Grade Temporal.
- O comentário atual em `MinhaAgenda.tsx` ("mesmo componente que o gestor usa no celular") deve ser atualizado para refletir que agora é o mesmo componente que o gestor usa em qualquer largura de tela, só que em modo travado ao profissional.
