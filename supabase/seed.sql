-- =========================================================================
-- SCRIPT DE SEED: Planos Bronze, Prata, Ouro e Dados Demonstrativos
-- =========================================================================

-- Limpar dados existentes (evitar conflitos de chaves)
truncate table public.invoices cascade;
truncate table public.tenant_subscriptions cascade;
truncate table public.plans cascade;
truncate table public.evolution_api_instances cascade;

-- 1. Inserir Planos
insert into public.plans (id, name, price, max_professionals, features, created_at, updated_at) values
('b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'Bronze', 99.00, 3, '{"whatsapp": true, "financeiro": false}'::jsonb, now() - interval '360 days', now()),
('b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'Prata', 199.00, 6, '{"whatsapp": true, "financeiro": true}'::jsonb, now() - interval '360 days', now()),
('b3fa7384-d113-4a1b-a5ed-1efeb7e51c33', 'Ouro', 349.00, 15, '{"whatsapp": true, "financeiro": true, "suporte_prioritario": true}'::jsonb, now() - interval '360 days', now());

-- 2. Inserir Barbearias adicionais para volume
insert into public.tenants (id, name, email, phone, logo_url, created_at, updated_at) values
('71de201b-84e0-40be-b9e2-0022638d5bd1', 'Barbearia Navalha de Ouro', 'contato@navalhadeouro.com', '11988887777', null, now() - interval '180 days', now()),
('71de201b-84e0-40be-b9e2-0022638d5bd2', 'Cortes & Cia', 'financeiro@cortescia.com', '11977776666', null, now() - interval '90 days', now())
on conflict (id) do nothing;

-- Se algum tenant já existia, garantimos que também esteja em tenants
-- tenants existentes: 
-- Barbearia Estilo: d3b07384-d113-4a1b-a5ed-1efeb7e51c24
-- Barber Brooklyn: 71de201b-84e0-40be-b9e2-0022638d5bdb

-- 3. Inserir Instâncias de Whatsapp (Evolution API)
insert into public.evolution_api_instances (id, tenant_id, instance_name, api_key, status, created_at, updated_at) values
(gen_random_uuid(), 'd3b07384-d113-4a1b-a5ed-1efeb7e51c24', 'barbearia-estilo', 'key123', 'connected', now(), now()),
(gen_random_uuid(), '71de201b-84e0-40be-b9e2-0022638d5bdb', 'barber-brooklyn', 'key456', 'connected', now(), now()),
(gen_random_uuid(), '71de201b-84e0-40be-b9e2-0022638d5bd1', 'navalha-ouro', 'key789', 'disconnected', now(), now()),
(gen_random_uuid(), '71de201b-84e0-40be-b9e2-0022638d5bd2', 'cortes-cia', 'key987', 'pairing', now(), now());

-- 4. Inserir Assinaturas (Subscriptions)
insert into public.tenant_subscriptions (id, tenant_id, plan_id, status, start_date, end_date, billing_cycle, created_at, updated_at) values
-- Barbearia Estilo: Prata, Ativo, 10 meses atrás
('e11a7384-d113-4a1b-a5ed-1efeb7e51c01', 'd3b07384-d113-4a1b-a5ed-1efeb7e51c24', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', now() - interval '300 days', now() + interval '65 days', 'monthly', now() - interval '300 days', now()),
-- Barber Brooklyn: Ouro, Ativo, 8 meses atrás
('e11a7384-d113-4a1b-a5ed-1efeb7e51c02', '71de201b-84e0-40be-b9e2-0022638d5bdb', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c33', 'active', now() - interval '240 days', now() + interval '120 days', 'monthly', now() - interval '240 days', now()),
-- Navalha de Ouro: Bronze, Ativo, 6 meses atrás
('e11a7384-d113-4a1b-a5ed-1efeb7e51c03', '71de201b-84e0-40be-b9e2-0022638d5bd1', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'active', now() - interval '180 days', now() + interval '180 days', 'monthly', now() - interval '180 days', now()),
-- Cortes & Cia: Prata, Suspenso, 3 meses atrás (inadimplente)
('e11a7384-d113-4a1b-a5ed-1efeb7e51c04', '71de201b-84e0-40be-b9e2-0022638d5bd2', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'suspended', now() - interval '90 days', now() + interval '30 days', 'monthly', now() - interval '90 days', now());

-- 5. Inserir Invoices (Faturamento Histórico de 12 Meses)
-- Gerando faturas mensais pagas para Barbearia Estilo (R$ 199.00/mês, paga nos últimos 10 meses)
insert into public.invoices (tenant_id, tenant_subscription_id, external_id, amount, status, due_date, paid_at, created_at)
select 
  'd3b07384-d113-4a1b-a5ed-1efeb7e51c24' as tenant_id,
  'e11a7384-d113-4a1b-a5ed-1efeb7e51c01' as tenant_subscription_id,
  'INV-ESTILO-' || to_char(d, 'YYYYMM') as external_id,
  199.00 as amount,
  'paid' as status,
  (d + interval '10 days') as due_date,
  (d + interval '10 days') as paid_at,
  d as created_at
from generate_series(now() - interval '300 days', now() - interval '1 month', interval '1 month') d;

-- Gerando faturas mensais pagas para Barber Brooklyn (R$ 349.00/mês, paga nos últimos 8 meses)
insert into public.invoices (tenant_id, tenant_subscription_id, external_id, amount, status, due_date, paid_at, created_at)
select 
  '71de201b-84e0-40be-b9e2-0022638d5bdb' as tenant_id,
  'e11a7384-d113-4a1b-a5ed-1efeb7e51c02' as tenant_subscription_id,
  'INV-BROOKLYN-' || to_char(d, 'YYYYMM') as external_id,
  349.00 as amount,
  'paid' as status,
  (d + interval '10 days') as due_date,
  (d + interval '10 days') as paid_at,
  d as created_at
from generate_series(now() - interval '240 days', now() - interval '1 month', interval '1 month') d;

-- Gerando faturas mensais pagas para Barbearia Navalha de Ouro (R$ 99.00/mês, paga nos últimos 6 meses)
insert into public.invoices (tenant_id, tenant_subscription_id, external_id, amount, status, due_date, paid_at, created_at)
select 
  '71de201b-84e0-40be-b9e2-0022638d5bd1' as tenant_id,
  'e11a7384-d113-4a1b-a5ed-1efeb7e51c03' as tenant_subscription_id,
  'INV-NAVALHA-' || to_char(d, 'YYYYMM') as external_id,
  99.00 as amount,
  'paid' as status,
  (d + interval '10 days') as due_date,
  (d + interval '10 days') as paid_at,
  d as created_at
from generate_series(now() - interval '180 days', now() - interval '1 month', interval '1 month') d;

-- Faturas para Cortes & Cia (Prata - R$ 199.00/mês)
-- Mês 1 e Mês 2 pagos, Mês 3 (recente) vencida/pendente
insert into public.invoices (tenant_id, tenant_subscription_id, external_id, amount, status, due_date, paid_at, created_at) values
('71de201b-84e0-40be-b9e2-0022638d5bd2', 'e11a7384-d113-4a1b-a5ed-1efeb7e51c04', 'INV-CORTES-01', 199.00, 'paid', now() - interval '75 days', now() - interval '75 days', now() - interval '80 days'),
('71de201b-84e0-40be-b9e2-0022638d5bd2', 'e11a7384-d113-4a1b-a5ed-1efeb7e51c04', 'INV-CORTES-02', 199.00, 'paid', now() - interval '45 days', now() - interval '45 days', now() - interval '50 days'),
('71de201b-84e0-40be-b9e2-0022638d5bd2', 'e11a7384-d113-4a1b-a5ed-1efeb7e51c04', 'INV-CORTES-03', 199.00, 'overdue', now() - interval '15 days', null, now() - interval '20 days');

-- Inserir as faturas pagas deste mês atual para computar a receita mensal na RPC
insert into public.invoices (tenant_id, tenant_subscription_id, external_id, amount, status, due_date, paid_at, created_at) values
('d3b07384-d113-4a1b-a5ed-1efeb7e51c24', 'e11a7384-d113-4a1b-a5ed-1efeb7e51c01', 'INV-ESTILO-CURRENT', 199.00, 'paid', now() - interval '2 days', now() - interval '2 days', now() - interval '5 days'),
('71de201b-84e0-40be-b9e2-0022638d5bdb', 'e11a7384-d113-4a1b-a5ed-1efeb7e51c02', 'INV-BROOKLYN-CURRENT', 349.00, 'paid', now() - interval '1 day', now() - interval '1 day', now() - interval '4 days'),
('71de201b-84e0-40be-b9e2-0022638d5bd1', 'e11a7384-d113-4a1b-a5ed-1efeb7e51c03', 'INV-NAVALHA-CURRENT', 99.00, 'paid', now(), now(), now() - interval '3 days');
