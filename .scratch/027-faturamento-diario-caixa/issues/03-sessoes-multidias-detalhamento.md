# 03 — Detalhamento de sessões que atravessam dias

**What to build:** Quando uma sessão de caixa atravessa dois ou mais dias locais, o gerente visualiza uma linha independente para cada data, incluindo dias sem movimentação, em vez de depender somente do total acumulado.

**Blocked by:** 01 — MVP de faturamento diário no Caixa

**Status:** ready-for-agent

- [ ] Determinar o intervalo padrão da sessão ativa pela data local de abertura até a data local atual.
- [ ] Permitir detalhamento por sessão quando uma sessão histórica for selecionada.
- [ ] Separar faturamento por data de fechamento da comanda.
- [ ] Separar recebimentos por data de pagamento e, quando aplicável, pela sessão de caixa.
- [ ] Exibir dias sem movimentação com valores zerados quando fizerem parte do intervalo da sessão.
- [ ] Manter disponíveis os totais acumulados atuais sem substituir as linhas diárias.
- [ ] Cobrir sessão de dois ou mais dias, virada de fuso e dia sem movimento.
- [ ] Reproduzir o cenário com dados controlados no banco de desenvolvimento.
