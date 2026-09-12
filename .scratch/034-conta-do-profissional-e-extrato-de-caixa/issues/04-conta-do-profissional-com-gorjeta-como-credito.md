# 04: Conta do Profissional com gorjeta como crédito

**What to build:** a gorjeta cobrada do cliente passa a chegar ao profissional. Ao fechar uma
Comanda com gorjeta, a recepção informa de quem ela é — e o sistema resolve sozinho quando há um
único profissional na Comanda, sem perguntar o óbvio. O valor vira crédito na Conta do
Profissional, e o profissional consegue conferir as próprias gorjetas.

Hoje o valor é somado ao total da Comanda, entra na gaveta e a partir dali não existe registro de
que aquele dinheiro pertence a alguém.

Este ticket cria a **Conta do Profissional**: extrato de créditos e débitos por profissional,
separado da comissão automática de atendimentos. O vale (débito) chega no ticket 06.

**A gorjeta não passa pelo motor de comissão.** A ADR 018 decidiu que gorjeta não gera comissão e
determinou que qualquer mudança no repasse fosse decisão registrada, não ajuste incidental na
função de liquidação. Logo: a tabela de obrigações de comissão e os snapshots de comissão ficam
intocados, e o crédito nasce de um **trigger próprio** sobre a Comanda ao assumir o estado
fechada, separado do trigger que cria obrigações de comissão.

A tabela de lançamentos carrega **duas colunas discriminadoras** (decisão de projeto, não
detalhe):

```
entry_type  -- 'vale' | 'gorjeta'   (semântica do lançamento)
direction   -- 'debit' | 'credit'   (aritmética do saldo)
```

Guardar a direção separada do tipo é lição tirada do defeito tratado no ticket 03: com a direção
materializada, somar créditos e subtrair débitos permanece correto quando um terceiro tipo de
lançamento aparecer, sem exigir a edição de várias fórmulas sob pena de erro silencioso de saldo.

Comandas fechadas antes deste ticket **não recebem backfill**: a atribuição vale para Comandas
novas, e o histórico é apresentado como gorjeta sem atribuição — dado factual, não dívida
retroativa inventada com a equipe.

**Blocked by:** 01 (prefactor do bloco de gorjeta no checkout).

**Status:** ready-for-agent

- [ ] Tabela de lançamentos da Conta do Profissional criada com `entry_type` e `direction`, valor
      em precisão fixa de duas casas, valor positivo, valor liquidado limitado ao total, estado do
      lançamento, motivo e trilha de estorno com autor e razão.
- [ ] Comanda persiste a atribuição da gorjeta. A atribuição **não** pode viver só na interface:
      sem ela persistida, reabrir a Comanda perde de quem era a gorjeta e o estorno não sabe qual
      crédito reverter.
- [ ] O checkout pede a escolha do profissional apenas quando a Comanda tem mais de um; com um
      só, resolve sozinho.
- [ ] Fechar Comanda com gorjeta gera crédito na Conta do Profissional atribuído, via trigger
      próprio, sem alterar a função de liquidação de comissão nem os snapshots de comissão.
- [ ] Índice único parcial impede crédito de gorjeta duplicado por Comanda, ignorando lançamentos
      estornados — reabrir e fechar de novo gera o crédito correto sem colidir com o antigo.
- [ ] Reabrir Comanda estorna o crédito de gorjeta.
- [ ] Escrita restrita aos papéis de gestão, seguindo o padrão de papéis financeiros vigente, com
      chamadas de contexto de autenticação envolvidas em subconsulta (avaliação única por
      consulta, não por linha).
- [ ] O profissional lê os próprios lançamentos e **apenas** os próprios, por predicado de
      propriedade combinado ao papel. Política de atualização declara verificação de escrita além
      da de leitura, para que um lançamento não possa ser reatribuído a outro profissional.
- [ ] ADR 019 escrita, registrando o repasse de gorjeta como decisão distinta de comissionar
      gorjeta, e referenciando a ADR 018.
- [ ] Arquivo pgTAP novo da Conta do Profissional cobrindo lançamento, dedup na reabertura e
      isolamento de leitura entre profissionais.
- [ ] `npm run test` e `npm run test:db` verdes.
