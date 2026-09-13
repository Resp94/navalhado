# 02: Prévia da gaveta lida do banco

**What to build:** o gestor passa a ver na tela o valor esperado da gaveta já descontando repasses
de comissão e vales pagos em dinheiro. Hoje a prévia só considera suprimento e sangria: em
qualquer turno com Quitação de Comissão ou vale em dinheiro, ele conta a gaveta contra um número
maior que o real — e o caso mais grave é o modal de Fechamento de Caixa, que mostra a diferença
antes de ele confirmar a contagem.

A causa foi uma fórmula replicada no navegador, e a correção é não replicá-la: a função de domínio
que recompõe o valor esperado é removida, e os três pontos que a usam passam a ler o contrato de
leitura criado no ticket 01. Assim, a diferença mostrada antes de fechar é a diferença que fica
registrada.

A mudança é na aba de Caixa, por isso vem depois do Hub em sub-rotas da 035, para não disputar o
mesmo componente.

Spec: `specs/036-contas-a-pagar/spec.md`, seção "Entrega 1 — Apuração única do valor esperado da
gaveta" (prévia da tela) e "Interface".

**Blocked by:** 01 — Expand: apuração única do valor esperado da gaveta no servidor;
035/02 — Hub Financeiro em sub-rotas.

**Status:** done

- [x] O módulo de Caixa ganha o método de leitura do saldo apurado da gaveta, consumindo o
      contrato do ticket 01, e perde a função de domínio de valor esperado.
- [x] O modal de Fechamento de Caixa mostra o valor esperado e a diferença a partir do contrato.
- [x] O resumo da sessão ativa na aba de Caixa mostra o valor esperado a partir do contrato.
- [x] A visão móvel de caixa mostra o valor esperado a partir do contrato.
- [x] Num turno com repasse de comissão ou vale em dinheiro, o valor exibido já os desconta
      (história 1), e é igual ao valor que o fechamento persiste (história 2).
- [x] A atualização em tempo real que a aba de Caixa já assina sobre movimentos de caixa passa a
      recarregar o contrato.
- [x] Sessões fechadas continuam mostrando o valor persistido no fechamento, inclusive as fechadas
      com versões de cálculo anteriores.
- [x] Testes de repositório e de adaptador do módulo de Caixa trocam os casos da função removida
      pelos casos do contrato de saldo apurado.
- [x] Os testes existentes do modal de Fechamento de Caixa e da página do Hub Financeiro continuam
      passando, com um caso novo mostrando o valor esperado vindo do contrato, e não recomposto no
      navegador.
- [x] `npm run test` verde.

**Notas de implementação:**

- `ICaixaAdapter` ganhou `obterValorEsperadoGaveta(sessionId, tenantId): Promise<CashSessionExpectedAmount>`
  (acrescentado ao fim da interface, sem tocar métodos existentes). `SupabaseCaixaAdapter` implementa
  chamando a RPC `get_cash_session_expected_amount` do ticket 01/036. `CaixaRepository` expõe
  `getExpectedDrawerAmount(sessionId, tenantId)` (com validação de sessão/tenant) e o alias pt-BR
  `obterValorEsperadoGaveta`, seguindo o padrão de aliases já existente no repositório.
- Novo tipo `CashSessionExpectedAmount` em `src/modules/caixa/types.ts` (mais `CashMovementDirection`
  e `CashSessionMovementTypeAmount`), espelhando exatamente as chaves do jsonb devolvido pela RPC.
- A função de domínio `calculateExpectedDrawerCash` foi removida de `CaixaRepository.ts`. Os três
  consumidores (`CaixaTab.tsx`, `FechamentoCaixaModal.tsx`, `MobileCaixaView.tsx`) não a importam mais.
- `CaixaTab.tsx`: `fetchCaixaData` (já registrada como recarga da aba e chamada a cada evento
  realtime de `cash_movements`/`cash_sessions` pelo painel) agora também busca o contrato e guarda
  `expectedDrawerAmount`, `repassesComissaoTotal` e `valesTotal` (estes dois derivados de
  `movements_by_type`, usados só para exibir os itens do detalhamento). A chamada ao contrato está
  isolada num `try/catch` próprio: como a RPC só aceita sessão ABERTA, se a sessão fechar entre o
  `getActiveSession` do painel e esta leitura, o erro não derruba a carga do resto da aba (fica
  0 até a próxima recarga). `expectedDrawerAmount`, `repassesComissaoTotal` e `valesTotal` descem
  como props para `MobileCaixaView` e `FechamentoCaixaModal`.
- `FechamentoCaixaModal.tsx`: os três novos props (`expectedDrawerAmount`, `repassesComissaoTotal`,
  `valesTotal`) são opcionais; quando o pai não os informa, o modal busca sozinho via
  `caixaRepo.getExpectedDrawerAmount`, no mesmo efeito que já buscava `turnSummary` como fallback
  (mesmo padrão, para uso do modal fora do `CaixaTab`). O detalhamento da conferência ganhou duas
  linhas nova (Repasses de comissão / Vales em dinheiro), só exibidas quando > 0, para que os itens
  listados somem para o total exibido — sem isso o total já vinha correto do contrato, mas parecia
  "não bater" com os itens visíveis sempre que havia repasse ou vale no turno.
- Sessões fechadas não usam este contrato: continuam lendo os campos persistidos em
  `cash_sessions` (`closing_amount`, `expected_amount`, etc.) no histórico e na visão móvel, como já
  faziam antes deste ticket — nenhuma mudança necessária aí.
- Escopo respeitado: não toquei `handleSangria`/`handleSuprimento`, `registrarMovimentacao` nem
  `obterResumoMovimentacoes` (ficam para o ticket 03), nem `ExtratoSessaoCaixaModal.tsx` (ticket 05).
- Achado do code review não corrigido (fora de escopo, registrado para os próximos tickets):
  `obterResumoMovimentacoes` soma `cash_movements` sem filtrar `reversed_at`; hoje bate com o
  contrato porque suprimento/sangria não podem ser estornados, mas se um ticket futuro permitir
  estornar esses dois tipos (como já existe para repasse/vale), essa soma pode divergir
  silenciosamente do `expected_amount` do contrato. Vale revisar quando isso mudar.
