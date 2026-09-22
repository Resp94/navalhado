# 20: Glossário ganha os verbetes de cancelamento

**What to build:** a decisão 8 da spec 043 mandava acrescentar o Motivo de Cancelamento ao glossário do projeto, com os termos a evitar. Isso não foi entregue. A spec 043 também criou o Painel de Cancelados do Dia e a autoria do cancelamento, e nenhum dos dois tem verbete. O glossário é o documento canônico de vocabulário e o primeiro a ser lido antes de mexer em regra de negócio.

Sem verbete, cada tela e cada commit escolhe o próprio sinônimo, que é exatamente o que o glossário existe para evitar.

Depois deste ticket, o vocabulário de cancelamento tem definição única.

**Onde foi achado:** decisão 8 da spec 043, não entregue, conferida contra o glossário em 2026-09-22. O ticket 07 da spec 043 atualizou só o verbete da Lista de Espera. A falta dos verbetes de Painel e de autoria não está registrada em nenhum ticket; decorre da mesma conferência.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] O glossário ganha o verbete Motivo de Cancelamento, dizendo que é obrigatório quando a barbearia cancela e opcional quando o cliente cancela pelo Canal do Cliente, que o texto padrão de preenchimento vem do front, e que ele pode faltar em registro antigo
- [ ] O verbete Motivo de Cancelamento traz os termos a evitar que a spec 043 já listava: justificativa, observação de cancelamento, nota de cancelamento
- [ ] O glossário ganha o verbete Painel de Cancelados do Dia, dizendo quem o vê e com que recorte para cada papel, e que o recorte vem do banco
- [ ] O glossário ganha o verbete da autoria do cancelamento, dizendo que ela distingue barbearia de cliente, que não identifica a pessoa, e que registro anterior à spec 043 fica sem autoria
- [ ] A lista de termos a evitar recebe os sinônimos que aparecerem no código para esses conceitos, conferidos por busca
- [ ] Os verbetes novos apontam para os verbetes existentes com que se relacionam
- [ ] A correção é de documentação: nenhum arquivo de código é tocado
