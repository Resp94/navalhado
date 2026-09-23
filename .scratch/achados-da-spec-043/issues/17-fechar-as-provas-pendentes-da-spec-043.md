# 17: Fechar as provas pendentes da spec 043

**What to build:** a spec 043 foi entregue com um conjunto de verificações que ficaram por fazer. Nenhuma delas indica defeito conhecido; são lacunas de prova, registradas honestamente nos tickets à medida que apareceram. Enquanto estiverem abertas, a afirmação de que a spec está verde depende de código que ninguém executou desde a última mudança.

Depois deste ticket, as lacunas estão fechadas ou viraram defeito registrado.

**Onde foi achado:** limites registrados nos tickets 02, 04, 06, 07 e 08 da spec 043.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] O teste de banco que exercita a criação de Agendamento pelo gestor é executado inteiro depois do ajuste de mensagem feito no ticket 07, e passa
- [ ] O teste de banco de regras de agendamento que não foi reexecutado depois da migration de autoria é executado, e passa ou vira defeito registrado
- [ ] A suíte completa de testes da aplicação é executada uma vez no estado atual da branch de desenvolvimento, e passa
- [ ] O cancelamento pelo Canal do Cliente é exercitado de ponta a ponta pela tela pública, e o resultado é conferido: motivo gravado, autoria de cliente, e a entrada aparecendo nos painéis do gerente e do barbeiro e na Central 360º
- [ ] Na Agenda do gerente, é conferido no navegador que remover um Bloqueio de Horário pela grade e criar um pelo modal continuam atualizando a grade
- [ ] É conferido, na rede, que um evento de Agendamento não dispara leitura de Bloqueios de Horário
- [ ] Todo dado criado para a verificação é apagado, e as contagens do banco voltam ao estado anterior, conferidas antes e depois
- [ ] Nenhum Agendamento de teste é criado em estado ativo numa barbearia com instância de WhatsApp conectada, porque isso envia mensagem real ao cliente
- [ ] O resultado de cada item é registrado neste ticket, inclusive os que falharem
