# 07: Saídas previstas e Contas a Pagar Vencidas

**What to build:** o gestor passa a ver o que ainda vai sair: cada Conta a Pagar em aberto aparece
como Saída Prevista na data de vencimento, pelo saldo restante. Uma conta paga em parte não é contada
inteira, e uma conta cancelada não pesa na projeção.

As Contas a Pagar Vencidas e ainda não pagas entram no período que contém hoje, destacadas como
atrasadas e com a data original de vencimento no detalhamento. Sumir com uma dívida porque ela venceu
no passado é o erro mais caro que um fluxo de caixa pode cometer. Previstas e vencidas ficam em campos
separados e nenhuma conta é contada nos dois. Juros e multa de atraso futuros não são projetados:
só existem quando a Baixa acontece.

O saldo restante é o valor da conta menos o valor baixado, e por isso este ticket depende das Baixas
da spec 036, e não só do livro de Contas a Pagar.

**Cadeia sequencial:** este ticket redefine a mesma função de leitura do fluxo que os tickets 01, 02,
03, 05 e 08. Não pode correr em paralelo com outro ticket da cadeia.

Spec: `specs/037-fluxo-de-caixa-projetado/spec.md`, seções "Dependência e posição na sequência" e
"Saídas previstas".

**Blocked by:** 05 (Compromissos sem Data), 06 (gráfico e detalhamento), 036/07 — Baixa fora do
caixa e Estorno de Baixa.

**Status:** ready-for-agent

- [ ] Toda Conta a Pagar em aberto ou parcialmente paga gera saída prevista pelo saldo restante, no
      agrupamento que contém o vencimento, quando o vencimento é hoje ou depois.
- [ ] Conta parcialmente paga é prevista pelo saldo restante, e não pelo valor inteiro.
- [ ] Contas pagas e canceladas não geram previsão; conta cancelada não aparece no fluxo.
- [ ] Conta vencida (em aberto ou parcialmente paga, com vencimento anterior ao dia de negócio de
      hoje) entra só no agrupamento atual, no campo de vencidas, marcada como atrasada.
- [ ] Nenhuma conta aparece ao mesmo tempo em saídas previstas e vencidas.
- [ ] Conta com vencimento depois do fim do período não aparece.
- [ ] Juros e multa futuros não são projetados.
- [ ] Saídas previstas e vencidas entram no fluxo pendente do agrupamento, e a curva passa a
      considerá-las.
- [ ] Um período inteiramente passado não devolve previsão nem vencidas.
- [ ] Detalhamento devolve a lista de Contas a Pagar previstas com descrição, saldo restante,
      vencimento original e marca de atrasada.
- [ ] Na aba, cartão de saídas previstas no resumo com vencidas em destaque; valores previstos com
      rótulo textual "previsto" e, no gráfico, preenchimento distinto com legenda.
- [ ] No detalhamento, cada Conta a Pagar prevista leva à própria conta na aba de Contas a Pagar.
- [ ] Teste da aba com repositório falso injetado cobre o destaque de vencidas.
- [ ] Adaptador Supabase converte os campos novos e a lista de previstas.
- [ ] `CONTEXT.md` ganha o termo Saída Prevista.
- [ ] Casos adicionados ao arquivo pgTAP do fluxo de caixa projetado, usando o núcleo com relógio
      injetado para as vencidas.
- [ ] `npm run test` e `npm run test:db` verdes.
