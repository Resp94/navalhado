# 02 — Painel de Indicadores Financeiros (KPIs) com Destaque para Produtos e Custos (CMV)

**What to build:**
Seção superior da rota `/financeiro` com 5 cards analítico-operacionais integrados à RPC `get_tenant_financial_metrics`, permitindo ao gerente acompanhar de relance: Faturamento bruto, Faturamento de serviços, Venda de produtos de balcão (com badge de unidades vendidas e custo total de reposição CMV), Comissões da equipe (com valor total acumulado e valor pago vs pendente) e Faturamento líquido real (`Faturamento - Comissões - Custo de Produtos`), acompanhado de seletor dinâmico de período (*Este mês*, *Últimos 30 dias*, *Últimos 90 dias*).

**Blocked by:**
None — can start immediately.

**Status:** ready-for-agent

- [x] Integrar consumo da RPC `get_tenant_financial_metrics` com os novos campos de retorno (`services_revenue`, `products_revenue`, `products_count`, `products_cost`, `total_commission`, `paid_commission`, `pending_commission`, `net_revenue`).
- [x] Construir os 5 cards de KPIs superiores utilizando tokens de cor semântica e tipografia de alto contraste com suporte a tela responsiva.
- [x] Implementar seletor dinâmico de período com recálculo instantâneo sem recarregamento de página.
- [x] Exibir tooltip explicativo no card de Lucro Líquido detalhando a fórmula de dedução operacional: `Lucro Líquido = Faturamento - Comissões - Custo CMV`.

