# ADR 023: Ciclo de vida do Agendamento do gestor no servidor

## Status

Aceita em 2026-09-19.

## Contexto e Problema

O Canal do Cliente já criava, reagendava e cancelava Agendamento por RPC, com validação no
banco. Já a Agenda Geral do gestor e a Minha Agenda do barbeiro mudavam o estado do Agendamento
por escrita direta na tabela, decidindo na tela quem pode ir para onde: iniciar atendimento e
reagendar não conferiam o estado de origem, e a regra "falta só depois do horário de início"
existia só no cliente. Duas telas abertas, ou uma chamada direta à API, contornavam a regra.

## Decisões Tomadas

1. **Cada transição de estado do Agendamento feita pelo gestor ou pelo barbeiro é uma RPC atômica
   (`security definer`, `search_path` vazio), e a tela não escreve mais em `appointments` para
   isso.** A regra (estado de origem, horário, papel, unidade) fica no banco, o mesmo padrão do
   Canal do Cliente e das RPCs financeiras. A spec 040 leva isso adiante em tickets: iniciar
   atendimento, cancelar e marcar falta (04 a 06), depois criar e reagendar.

2. **O que toda transição confere mora num helper `private` (`lock_appointment_for_transition`),
   que também trava a linha.** Autenticação, papel (`gerente`, `proprietario` e, só onde a
   regra permite, `barbeiro` dono do agendamento), unidade (o gerente com `tenant_id` nulo é
   recusado; o proprietário opera qualquer unidade) e existência do Agendamento na unidade. Cada
   RPC só decide estado de origem e destino, então uma regra de acesso nova muda em um lugar.

3. **Tabela de transições:** iniciar atendimento só de `pending` e `confirmed` (gerente e
   barbeiro dono); cancelar só de `pending`, `confirmed` e `in_progress`, com motivo obrigatório
   (só gerente e proprietário); marcar falta só de `pending` e `confirmed` e só depois do
   horário de início pelo relógio do banco (só gerente e proprietário). Estados terminais
   (`completed`, `canceled`, `no_show`) nunca saem por essas RPCs.

4. **A Comanda aberta do Agendamento continua sendo cancelada pelo gatilho
   `trg_auto_cancel_comanda_on_appointment_cancel`, que já cobre `canceled` e `no_show`.** As RPCs
   não repetem esse cancelamento: a mudança de estado e o cancelamento da Comanda acontecem na
   mesma transação, e o Evento de Agendamento (notificação por WhatsApp) sai dos gatilhos
   existentes, sem mudança.

5. **O `AgendaRepository` é a única porta das telas para essas transições e é fino.** Valida
   entrada (ids, motivo do cancelamento) e traduz o erro do banco em `AgendaOperationError` com
   `kind` `regra`, `acesso` ou `desconhecido`, mantendo a mensagem do banco. Não replica estado
   de origem, horário nem papel. Segue o padrão dos módulos profundos: adaptador Supabase, adaptador
   em memória para testes e hook `useAgenda`.

## Consequências

- Uma chamada direta à RPC, ou uma aba desatualizada, recebe a mesma recusa que a tela.
- A tela ainda pode antecipar a mensagem (por exemplo "o atendimento ainda não começou"), mas
  deixa de ser a fonte da regra.
- Cancelar agora exige motivo; antes o campo era opcional.
- Criar e reagendar Agendamento (tickets 08 e 11) reusam o helper e ganham RPC própria; até lá
  a Agenda Geral ainda escreve direto nesses dois casos.
