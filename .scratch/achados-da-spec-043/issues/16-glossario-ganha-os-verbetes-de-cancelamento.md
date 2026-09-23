# 16: Glossário ganha os verbetes de cancelamento

**What to build:** a spec 043 trouxe vocabulário novo para o produto: o motivo que a pessoa escreve ao desmarcar, o painel que lista o que caiu do dia, e a autoria que diz se quem desmarcou foi a barbearia ou o cliente. Nada disso está no glossário do projeto, que é o documento canônico de vocabulário e o primeiro a ser lido antes de mexer em regra de negócio.

Sem verbete, cada tela e cada commit escolhe o próprio sinônimo, que é exatamente o que o glossário existe para evitar.

Depois deste ticket, o vocabulário de cancelamento tem definição única.

**Onde foi achado:** o ticket 07 da spec 043 atualizou o verbete da Lista de Espera; os termos de cancelamento ficaram de fora.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] O glossário ganha verbete para o motivo do cancelamento, dizendo quem o escreve, por quais vias, e que ele pode faltar em registro antigo
- [ ] O glossário ganha verbete para o painel que lista os cancelamentos do dia, dizendo quem o vê e com que recorte para cada papel
- [ ] O glossário ganha verbete para a autoria do cancelamento, dizendo que ela distingue barbearia de cliente, que não identifica a pessoa, e que registro anterior à spec 043 fica sem autoria
- [ ] A lista de termos a evitar recebe os sinônimos que já apareceram no código e nas conversas para esses três conceitos
- [ ] Os verbetes novos apontam para os verbetes existentes com que se relacionam
- [ ] A correção é de documentação: nenhum arquivo de código é tocado
