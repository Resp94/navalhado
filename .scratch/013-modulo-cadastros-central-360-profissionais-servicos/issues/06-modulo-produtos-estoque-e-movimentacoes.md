# 06 — Módulo de Produtos e Gestão de Estoque (Venda Balcão vs Insumo, Movimentações e Alertas)

**What to build:**
Implementar a tela dedicada `/produtos` no painel do Gerente com classificação entre venda balcão (`retail`) e insumo de bancada (`internal_use`), registro de movimentações de estoque, alertas de reposição e inclusão da rota na Navbar com `PackageIcon` (mantendo todos os ícones existentes intactos).

**Blocked by:** 01 — Migração de Banco Versionada 018 (Expansão de Clientes, Serviços e Produtos, Tabela N:N, Drop Payments e RLS Granular)

**Status:** done

- [x] Criar a página `src/pages/gerente/Produtos.tsx` e o módulo `src/modules/produtos/` com tipos, métodos CRUD e RPC `adjust_product_stock`.
- [x] Adicionar a rota `/produtos` no roteador e na Navbar superior horizontal do `GerenteLayout.tsx` utilizando `PackageIcon` da biblioteca `@hugeicons/core-free-icons`, preservando 100% dos ícones já existentes.
- [x] Implementar listagem de produtos com busca por texto (nome, marca ou categoria) e filtro por tipo de uso (Todos, Venda Balcão, Insumo de Bancada).
- [x] Implementar badges semânticos de status de estoque (Verde: Normal, Âmbar/Vermelho: "Estoque Baixo" quando `stock_quantity <= min_stock_alert`).
- [x] Construir o Modal *Double-Bezel* de cadastro e edição de produtos (Nome, Marca, Categoria, Tipo de Uso, Unidade de Medida, Preço de Custo, Preço de Venda, Quantidade Inicial, Alerta de Estoque Mínimo e Comissão de Venda).
- [x] Implementar modal de ajuste rápido de estoque (entrada manual, compra ou perda/consumo interno) integrado à RPC `adjust_product_stock` e tabela `product_movements`.
- [x] Criar testes unitários para a listagem, filtros, cálculo de alertas e movimentações de produtos.
- [x] Realizar validação visual no navegador em `http://localhost:5173/produtos`.


