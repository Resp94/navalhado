begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Spec 052, ticket 02: limite de profissionais no banco.
--
-- O gatilho private.enforce_professional_plan_limit recusa incluir um
-- profissional ativo (sem deleted_at), reativar um profissional excluido ou
-- mover um profissional ativo para uma barbearia que ja esta no limite do plano
-- da sua assinatura. Erro: SQLSTATE 53400, mensagem PROFESSIONAL_LIMIT_REACHED.
-- Sem assinatura, sem limite. is_active = false nao libera vaga: so excluir.

insert into public.tenants (name, email, phone) values
  ('__t64_tesoura__', '__t64_tesoura__@teste.com', '11999999641'),
  ('__t64_maquina__', '__t64_maquina__@teste.com', '11999999642'),
  ('__t64_maquina_2__', '__t64_maquina_2__@teste.com', '11999999643'),
  ('__t64_gerente__', '__t64_gerente__@teste.com', '11999999644'),
  ('__t64_gerente_vinc__', '__t64_gerente_vinc__@teste.com', '11999999645'),
  ('__t64_sem_assinatura__', '__t64_sem_assinatura__@teste.com', '11999999646');

insert into public.tenant_subscriptions (tenant_id, plan_id, status)
select t.id, v.plano::uuid, 'active'
from public.tenants t
join (values
  ('__t64_tesoura__', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11'),
  ('__t64_maquina__', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22'),
  ('__t64_maquina_2__', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22'),
  ('__t64_gerente__', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11'),
  ('__t64_gerente_vinc__', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11')
) as v(nome, plano) on v.nome = t.name;

insert into auth.users (id, email)
select gen_random_uuid(), '__t64_' || n || '__@teste.com'
from unnest(array['ger', 'gervinc']) as n;

update public.users u
set tenant_id = (select id from public.tenants where name = '__t64_gerente__'), role = 'gerente', is_active = true
where u.email = '__t64_ger__@teste.com';

update public.users u
set tenant_id = (select id from public.tenants where name = '__t64_gerente_vinc__'), role = 'gerente', is_active = true
where u.email = '__t64_gervinc__@teste.com';

-- Tesoura: um profissional cabe, o segundo nao.
select lives_ok(
  $$insert into public.professionals (tenant_id, name, phone, commission_percentage)
    select id, 'T64 T1', '11988800001', 10 from public.tenants where name = '__t64_tesoura__'$$,
  'Tesoura aceita o primeiro profissional'
);

select throws_ok(
  $$insert into public.professionals (tenant_id, name, phone, commission_percentage)
    select id, 'T64 T2', '11988800002', 10 from public.tenants where name = '__t64_tesoura__'$$,
  '53400',
  'PROFESSIONAL_LIMIT_REACHED',
  'Tesoura recusa o segundo profissional ativo'
);

select is(
  (select count(*)::integer from public.professionals p join public.tenants t on t.id = p.tenant_id where t.name = '__t64_tesoura__'),
  1,
  'a inclusao recusada nao deixa nada gravado'
);

-- Excluir libera a vaga; reativar respeita o limite.
update public.professionals set deleted_at = now(), is_active = false where name = 'T64 T1';

select lives_ok(
  $$insert into public.professionals (tenant_id, name, phone, commission_percentage)
    select id, 'T64 T3', '11988800003', 10 from public.tenants where name = '__t64_tesoura__'$$,
  'profissional excluido nao conta: a vaga fica livre para outro'
);

select throws_ok(
  $$update public.professionals set deleted_at = null where name = 'T64 T1'$$,
  '53400',
  'PROFESSIONAL_LIMIT_REACHED',
  'reativar um profissional excluido numa barbearia no limite e recusado'
);

update public.professionals set deleted_at = now() where name = 'T64 T3';

select lives_ok(
  $$update public.professionals set deleted_at = null where name = 'T64 T1'$$,
  'com a vaga livre, reativar o profissional excluido e aceito'
);

-- Inativo (is_active = false) mas nao excluido continua ocupando a vaga.
select lives_ok(
  $$update public.professionals set is_active = false where name = 'T64 T1'$$,
  'alterar outros campos de um profissional numa barbearia cheia nao e barrado'
);

select throws_ok(
  $$insert into public.professionals (tenant_id, name, phone, commission_percentage)
    select id, 'T64 T4', '11988800004', 10 from public.tenants where name = '__t64_tesoura__'$$,
  '53400',
  'PROFESSIONAL_LIMIT_REACHED',
  'profissional inativo mas nao excluido ainda ocupa a vaga do plano'
);

-- Maquina: cinco cabem, o sexto nao, e o lote de seis e recusado por inteiro.
select lives_ok(
  $$insert into public.professionals (tenant_id, name, phone, commission_percentage)
    select t.id, 'T64 M' || g, '1198881' || lpad(g::text, 4, '0'), 10
    from public.tenants t, generate_series(1, 5) g
    where t.name = '__t64_maquina__'$$,
  'Maquina aceita cinco profissionais de uma vez'
);

select throws_ok(
  $$insert into public.professionals (tenant_id, name, phone, commission_percentage)
    select id, 'T64 M6', '11988810006', 10 from public.tenants where name = '__t64_maquina__'$$,
  '53400',
  'PROFESSIONAL_LIMIT_REACHED',
  'Maquina recusa o sexto profissional'
);

select throws_ok(
  $$insert into public.professionals (tenant_id, name, phone, commission_percentage)
    select t.id, 'T64 B' || g, '1198882' || lpad(g::text, 4, '0'), 10
    from public.tenants t, generate_series(1, 6) g
    where t.name = '__t64_maquina_2__'$$,
  '53400',
  'PROFESSIONAL_LIMIT_REACHED',
  'um lote de seis profissionais numa Maquina e recusado'
);

select is(
  (select count(*)::integer from public.professionals p join public.tenants t on t.id = p.tenant_id where t.name = '__t64_maquina_2__'),
  0,
  'o lote recusado nao grava nenhum profissional'
);

select lives_ok(
  $$insert into public.professionals (tenant_id, name, phone, commission_percentage)
    select id, 'T64 B1', '11988820001', 10 from public.tenants where name = '__t64_maquina_2__'$$,
  'uma barbearia nao e afetada pelo limite de outra: as outras estao cheias e esta aceita'
);

-- Gerente: so conta quando esta vinculado como profissional.
select lives_ok(
  $$insert into public.professionals (tenant_id, name, phone, commission_percentage)
    select id, 'T64 G1', '11988830001', 10 from public.tenants where name = '__t64_gerente__'$$,
  'o Gerente sem cadastro de profissional nao ocupa vaga: o primeiro barbeiro cabe na Tesoura'
);

select lives_ok(
  $$insert into public.professionals (tenant_id, name, phone, commission_percentage, user_id)
    select t.id, 'T64 GV', '11988840001', 10, u.id
    from public.tenants t, public.users u
    where t.name = '__t64_gerente_vinc__' and u.email = '__t64_gervinc__@teste.com'$$,
  'o Gerente que se inclui como barbeiro ocupa a vaga da Tesoura'
);

select throws_ok(
  $$insert into public.professionals (tenant_id, name, phone, commission_percentage)
    select id, 'T64 GV2', '11988840002', 10 from public.tenants where name = '__t64_gerente_vinc__'$$,
  '53400',
  'PROFESSIONAL_LIMIT_REACHED',
  'com o Gerente vinculado como profissional, a Tesoura nao aceita outro'
);

-- Mover um profissional ativo para uma barbearia cheia tambem e barrado.
select throws_ok(
  $$update public.professionals
    set tenant_id = (select id from public.tenants where name = '__t64_tesoura__')
    where name = 'T64 M1'$$,
  '53400',
  'PROFESSIONAL_LIMIT_REACHED',
  'mover um profissional ativo para uma barbearia no limite e recusado'
);

-- Sem assinatura, sem limite.
select lives_ok(
  $$insert into public.professionals (tenant_id, name, phone, commission_percentage)
    select t.id, 'T64 S' || g, '1198885' || lpad(g::text, 4, '0'), 10
    from public.tenants t, generate_series(1, 3) g
    where t.name = '__t64_sem_assinatura__'$$,
  'barbearia sem assinatura nao tem limite'
);

-- O Gerente autenticado, com a RLS valendo, tambem e barrado pelo limite.
select set_config(
  'request.jwt.claim.sub',
  (select id::text from auth.users where email = '__t64_gervinc__@teste.com'),
  true
);
set local role authenticated;

select throws_ok(
  $$insert into public.professionals (tenant_id, name, phone, commission_percentage)
    select id, 'T64 RLS', '11988850001', 10 from public.tenants where name = '__t64_gerente_vinc__'$$,
  '53400',
  'PROFESSIONAL_LIMIT_REACHED',
  'o Gerente autenticado, com a RLS valendo, e barrado pelo limite (nao por permissao)'
);

reset role;

select ok(
  not has_function_privilege('anon', 'private.enforce_professional_plan_limit()', 'execute')
  and not has_function_privilege('authenticated', 'private.enforce_professional_plan_limit()', 'execute'),
  'a funcao do gatilho nao e executavel por anon nem por authenticated'
);

select * from finish();
rollback;
