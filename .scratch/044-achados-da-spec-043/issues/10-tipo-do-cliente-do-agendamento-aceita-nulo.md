# 10: Tipo do cliente do Agendamento aceita nulo

**What to build:** o Agendamento pode não ter Cliente: o encaixe de balcão cria um atendimento sem cadastro, e a coluna do cliente aceita nulo no banco. O tipo que a aplicação usa para ler Agendamento declara o cliente como obrigatório, o que não corresponde ao dado.

Isso já custou um defeito real na spec 043: o Painel de Cancelados do Dia lia o nome do cliente sem checar e derrubava a Agenda inteira quando havia um cancelamento de balcão no dia. A correção foi pontual, dentro do painel. O tipo continua mentindo, então o próximo lugar que ler o cliente sem checar repete o mesmo defeito, e a verificação de tipos não vai avisar.

Depois deste ticket, o tipo diz a verdade e a verificação de tipos passa a apontar quem precisa tratar o nulo.

**Onde foi achado:** limite registrado no ticket 05 da spec 043, onde a correção pontual foi feita e a propagação do tipo, medida em seis erros, ficou de fora.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] O tipo do cliente no Agendamento lido passa a aceitar nulo, no contrato do módulo de agenda e no tipo da página que o espelha
- [ ] Todos os pontos que a verificação de tipos apontar passam a tratar o Agendamento sem Cliente, sem silenciar a checagem com conversão forçada de tipo
- [ ] O texto exibido para Agendamento sem Cliente é o mesmo já usado na grade, sem inventar um terceiro rótulo
- [ ] Nenhum ponto passa a exibir vazio ou a palavra que representa ausência de valor para o usuário
- [ ] Ações que dependem do Cliente, como o atalho de WhatsApp, ficam indisponíveis em vez de quebrar
- [ ] O adaptador em memória e os fakes de teste passam a conseguir representar Agendamento sem Cliente
- [ ] Teste cobrindo Agendamento sem Cliente em cada superfície que a verificação de tipos apontar
- [ ] `npm run lint`, `npm test` e `npm run build` passam
