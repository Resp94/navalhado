# 01: Prefactor — extrair o bloco de gorjeta do checkout de Comanda

**What to build:** nenhuma mudança de comportamento visível. O campo de gorjeta que já existe no
checkout de Comanda passa a viver num componente próprio, recebendo o valor atual e devolvendo a
alteração, para que o ticket 04 possa acrescentar a escolha do profissional sem editar um modal
de mais de três mil e setecentas linhas. Make the change easy, then make the easy change.

A extração não cria arquivo de teste próprio: a cobertura continua pelo teste do modal de
checkout que já existe, e é justamente ele que prova que nada mudou.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] O componente extraído recebe o valor de gorjeta e notifica alteração, sem conhecer o
      restante do estado do checkout.
- [ ] O fluxo de fechamento de Comanda com gorjeta continua idêntico, incluindo validação de
      valor inválido e o total apresentado ao cliente.
- [ ] A suíte de testes do modal de checkout passa sem alteração nas asserções — mudanças nas
      asserções seriam sinal de que o comportamento mudou.
- [ ] `npm run test` verde.
