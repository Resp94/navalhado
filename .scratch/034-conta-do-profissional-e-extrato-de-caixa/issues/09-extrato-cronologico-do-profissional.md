# 09: Extrato cronológico do profissional

**What to build:** gestor e profissional passam a ver a Conta do Profissional como extrato: vales,
gorjetas e quitações numa sequência única em ordem cronológica. O gestor responde a qualquer
contestação com dado em vez de memória; o profissional confirma que o que o cliente deixou chegou
até ele e enxerga quanto ainda deve.

O contrato de leitura é **o mesmo para os dois**. A diferença entre o que cada um vê é resolvida
pelas políticas de acesso, não por duas implementações: o gestor lê a conta de qualquer
profissional do tenant, o profissional lê apenas a própria.

Último ticket da spec 034 de propósito: o extrato só é útil quando os três tipos de lançamento
existem — crédito de gorjeta, débito de vale e a quitação que os liquida.

**Blocked by:** 08 (pagamento de gorjeta na quitação).

**Status:** ready-for-agent

- [ ] Contrato de leitura novo devolvendo vales, gorjetas e quitações do profissional numa
      sequência cronológica única, com saldo corrente.
- [ ] Cada linha identifica o tipo de lançamento, o valor, a direção, o motivo e o estado
      (aberto, parcialmente liquidado, liquidado, estornado).
- [ ] Lançamentos estornados aparecem como estornados, com autor e razão — o extrato não apaga
      histórico.
- [ ] Superfície no Hub Financeiro para o gestor consultar o extrato de qualquer profissional do
      tenant.
- [ ] Superfície para o profissional consultar o próprio extrato, e a garantia de que o contrato
      não devolve a conta de colega algum quando chamado por ele.
- [ ] Toda operação registrada na conta mostra quem a fez e quando.
- [ ] Casos de acesso cobertos no arquivo pgTAP da Conta do Profissional.
- [ ] `npm run test` e `npm run test:db` verdes.
