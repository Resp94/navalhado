# 04: Autoria do cancelamento protegida contra escrita fora das funções

**What to build:** a autoria do cancelamento existe para responder quem desmarcou: a barbearia ou o cliente. Ela só tem valor se ninguém puder alterá-la fora das funções que cancelam.

Hoje a aplicação respeita isso, porque nenhuma tela escreve a coluna e as funções são o único caminho. O banco, porém, não impede: a política de atualização de Agendamento permite ao gerente alterar qualquer linha da própria barbearia, e a autoria está entre as colunas alcançadas. Quem tiver a chave de acesso do gerente pode reescrever a autoria de um cancelamento sem passar por nenhuma função.

Depois deste ticket, a autoria só muda pelo caminho que a define.

**Onde foi achado:** limite registrado no ticket 06 da spec 043. Confirmado em 2026-09-21: a política de atualização de Agendamento alcança a coluna da autoria.

**Blocked by:** 03 (Cancelamento pela tela de Comandas grava o Motivo de Cancelamento) — o 03 mexe no mesmo conjunto de funções de cancelamento, e fazer este antes obrigaria a rever a proteção depois

**Status:** ready-for-agent

- [ ] Uma atualização direta de Agendamento feita pelo gerente não consegue alterar a autoria do cancelamento
- [ ] As quatro funções de cancelamento continuam gravando a autoria normalmente
- [ ] Atualizações legítimas que o gerente faz hoje em Agendamento continuam funcionando; a proteção alcança apenas a coluna da autoria
- [ ] O administrador do SaaS não ganha nem perde acesso por conta deste ticket
- [ ] A abordagem é do agente que pegar o ticket, desde que a recusa venha do banco e não da aplicação; uma proteção que mora só no código da tela não cumpre o critério
- [ ] pgTAP provando a recusa da escrita direta, uma asserção por papel que hoje alcança a linha, e provando que cada uma das quatro funções continua gravando
- [ ] pgTAP de controle provando que o gerente continua conseguindo as atualizações legítimas de Agendamento
- [ ] Vale avaliar, e registrar no ticket, se o Motivo de Cancelamento merece a mesma proteção
- [ ] O pgTAP 17, que já cobre a função de cancelamento da Comanda, passa inteiro depois da mudança
- [ ] `npm run lint`, `npm test` e `npm run build` passam
