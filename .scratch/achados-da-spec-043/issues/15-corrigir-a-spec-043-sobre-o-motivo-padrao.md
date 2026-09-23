# 15: Corrigir a spec 043 sobre o motivo padrão do cancelamento

**What to build:** a spec 043 afirma que o banco grava um texto padrão quando o cliente cancela sem escrever motivo. Não é o que acontece: quem monta esse texto é o adaptador do Canal do Cliente, no código da aplicação, antes de chamar o banco.

A diferença não é de redação. Quem ler a spec para mexer no assunto vai procurar a regra no lugar errado, e pode concluir que qualquer cancelamento de cliente chega com motivo, o que só vale para os que passaram pelo Canal do Cliente depois daquela mudança.

Depois deste ticket, a spec descreve o comportamento real.

**Onde foi achado:** desvio registrado no ticket 04 da spec 043, onde o critério foi reescrito para o comportamento real mas a spec não foi corrigida.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A spec 043 passa a dizer onde o texto padrão é montado
- [ ] A spec deixa claro que Agendamento cancelado sem motivo existe, é o caso dos registros antigos, e é exibido como "Sem motivo informado"
- [ ] Nenhuma outra afirmação da spec é alterada sem ser conferida contra o código
- [ ] A correção é de documentação: nenhum arquivo de código é tocado
- [ ] Vale conferir, e corrigir se for o caso, se os tickets da spec repetem a mesma afirmação errada
