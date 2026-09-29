-- Spec 052, ticket 05 (revisao de codigo): o historico de cobrancas sobrevive a exclusao do tenant.
--
-- billing_charges tinha `on delete cascade`: apagar o tenant (exclusao a pedido, feita pelo
-- suporte) levava junto todas as cobrancas, e nao sobrava registro do que foi recebido para
-- conciliacao ou obrigacao fiscal. Agora a linha fica com tenant_id nulo: continua valendo para
-- o dinheiro recebido, sem apontar para a barbearia apagada. A politica de leitura ja esconde a
-- linha de tenant nulo de todo Gerente (tenant_id nulo nunca e igual ao do usuario); so o
-- Proprietario a le.

alter table public.billing_charges alter column tenant_id drop not null;

alter table public.billing_charges drop constraint billing_charges_tenant_id_fkey;
alter table public.billing_charges
  add constraint billing_charges_tenant_id_fkey
  foreign key (tenant_id) references public.tenants(id) on delete set null;
