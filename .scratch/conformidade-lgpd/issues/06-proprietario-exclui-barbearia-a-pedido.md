# 06: O Proprietário exclui uma barbearia a pedido

Parte da spec 055 (Conformidade com os novos Termos e Política).

**What to build:** as Ferramentas do Proprietário (Admin > Barbearias) ganham "Excluir dados da barbearia". A ação pede um motivo e a confirmação digitando o nome da barbearia, e é registrada em `audit_logs`.

**O que a exclusão apaga:**

- clientes, agenda, comandas, financeiro, profissionais, serviços, produtos e fornecedores;
- o WhatsApp, inclusive a instância na Uazapi, pela rota de exclusão do ticket 13 da 052;
- as contas do Auth dos Gerentes e Barbeiros.

**O que fica:**

- a linha do tenant, anonimizada;
- `tenant_subscriptions`, `billing_charges` e `billing_events`, que a lei manda guardar por 5 anos;
- os aceites, depois do ticket 08.

**Quando a ação é recusada:** se a barbearia tiver assinatura viva no Mercado Pago.

Hoje não há caminho nenhum para cumprir um pedido de exclusão (LGPD, art. 18, VI).

**Blocked by:** None. O 08 muda o que acontece com os aceites; se o 06 vier antes, os aceites somem com o usuário, como hoje

**Status:** ready

- [ ] Mapear as tabelas com `tenant_id` e as chaves estrangeiras antes de escrever a função (anotar no resultado)
- [ ] Migration só no DEV: função `private`, chamada por uma RPC guardada por `private.assert_saas_admin()`
- [ ] A exclusão na Uazapi acontece fora da transação do banco (pela edge function). Se a Uazapi falhar, os dados do banco não são apagados, e o erro volta à tela
- [ ] pgTAP:
  - a guarda recusa Gerente, Barbeiro, anônimo e Gerente com `tenant_id` nulo;
  - a assinatura viva é recusada;
  - o que some e o que fica;
  - outra barbearia não é tocada
- [ ] Vitest da ferramenta: confirmação por nome e motivo obrigatório
- [ ] Nenhuma exclusão real no DEV sem o OK do usuário, indicando qual barbearia
- [ ] Gates de lint, Vitest e build passam
