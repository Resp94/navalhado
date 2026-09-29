begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- Spec 052, ticket 01: catalogo Tesoura, Maquina e Bancada.
--
-- Os planos mantem os UUIDs de Bronze, Prata e Ouro. A coluna features sai,
-- porque todos os planos tem todos os recursos. O cadastro de barbearia
-- (trigger handle_new_user) passa a ligar o plano pelo id, e nao mais pelo nome.
-- Enquanto o front anterior estiver no ar, o campo antigo tenant_signup.plan
-- (bronze, prata, ouro) continua aceito.

-- Contrato de precos e limites do ticket 01. Quando o catalogo mudar de
-- proposito (reajuste, plano novo), este e o unico assert que precisa mudar.
select results_eq(
  $$select id::text, name, price, max_professionals
    from public.plans
    order by price$$,
  $$values
    ('b3fa7384-d113-4a1b-a5ed-1efeb7e51c11'::text, 'Tesoura'::text, 59.90::numeric, 1),
    ('b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'Máquina', 89.90, 5),
    ('b3fa7384-d113-4a1b-a5ed-1efeb7e51c33', 'Bancada', 159.90, 10)$$,
  'catalogo tem Tesoura, Maquina e Bancada nos UUIDs dos planos antigos'
);

select hasnt_column('public', 'plans', 'features', 'plans nao tem mais a coluna features');

set local role anon;
select ok(
  (select count(*) from public.plans) > 0,
  'a tela de cadastro le o catalogo sem login'
);
reset role;

insert into auth.users (id, email, raw_user_meta_data)
values (
  gen_random_uuid(),
  '__t63_ok__auth@teste.com',
  jsonb_build_object(
    'name', 'Gestor T63',
    'tenant_signup', jsonb_build_object(
      'name', 'Barbearia T63 Maquina',
      'email', 'contato@barbeariat63.com',
      'phone', '11988887777',
      'plan_id', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22'
    )
  )
);

select is(
  (select s.plan_id::text
   from public.tenant_subscriptions s
   join public.tenants t on t.id = s.tenant_id
   where t.name = 'Barbearia T63 Maquina'),
  'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22',
  'o cadastro liga a assinatura ao plano escolhido pelo id'
);

select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data)
    values (
      gen_random_uuid(),
      '__t63_sem_plano__auth@teste.com',
      jsonb_build_object(
        'name', 'Gestor T63',
        'tenant_signup', jsonb_build_object(
          'name', 'Barbearia T63 Invalida',
          'email', 'contato@barbeariat63.com',
          'phone', '11988887777'
        )
      )
    )$$,
  '22023',
  'INVALID_PLAN',
  'cadastro sem plano e recusado'
);

select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data)
    values (
      gen_random_uuid(),
      '__t63_nome_antigo__auth@teste.com',
      jsonb_build_object(
        'name', 'Gestor T63',
        'tenant_signup', jsonb_build_object(
          'name', 'Barbearia T63 Invalida',
          'email', 'contato@barbeariat63.com',
          'phone', '11988887777',
          'plan_id', 'prata'
        )
      )
    )$$,
  '22023',
  'INVALID_PLAN',
  'cadastro pelo nome do plano antigo e recusado'
);

select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data)
    values (
      gen_random_uuid(),
      '__t63_uuid_inexistente__auth@teste.com',
      jsonb_build_object(
        'name', 'Gestor T63',
        'tenant_signup', jsonb_build_object(
          'name', 'Barbearia T63 Invalida',
          'email', 'contato@barbeariat63.com',
          'phone', '11988887777',
          'plan_id', '00000000-0000-0000-0000-000000000000'
        )
      )
    )$$,
  '22023',
  'INVALID_PLAN',
  'cadastro com id de plano que nao existe e recusado'
);

select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data)
    values (
      gen_random_uuid(),
      '__t63_lixo__auth@teste.com',
      jsonb_build_object(
        'name', 'Gestor T63',
        'tenant_signup', jsonb_build_object(
          'name', 'Barbearia T63 Invalida',
          'email', 'contato@barbeariat63.com',
          'phone', '11988887777',
          'plan_id', 'isto-nao-e-um-uuid'
        )
      )
    )$$,
  '22023',
  'INVALID_PLAN',
  'cadastro com id de plano mal formado e recusado sem erro de conversao'
);

insert into auth.users (id, email, raw_user_meta_data)
values (
  gen_random_uuid(),
  '__t63_legado__auth@teste.com',
  jsonb_build_object(
    'name', 'Gestor T63',
    'tenant_signup', jsonb_build_object(
      'name', 'Barbearia T63 Legado',
      'email', 'contato@legadot63.com',
      'phone', '11988887777',
      'plan', 'prata'
    )
  )
);

select is(
  (select s.plan_id::text
   from public.tenant_subscriptions s
   join public.tenants t on t.id = s.tenant_id
   where t.name = 'Barbearia T63 Legado'),
  'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22',
  'o campo antigo tenant_signup.plan (prata) continua ligando ao plano Maquina'
);

select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data)
    values (
      gen_random_uuid(),
      '__t63_legado_invalido__auth@teste.com',
      jsonb_build_object(
        'name', 'Gestor T63',
        'tenant_signup', jsonb_build_object(
          'name', 'Barbearia T63 Invalida',
          'email', 'contato@barbeariat63.com',
          'phone', '11988887777',
          'plan', 'platina'
        )
      )
    )$$,
  '22023',
  'INVALID_PLAN',
  'o campo antigo com um nome que nunca existiu e recusado'
);

select is(
  (select count(*)::integer from public.tenants where name = 'Barbearia T63 Invalida'),
  0,
  'nenhum tenant e criado quando o plano e recusado'
);

select is(
  (select count(*)::integer
   from public.tenant_subscriptions s
   join public.tenants t on t.id = s.tenant_id
   where t.name = 'Barbearia T63 Maquina'),
  1,
  'o cadastro cria uma unica assinatura para o tenant'
);

select * from finish();
rollback;
