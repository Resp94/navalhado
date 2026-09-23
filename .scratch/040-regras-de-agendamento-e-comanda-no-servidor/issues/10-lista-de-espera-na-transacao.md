# 10: Lista de Espera consumida na transação

**What to build:** ao encaixar um cliente da Lista de Espera, ele só sai da fila quando o Agendamento é salvo. Se o gestor fecha o modal ou a criação falha, o cliente continua aguardando. O Rodízio de Barbeiros continua sugerindo o profissional com menos atendimentos no dia, com a contagem feita pelo repositório da Lista de Espera, não pela tela.

**Blocked by:** 08 (Criar Agendamento por RPC)

**Status:** done

- [x] RPC de criar Agendamento recebe opcionalmente a entrada da Lista de Espera e a marca como atendida na mesma transação
- [x] A tela deixa de marcar a entrada antes de salvar
- [x] Criação recusada mantém a entrada aguardando
- [x] Contagem de atendimentos do dia para o Rodízio movida para o repositório da Lista de Espera
- [x] pgTAP: sucesso consome a entrada; falha preserva
- [x] Vitest da sugestão do Rodízio com a nova entrada
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Nota da implementação:** o status no banco é `waiting`/`scheduled` (o adaptador traduz de/para `aguardando`/`atendido`); a RPC troca `waiting` por `scheduled` na mesma transação da criação e recusa entrada que já não está aguardando. A tela guarda a entrada em `pendingWaitingEntryId` e só a envia ao salvar. A contagem do Rodízio agora é `EsperaRepository.suggestRotationFromAppointments`, que ignora cancelados e com falta.
