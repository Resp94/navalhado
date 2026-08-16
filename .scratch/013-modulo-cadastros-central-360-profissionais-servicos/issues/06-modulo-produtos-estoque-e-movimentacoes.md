# 06 — Módulo de Produtos e Gestão de Estoque (Venda Balcão vs Insumo, Código de Barras, Movimentações e Alertas)

**What to build:**
Implementar a tela dedicada `/produtos` no painel do Gerente com leitor de código de barras (EAN-13), classificação entre venda balcão (`retail`) e insumo de bancada (`internal_use`), registro de movimentações de estoque, alertas de reposição e inclusão da rota na Navbar com `PackageIcon` (mantendo todos os ícones existentes intactos).

**Blocked by:** 01 — Migração de Banco Versionada 018 (Expansão de Clientes, Serviços e Produtos, Tabela N:N, Drop Payments e RLS Granular)

**Status:** ready-for-agent

- [ ] Criar a página `src/pages/gerente/Produtos.tsx` e o módulo `src/modules/produtos/` com tipos, métodos CRUD e RPC `adjust_product_stock`.
- [ ] Adicionar a rota `/produtos` no roteador e na Navbar superior horizontal do `GerenteLayout.tsx` utilizando `PackageIcon` da biblioteca `@hugeicons/core-free-icons`, preservando 100% dos ícones já existentes.
- [ ] Implementar listagem de produtos com busca por texto ou código de barras EAN-13 e filtro por tipo de uso (Todos, Venda Balcão, Insumo de Bancada).
- [ ] Implementar badges semânticos de status de estoque (Verde: Normal, Âmbar/Vermelho: "Estoque Baixo" quando `stock_quantity <= min_stock_alert`).
- [ ] Construir o Modal *Double-Bezel* de cadastro e edição de produtos (Nome, Marca, Categoria, Tipo de Uso, Unidade de Medida, Preço de Custo, Preço de Venda, Quantidade Inicial, Alerta de Estoque Mínimo, Código de Barras e Comissão de Venda).
- [ ] Implementar modal de ajuste rápido de estoque (entrada manual, compra ou perda/consumo interno) integrado à RPC `adjust_product_stock` e tabela `product_movements`.
- [ ] Criar testes unitários para a listagem, filtros, cálculo de alertas e movimentações de produtos.
- [ ] Realizar validação visual no navegador em `http://localhost:5173/produtos`.
