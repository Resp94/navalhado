# 20: Glossário ganha os verbetes de cancelamento

**What to build:** a decisão 8 da spec 043 mandava acrescentar o Motivo de Cancelamento ao glossário do projeto, com os termos a evitar. Isso não foi entregue. A spec 043 também criou o Painel de Cancelados do Dia e a autoria do cancelamento, e nenhum dos dois tem verbete. O glossário é o documento canônico de vocabulário e o primeiro a ser lido antes de mexer em regra de negócio.

Sem verbete, cada tela e cada commit escolhe o próprio sinônimo, que é exatamente o que o glossário existe para evitar.

Depois deste ticket, o vocabulário de cancelamento tem definição única.

**Onde foi achado:** decisão 8 da spec 043, não entregue, conferida contra o glossário em 2026-09-22. O ticket 07 da spec 043 atualizou só o verbete da Lista de Espera. A falta dos verbetes de Painel e de autoria não está registrada em nenhum ticket; decorre da mesma conferência.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] O glossário ganha o verbete Motivo de Cancelamento, dizendo que é obrigatório quando a barbearia cancela e opcional quando o cliente cancela pelo Canal do Cliente, que o texto padrão de preenchimento vem do front, e que ele pode faltar em registro antigo
- [x] O verbete Motivo de Cancelamento traz os termos a evitar que a spec 043 já listava: justificativa, observação de cancelamento, nota de cancelamento
- [x] O glossário ganha o verbete Painel de Cancelados do Dia, dizendo quem o vê e com que recorte para cada papel, e que o recorte vem do banco
- [x] O glossário ganha o verbete da autoria do cancelamento, dizendo que ela distingue barbearia de cliente, que não identifica a pessoa, e que registro anterior à spec 043 fica sem autoria
- [x] A lista de termos a evitar recebe os sinônimos que aparecerem no código para esses conceitos, conferidos por busca
- [x] Os verbetes novos apontam para os verbetes existentes com que se relacionam
- [x] A correção é de documentação: nenhum arquivo de código é tocado

**Resultado (2026-09-22):**

- Três verbetes novos em `CONTEXT.md`, inseridos antes de "Rodízio de Barbeiros" (mesma vizinhança dos verbetes de Agenda/Lista de Espera):
  - **Motivo de Cancelamento**: obrigatório da barbearia, opcional do cliente; nomeia a constante `MOTIVO_CANCELAMENTO_PADRAO_CLIENTE` como quem monta o texto padrão (front, não banco); distingue "Cancelado pelo cliente" (texto padrão, exibido mas excluído do ranking de motivos) de "Sem motivo informado" (motivo de fato ausente) — os dois nunca são a mesma coisa. Termos a evitar: os três que a spec 043 já listava (justificativa, observação de cancelamento, nota de cancelamento) — busca no código não achou sinônimo novo em uso (as ocorrências de "justificativa" no código são todas do domínio financeiro — estorno de vale/comissão — não de cancelamento de Agendamento).
  - **Painel de Cancelados do Dia**: nomeia o componente (`PainelCanceladosDoDia`), diz que é o mesmo para gerente e barbeiro, descreve o recorte por papel e reforça que ele vem da política de leitura do banco, não de verificação na tela. Aponta para o cartão "Motivos de cancelamento" do Módulo de Relatórios como o verbete relacionado, com a distinção que já vale (painel é do dia, individual; relatório é do período, agregado).
  - **Autoria do Cancelamento**: nomeia a coluna (`canceled_by`), as quatro funções que a escrevem (incluindo a via de Comanda, fechada pelo ticket 07 desta spec), reforça que não distingue gerente de barbeiro e que registro anterior fica com autoria nula, nunca inferida.
- **Busca por sinônimo em uso** feita para os três conceitos antes de escrever os termos a evitar: `canceled_by`/"autoria"/"quem cancelou" usados de forma consistente em todo o código (`PainelCanceladosDoDia.tsx`, `agenda/types.ts`, `relatorios/types.ts`, `AgendaMotivosCancelamento.tsx`) — nenhum sinônimo concorrente encontrado; "Painel de Cancelados do Dia"/"Cancelados do dia" igualmente consistente (`Agenda.tsx`, `MobileAgendaView.tsx`, `useCanceladosDoDia.ts`). Não havia sinônimo de código para acrescentar à lista além dos três já herdados da spec 043.
- **Nenhum arquivo de código tocado**: `git status` confirma que só `CONTEXT.md` mudou.
- Ticket não lista `npm run lint`/`npm test`/`npm run build` no critério de aceite (trabalho só de documentação), coerente com os tickets 19 e 20 desta spec.
