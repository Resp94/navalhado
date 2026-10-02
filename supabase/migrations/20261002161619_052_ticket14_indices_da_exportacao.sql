-- Spec 052, ticket 14 (revisão): índices da leitura por chave da Exportação de Dados.
--
-- A exportação lê cada tabela da barbearia por chave (`tenant_id = X and id > último id lido order by id limit 1000`), uma página
-- por pedido, com a sessão do Gerente. O papel `authenticated` tem `statement_timeout` de 8 s. Sem um índice `(tenant_id, id)` o
-- planejador percorre a chave primária filtrando por barbearia (passa por linhas de todas as barbearias até achar as da barbearia)
-- ou ordena as linhas da barbearia a cada página; com ele, cada página é uma leitura de faixa, qualquer que seja o tamanho da tabela.
--
-- Só as cinco tabelas que crescem com o uso. Profissionais, serviços e produtos são dezenas de linhas por barbearia.
-- `create index` comum bloqueia a escrita da tabela enquanto cria: aceitável com o volume de hoje (duas barbearias em produção); com
-- muito dado, o índice teria de ser criado com `concurrently`, fora de uma migration.
create index if not exists idx_customers_tenant_id_id on public.customers (tenant_id, id);
create index if not exists idx_appointments_tenant_id_id on public.appointments (tenant_id, id);
create index if not exists idx_comandas_tenant_id_id on public.comandas (tenant_id, id);
create index if not exists idx_comanda_itens_tenant_id_id on public.comanda_itens (tenant_id, id);
create index if not exists idx_comanda_pagamentos_tenant_id_id on public.comanda_pagamentos (tenant_id, id);
