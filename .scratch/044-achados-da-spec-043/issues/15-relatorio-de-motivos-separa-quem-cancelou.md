# 15: Relatório de motivos separa quem cancelou

**What to build:** o relatório de agenda tem um ranking dos motivos de cancelamento do período. A spec 043 começou justamente por um defeito dele: o ranking mistura o cancelamento que a barbearia fez com o que o cliente fez, e o texto de preenchimento gravado quando o cliente não escreve nada (`cancelado pelo cliente`) tende a ocupar o topo sem dizer nada. A spec 043 criou a autoria do cancelamento, mas deixou o relatório de fora e registrou que a separação merecia ticket próprio.

Depois deste ticket, o gerente lê no relatório os motivos reais, separados por quem cancelou.

**Onde foi achado:** notas finais da spec 043, que registram a separação por autoria como desdobramento natural do ticket 06 e pedem ticket próprio.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] O ranking de motivos separa três grupos: cancelado pela barbearia, cancelado pelo cliente e autoria desconhecida
- [ ] Cancelamento anterior à spec 043, sem autoria, entra no grupo de autoria desconhecida; nenhum é atribuído a ninguém
- [ ] O texto de preenchimento usado quando o cliente não escreve motivo deixa de contar como motivo no ranking; esses cancelamentos continuam contados no total de cancelamentos do cliente
- [ ] O texto de preenchimento passa a ter uma definição única; hoje ele é escrito em três pontos do adaptador do Canal do Cliente e mais um no adaptador em memória, e o relatório precisa reconhecer o mesmo texto que o front grava. Onde a definição única mora é decisão do ticket, registrada aqui
- [ ] A comparação com o texto de preenchimento usa a mesma normalização que o ranking já aplica, para não depender de caixa ou espaço
- [ ] Motivo em branco continua agrupado como hoje
- [ ] O ranking continua respeitando o filtro de profissional do relatório
- [ ] As demais quebras do relatório de agenda não mudam
- [ ] O tipo de retorno do relatório no módulo de relatórios acompanha a mudança, e a tela do relatório exibe os grupos
- [ ] A tela segue o design system: grupos distinguidos por texto e selo sutil, nunca por fundo sólido
- [ ] pgTAP cobrindo os três grupos, a exclusão do texto de preenchimento, o filtro de profissional e o isolamento por barbearia do relatório
- [ ] Teste do adaptador do módulo de relatórios lendo os grupos novos, e teste de tela do cartão de motivos
- [ ] `npm run lint`, `npm test` e `npm run build` passam
