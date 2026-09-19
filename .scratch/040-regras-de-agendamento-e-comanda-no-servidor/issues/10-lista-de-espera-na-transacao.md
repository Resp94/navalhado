# 10: Lista de Espera consumida na transação

**What to build:** ao encaixar um cliente da Lista de Espera, ele só sai da fila quando o Agendamento é salvo. Se o gestor fecha o modal ou a criação falha, o cliente continua aguardando. O Rodízio de Barbeiros continua sugerindo o profissional com menos atendimentos no dia, com a contagem feita pelo repositório da Lista de Espera, não pela tela.

**Blocked by:** 08 (Criar Agendamento por RPC)

**Status:** ready-for-agent

- [ ] RPC de criar Agendamento recebe opcionalmente a entrada da Lista de Espera e a marca como atendida na mesma transação
- [ ] A tela deixa de marcar a entrada antes de salvar
- [ ] Criação recusada mantém a entrada aguardando
- [ ] Contagem de atendimentos do dia para o Rodízio movida para o repositório da Lista de Espera
- [ ] pgTAP: sucesso consome a entrada; falha preserva
- [ ] Vitest da sugestão do Rodízio com a nova entrada
- [ ] `npm run lint`, `npm test` e `npm run build` passam
