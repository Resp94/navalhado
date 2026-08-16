# 04 — Modal de Checkout de Comandas com Múltiplos Itens e Divisão de Pagamento

**What to build:**
Desenvolver o modal completo de Checkout da Comanda (`ComandaCheckoutModal.tsx`) acionado pelo botão "Cobrar" na grade, suportando inclusão dinâmica de serviços extras, produtos físicos com baixa de estoque, descontos %, gorjetas e divisão de pagamento (ex: PIX + Dinheiro com calculadora de troco).

**Blocked by:** 03 — Sessão de Caixa: Abertura Assistida no Checkout e Controle de Turno Diário.

**Status:** ready-for-agent

- [x] Criar modal de Checkout de Comanda exibindo dados do cliente, profissional e itens associados.
- [x] Botão `+ Serviço` para adicionar novos serviços prestados com seleção do barbeiro comissionado.
- [x] Botão `+ Produto` com busca de produtos ativos, preço e estoque.
- [x] Campos de Desconto (Percentual e Valor Fixo) e Gorjeta do Barbeiro com recálculo do Total em tempo real.
- [x] Seção de Divisão de Pagamento permitindo combinar PIX, Cartão e Dinheiro até totalizar o saldo da comanda.
- [x] Calculadora automática de troco quando houver pagamento em dinheiro físico.
- [x] Baixa de estoque do produto (`products.stock_quantity`) e transição do agendamento para `completed` e verde na grade.
- [x] Testes unitários do modal de checkout de comanda.
