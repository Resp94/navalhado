# 06: Abate de vale na Quitação de Comissão

**What to build:** na tela de Quitação de Comissão, o gestor passa a ver o líquido sugerido —
comissão menos vales em aberto — e paga o valor certo sem calcular à mão. Hoje, ou ele lembra do
vale e abate na cabeça, ou paga a comissão cheia e o vale vira prejuízo silencioso.

A sugestão **não é imposta**: o gestor pode ignorá-la e pagar outro valor, mantendo a decisão de
quando cobrar o vale. Quando ele aceita, o abate consome os vales mais antigos primeiro, para que
a dívida seja quitada na ordem em que foi assumida, e cada lançamento abatido fica vinculado à
quitação que o cobriu. Estornar a Quitação de Comissão devolve os vales ao estado aberto.

O estorno pertence a este ticket, não a um seguinte: separá-los criaria uma janela em que estornar
uma quitação deixaria o vale liquidado indevidamente.

**A assinatura da quitação ganha os dois parâmetros de uma vez** — débitos a abater e créditos a
pagar —, mas o de crédito é recusado com erro explícito até o ticket 07 liberá-lo. Assim o custo
de derrubar a assinatura antiga e refazer os privilégios é pago uma única vez.

**Blocked by:** 05 (vale como débito).

**Status:** ready-for-agent

- [ ] O contrato de leitura de saldo de comissão por profissional é **estendido**, não
      substituído, devolvendo também o saldo da Conta do Profissional discriminado em crédito e
      débito, mais o líquido sugerido. O líquido exibido e o líquido liquidado passam a vir da
      mesma origem. Verificado: o contrato devolve `jsonb`, então acrescentar chaves não altera
      assinatura nem tipo de retorno — `create or replace` basta, sem drop e sem refazer
      privilégios. O consumo no front é num único ponto, no adaptador Supabase de comissões.
- [ ] A quitação aceita o total de débitos a abater, consumido em ordem cronológica crescente do
      lançamento, expressando abate parcial naturalmente.
- [ ] O parâmetro de créditos existe na assinatura e é recusado com erro explícito quando
      diferente de zero ou nulo.
- [ ] Tabela de rateio entre quitação e lançamento, espelhando o rateio que já existe entre
      quitação e obrigação de comissão.
- [ ] Acrescentar parâmetro cria assinatura nova: a migração **derruba a assinatura anterior na
      mesma transação** e refaz a revogação de acesso público e anônimo mais a concessão explícita
      aos papéis autenticado e de serviço. O repositório já pagou o preço de um overload legado
      vivo uma vez.
- [ ] **Ordem de lock fixa e documentada**: obrigações de comissão sempre antes de lançamentos da
      Conta do Profissional, ambas em ordem cronológica crescente, para que duas quitações
      concorrentes não se travem mutuamente.
- [ ] Estorno de quitação devolve os vales abatidos ao estado aberto, do mesmo modo que já devolve
      obrigações.
- [ ] O líquido sugerido é igual ao líquido liquidado na fronteira de arredondamento entre os dois
      tipos monetários (precisão fixa de duas casas nos movimentos de caixa, precisão não
      declarada nas obrigações de comissão), com arredondamento explícito a duas casas.
- [ ] Arquivo pgTAP novo de quitação com Conta do Profissional, cobrindo abate parcial FIFO,
      rateio, estorno, concorrência e arredondamento.
- [ ] Cobertura de contrato no módulo de Comissões e no adaptador Supabase.
- [ ] `npm run test` e `npm run test:db` verdes.
