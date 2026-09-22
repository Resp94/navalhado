# 22: Migrations da spec 044 aplicadas em produção

**What to build:** vários tickets desta spec alteram o banco: a validação de telefone, o motivo pela tela de Comandas, a proteção da autoria, os dois do relatório de agenda e, conforme a abordagem escolhida, o do tempo real dos Bloqueios de Horário. Cada um é entregue e provado no ambiente de desenvolvimento. Sem este ticket, o código que depende dessas mudanças chegaria a produção antes delas, repetindo o problema que o ticket 02 resolve para a spec 043.

Depois deste ticket, produção tem todas as migrations da spec 044, conferidas uma a uma.

**Onde foi achado:** validação da spec 044 contra a skill de spec, em 2026-09-22. O ticket 02 cobria só as migrations da spec 043.

**Blocked by:** 02 (Migrations da spec 043 aplicadas em produção), 06, 07, 08, 16 e 17; e o 09, se a abordagem escolhida nele criar migration

**Status:** ready-for-agent

- [ ] Só entram migrations de tickets marcados como feitos, com o pgTAP do ticket verde no ambiente de desenvolvimento
- [ ] A ordem de aplicação respeita a numeração das migrations
- [ ] Antes de cada migration, o agente para e pede confirmação ao responsável; nenhuma é aplicada sem essa confirmação
- [ ] As permissões de execução de cada função alterada ficam idênticas às de antes, conferidas antes e depois em produção
- [ ] Nenhum dado existente em produção é reescrito
- [ ] O estado de produção é conferido depois de cada aplicação, por leitura
- [ ] Nenhum teste é executado contra produção
- [ ] Se um ticket que cria migration ainda não estiver feito, este ticket registra qual e fica aberto para ele

**Cuidado:** este ticket mexe em produção. Aplique uma migration de cada vez, conferindo entre elas.
