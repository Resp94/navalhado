# 04 — Aba 2: Repasses de Comissões, Detalhamento e Quitação

**What to build:**
Superfície operacional da Aba 2 no Hub Financeiro (`/financeiro`), permitindo ao gestor acompanhar os saldos de comissões por barbeiro, inspecionar o detalhamento das comandas que originaram o valor devido e registrar a quitação de comissões aos profissionais via modal `QuitacaoComissaoModal.tsx` conectado à RPC `register_commission_payout` e tabela `public.commission_payouts`.

**Blocked by:**
- 02 — Painel de Indicadores Financeiros (KPIs) com Destaque para Produtos e Custos (CMV)

**Status:** ready-for-agent

- [ ] Renderizar tabela/cards de profissionais ativos com avatar, nome, total de serviços/produtos realizados, comissão gerada, valor pago e saldo pendente.
- [ ] Implementar visualização/gaveta com itens de comandas faturadas pelo barbeiro para auditoria detalhada de serviços e produtos prestados.
- [ ] Criar modal de quitação `QuitacaoComissaoModal.tsx` com seleção de valor (total ou parcial), método de pagamento (PIX, Dinheiro da Gaveta, Transferência), data do repasse e campo de observações/recibo.
- [ ] Conectar o envio à RPC `register_commission_payout`, persistindo o repasse em `public.commission_payouts` e atualizando o saldo do barbeiro e os KPIs do topo instantaneamente.
- [ ] Exibir histórico recente de quitações realizadas para cada profissional.
