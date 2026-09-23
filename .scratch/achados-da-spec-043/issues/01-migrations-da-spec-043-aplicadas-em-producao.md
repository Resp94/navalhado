# 01: Migrations da spec 043 aplicadas em produção

**What to build:** as três migrations da spec 043 estão aplicadas só no ambiente de desenvolvimento, e o código que lê as colunas novas já está na branch de desenvolvimento. Promover esse código para produção antes das migrations quebra a Agenda, o Painel de Cancelados do Dia e a Lista de Espera, porque a leitura pede colunas que não existem lá.

Depois deste ticket, produção tem as três colunas e as funções alteradas, conferidas uma a uma, e a promoção do código deixa de ser um risco.

**Onde foi achado:** limites registrados nos tickets 01, 06 e 07 da spec 043. Conferido em produção em 2026-09-21: nenhuma das três colunas existe.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A observação da entrada da Lista de Espera existe em produção (migration do ticket 01)
- [ ] A autoria do cancelamento existe em produção, com o domínio fechado, e as quatro funções de cancelamento gravam a autoria (migration do ticket 06)
- [ ] A marca de Agendamento vindo da Lista de Espera existe em produção e a função de criação pelo gestor a grava (migration do ticket 07)
- [ ] As permissões de execução de cada função alterada em produção ficam idênticas às de antes da migration, conferidas antes e depois
- [ ] Nenhum dado existente em produção é reescrito: os Agendamentos anteriores ficam sem autoria e sem a marca da Lista de Espera
- [ ] A ordem de aplicação respeita a numeração das migrations
- [ ] O estado de produção é conferido depois de aplicar: as três colunas presentes, com o tipo e o padrão esperados
- [ ] Nenhum teste é executado contra produção; a verificação é de estrutura e de permissão, por leitura

**Cuidado:** este ticket mexe em produção. Confirme com o responsável antes de aplicar qualquer migration, e aplique uma de cada vez, conferindo entre elas.
