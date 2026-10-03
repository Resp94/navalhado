-- Spec 054, ticket 04: sai a tabela public.invoices.
--
-- Criada na migration das rotas do Proprietario (2026-07-12) para um desenho de faturas que nunca foi implementado: nenhum codigo
-- grava nela (a cobranca real fica em public.billing_charges) e, depois do ticket 02, nenhuma funcao a le. Conferido antes: sem
-- linhas no DEV, sem funcao, view nem chave estrangeira que dependa dela (a conferencia na PROD fica para a promocao da spec 052).
-- As policies (invoices_*_policy) e os indices (idx_invoices_tenant_id, idx_invoices_tenant_subscription_id, a chave primaria e a
-- unica de external_id) saem junto com a tabela. Sem CASCADE: se algo dependesse dela, o comando falharia em vez de levar o objeto.
drop table public.invoices;
