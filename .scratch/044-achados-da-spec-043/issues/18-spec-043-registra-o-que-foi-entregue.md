# 18: Spec 043 registra o que foi entregue

**What to build:** a spec 043 descreve, em sete pontos, um sistema diferente do que foi entregue. Os tickets dela já registram o comportamento real, mas quem ler só a spec vai procurar regra no lugar errado:

- A spec afirma que o banco grava o texto padrão `Cancelado pelo cliente` quando o cliente não escreve motivo. Quem monta esse texto é o adaptador do Canal do Cliente, no front, antes de chamar o banco.
- A spec fala em três funções de cancelamento. São quatro: a que cancela a Comanda e o Agendamento juntos também grava a autoria.
- A spec diz que as consultas de Bloqueios de Horário da Agenda do gerente não seriam tocadas. O ticket 08 dividiu o contrato de leitura em Agendamentos e Bloqueios.
- A spec trata a marca de Agendamento vindo da Lista de Espera como o marcador genérico de origem na nota, e o ticket 07 original propunha um valor novo na origem. Foi entregue uma coluna própria, a nota passou a levar só a observação, e a origem não mudou.
- A spec diz que a autoria é escrita exclusivamente pelas funções de cancelamento. A aplicação respeita isso, mas o banco não impede a escrita direta pelo gerente.
- A spec previa testes de autoria no repositório de agenda. Eles foram substituídos por pgTAP contra as funções reais, porque no repositório passariam por construção.
- A spec diz que o painel não cria componente novo. Isso foi lido como nenhum componente novo na biblioteca de interface: o painel é um componente de agenda que usa os da biblioteca.

Depois deste ticket, a spec diz o que foi feito sem apagar o que foi decidido.

**Onde foi achado:** desvios registrados nos tickets 04, 06, 07 e 08 da spec 043, e confronto das decisões 1 e 7 e da seção de testes da spec 043 com o que foi entregue.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Cada um dos sete pontos recebe uma nota de estado de entrega, com data, ao lado do texto original; o texto original não é apagado
- [ ] A nota sobre o texto padrão diz onde ele é montado e que o cancelamento sem motivo existe nos registros antigos, exibido como "Sem motivo informado"
- [ ] A nota sobre as funções de cancelamento nomeia a quarta via e diz que ela grava autoria mas não motivo, apontando para o ticket da spec 044 que resolve isso
- [ ] A nota sobre Bloqueios aponta para o ticket 08 da spec 043 e descreve o contrato dividido
- [ ] A nota sobre a Lista de Espera descreve a coluna própria e aponta para o ticket da spec 044 que leva a medida ao relatório
- [ ] A nota sobre a escrita da autoria aponta para o ticket da spec 044 que a protege no banco
- [ ] As notas sobre os testes de autoria e sobre o componente registram a leitura adotada e a razão
- [ ] Toda outra afirmação da spec que for alterada é conferida contra o código antes
- [ ] Os tickets da spec 043 não são alterados
- [ ] A correção é de documentação: nenhum arquivo de código é tocado
