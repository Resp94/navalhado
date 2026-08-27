# 06 — Comissões por Item na Comanda (Minhas Comissões)

**What to build:** Corrigir a tela "Minhas Comissões" do profissional para apurar faturamento e comissões diretamente a partir de `comanda_itens.professional_id` em comandas fechadas, garantindo que serviços e produtos adicionais executados por outros profissionais na mesma comanda gerem ganhos exatos para quem os executou, em 100% de harmonia com o Hub Financeiro.

**Blocked by:** 02 — Persistência Imediata de Itens na Comanda.

**Status:** completed

- [x] Refatorar a query de dados em `src/pages/barbeiro/MinhasComissoes.tsx` para consultar `public.comanda_itens` vinculados ao `professional_id` do usuário logado, filtrando por comandas com status `fechada` no período.
- [x] Realizar join em `comandas`, `services` e `products` para extrair nome do item, percentual de comissão e total faturado.
- [x] Calcular comissão individual de cada item com base na regra do serviço ou percentual do profissional.
- [x] Tratar clientes de balcão anônimos na listagem (`comanda.customer?.name || 'Cliente Balcão'`).
- [x] Assegurar que a comanda atue apenas como agrupador e que a atribuição financeira obedeça 100% a `comanda_itens.professional_id`.
- [x] Atualizar testes unitários em `MinhasComissoes.test.tsx`.
