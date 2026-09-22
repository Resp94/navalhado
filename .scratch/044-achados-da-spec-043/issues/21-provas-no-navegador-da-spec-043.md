# 21: Provas no navegador da spec 043

**What to build:** duas afirmações da spec 043 foram provadas só por teste de banco e de tela, nunca pelo uso real. O cancelamento feito pelo cliente no Canal do Cliente nunca foi exercitado pela tela pública: o motivo e a autoria que o painel mostra foram provados pelas funções de banco, não pelo caminho que o cliente percorre. E, depois que o ticket 08 da spec 043 dividiu a leitura de Agendamentos e de Bloqueios de Horário, duas rotas da Agenda Geral não foram conferidas no navegador.

Depois deste ticket, essas afirmações estão provadas pelo uso real, ou viraram defeito registrado.

**Onde foi achado:** limites registrados nos tickets 02, 04, 06 e 08 da spec 043.

**Blocked by:** None (can start immediately). Recomendado antes do ticket 08, que altera a escrita da autoria.

**Status:** ready-for-agent

- [ ] O cancelamento pelo Canal do Cliente é exercitado de ponta a ponta pela tela pública, com um motivo escrito pelo cliente, e o resultado é conferido: motivo gravado, autoria de cliente, e a entrada aparecendo no Painel de Cancelados do Dia do gerente e do barbeiro e na Central 360º do Cliente
- [ ] O mesmo caminho é exercitado sem motivo escrito, e o texto de preenchimento aparece no painel como motivo
- [ ] Na Agenda Geral, é conferido no navegador que remover um Bloqueio de Horário pela grade e criar um pelo modal continuam atualizando a grade
- [ ] É conferido, na rede, que um evento de Agendamento não dispara leitura de Bloqueios de Horário
- [ ] Nenhum Agendamento de teste é criado em estado ativo numa barbearia com instância de WhatsApp conectada, porque isso envia mensagem real ao cliente; se o caminho exigir Agendamento ativo, a verificação usa uma barbearia sem instância conectada, conferida antes
- [ ] Todo dado criado para a verificação é apagado, e as contagens do banco voltam ao estado anterior, conferidas antes e depois
- [ ] O resultado de cada item é registrado neste ticket, inclusive os que falharem
