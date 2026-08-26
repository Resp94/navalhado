# 02 — Persistência Imediata de Itens na Comanda

**What to build:** Persistência imediata de qualquer serviço ou produto adicionado ou removido de uma comanda aberta no modal de checkout, gravando no banco em tempo real e atualizando o valor total sem depender do fechamento da comanda, além de criar a comanda com status `aberta` na primeira adição de item caso seja uma nova comanda avulsa.

**Blocked by:** 01 — Atendimento e Encaixe de Balcão sem Cliente.

**Status:** ready-for-agent

- [ ] Atualizar o modal de checkout (`ComandaCheckoutModal.tsx`) para chamar `comRepo.adicionarItem(...)` imediatamente ao confirmar a inclusão de um serviço ou produto.
- [ ] Atualizar o modal de checkout para chamar `comRepo.removerItem(...)` imediatamente ao excluir um item da comanda.
- [ ] Implementar a criação automática da comanda com status `aberta` no banco de dados assim que o primeiro item for adicionado em uma nova comanda avulsa.
- [ ] Garantir que o valor total da comanda (`comandas.total_amount`) seja recalculado e atualizado atomicamente no banco após cada adição ou remoção de item.
- [ ] Garantir que navegar para outra tela ou fechar o modal preserve integralmente todos os itens adicionados ao reabrir a comanda.
- [ ] Atualizar testes unitários em `ComandaCheckoutModal.test.tsx`.
