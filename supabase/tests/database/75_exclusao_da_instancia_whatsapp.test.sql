begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- Spec 052, ticket 13: a barbearia bloqueada ha 7 dias ou mais tem a Instancia WhatsApp excluida. A instancia guarda o
-- ambiente em que nasceu (coluna environment, preenchida pelo banco a partir do Vault app_environment); a rotina diaria
-- so escolhe instancia deste ambiente, e a funcao do WhatsApp consulta o mesmo veredito antes de excluir. Instancia sem
-- ambiente, ou de outro, nunca e excluida. So o service_role consulta o veredito.

insert into public.tenants(id, name, email, phone, slug, onboarding_completed)
values
  ('75000000-0000-0000-0000-000000000001', 'T75 A', 't75-a@test.local', '92999997501', 't75-a', true),
  ('75000000-0000-0000-0000-000000000002', 'T75 B', 't75-b@test.local', '92999997502', 't75-b', true),
  ('75000000-0000-0000-0000-000000000003', 'T75 C', 't75-c@test.local', '92999997503', 't75-c', true),
  ('75000000-0000-0000-0000-000000000004', 'T75 D', 't75-d@test.local', '92999997504', 't75-d', true),
  ('75000000-0000-0000-0000-000000000005', 'T75 E', 't75-e@test.local', '92999997505', 't75-e', true),
  ('75000000-0000-0000-0000-000000000006', 'T75 F', 't75-f@test.local', '92999997506', 't75-f', true),
  ('75000000-0000-0000-0000-000000000007', 'T75 J', 't75-j@test.local', '92999997507', 't75-j', true),
  ('75000000-0000-0000-0000-000000000008', 'T75 K', 't75-k@test.local', '92999997508', 't75-k', true),
  ('75000000-0000-0000-0000-000000000009', 'T75 Z', 't75-z@test.local', '92999997509', 't75-z', true),
  ('75000000-0000-0000-0000-000000000010', 'T75 Y', 't75-y@test.local', '92999997510', 't75-y', true);

-- A: bloqueada ha exatamente 7 dias (teste vencido), instancia sem ambiente informado (o banco marca). B: a 1 segundo dos 7
-- dias. C: bloqueada ha 30 dias, mas a instancia e de outro ambiente. D: bloqueada ha 30 dias, instancia sem identificacao
-- de ambiente. E: ativa (a data do bloqueio antigo ficou na linha). F: cancelada com o periodo pago pela frente. J: bloqueada
-- pelo Proprietario (sem motivo) ha 8 dias. K: bloqueada por pagamento recusado ha 9 dias. Z: instancia de barbearia sem
-- assinatura. Y: sem instancia por enquanto. O gatilho de cadastro pode ter criado assinaturas; as de teste mandam.
delete from public.tenant_subscriptions where tenant_id::text like '75000000-0000-0000-0000-0000000000%';

insert into public.tenant_subscriptions(tenant_id, plan_id, status, trial_ends_at, current_period_start, current_period_end, first_failed_at, blocked_at, blocked_reason, canceled_at)
values
  ('75000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', null, null, null, null, now() - interval '7 days', 'trial_expired', null),
  ('75000000-0000-0000-0000-000000000002', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', null, null, null, null, now() - interval '7 days' + interval '1 second', 'trial_expired', null),
  ('75000000-0000-0000-0000-000000000003', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', null, null, null, null, now() - interval '30 days', 'trial_expired', null),
  ('75000000-0000-0000-0000-000000000004', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', null, null, null, null, now() - interval '30 days', 'trial_expired', null),
  ('75000000-0000-0000-0000-000000000005', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', null, now() - interval '5 days', now() + interval '25 days', null, now() - interval '30 days', null, null),
  ('75000000-0000-0000-0000-000000000006', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'canceled', null, now() - interval '5 days', now() + interval '25 days', null, null, null, now() - interval '1 day'),
  ('75000000-0000-0000-0000-000000000007', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', null, null, null, null, now() - interval '8 days', null, null),
  ('75000000-0000-0000-0000-000000000008', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', null, now() - interval '40 days', now() - interval '10 days', now() - interval '14 days', now() - interval '9 days', 'payment_failed', null);

create function pg_temp.outro_ambiente() returns text language sql as
  $$select case when private.runtime_environment() = 'prod' then 'dev' else 'prod' end$$;

create function pg_temp.veredito(p_tenant uuid) returns text language sql as
  $$select private.whatsapp_instance_deletion_verdict(i.id, now()) from public.whatsapp_instances i where i.tenant_id = p_tenant$$;

insert into public.whatsapp_instances(tenant_id, instance_name, instance_token)
values
  ('75000000-0000-0000-0000-000000000001', 'nav_t75_a', 'token-t75-a'),
  ('75000000-0000-0000-0000-000000000002', 'nav_t75_b', 'token-t75-b'),
  ('75000000-0000-0000-0000-000000000004', 'nav_t75_d', 'token-t75-d'),
  ('75000000-0000-0000-0000-000000000005', 'nav_t75_e', 'token-t75-e'),
  ('75000000-0000-0000-0000-000000000006', 'nav_t75_f', 'token-t75-f'),
  ('75000000-0000-0000-0000-000000000007', 'nav_t75_j', 'token-t75-j'),
  ('75000000-0000-0000-0000-000000000008', 'nav_t75_k', 'token-t75-k'),
  ('75000000-0000-0000-0000-000000000009', 'nav_t75_z', 'token-t75-z');

insert into public.whatsapp_instances(tenant_id, instance_name, instance_token, environment)
values ('75000000-0000-0000-0000-000000000003', 'nav_t75_c', 'token-t75-c', pg_temp.outro_ambiente());

-- D foi criada antes da marca e nunca foi identificada.
update public.whatsapp_instances set environment = null where tenant_id = '75000000-0000-0000-0000-000000000004';

create temp table t75_instancias as
  select i.id, i.tenant_id from public.whatsapp_instances i where i.tenant_id::text like '75000000-0000-0000-0000-0000000000%';

-- A marca do ambiente -------------------------------------------------------------------------------------------------
select ok(
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'whatsapp_instances' and column_name = 'environment'),
  'a instancia guarda o ambiente em que foi criada'
);

select is(
  (select i.environment from public.whatsapp_instances i where i.tenant_id = '75000000-0000-0000-0000-000000000001'),
  private.runtime_environment(),
  'a instancia criada sem ambiente recebe o do banco, lido do Vault (app_environment)'
);

select is(
  (select i.environment from public.whatsapp_instances i where i.tenant_id = '75000000-0000-0000-0000-000000000003'),
  pg_temp.outro_ambiente(),
  'o ambiente informado na criacao e mantido: a instancia de outro ambiente continua marcada assim'
);

select ok(
  private.runtime_environment() in ('dev', 'prod'),
  'o ambiente do banco vem do Vault e e dev ou prod'
);

-- O veredito, caso a caso -----------------------------------------------------------------------------------------------
select is(pg_temp.veredito('75000000-0000-0000-0000-000000000001'), 'due', 'bloqueada ha 7 dias exatos: a instancia e devida');
select is(pg_temp.veredito('75000000-0000-0000-0000-000000000002'), 'too_recent', 'a 1 segundo dos 7 dias: ainda nao');
select is(pg_temp.veredito('75000000-0000-0000-0000-000000000003'), 'other_environment', 'instancia de outro ambiente nunca e excluida, por mais antigo que seja o bloqueio');
select is(pg_temp.veredito('75000000-0000-0000-0000-000000000004'), 'unidentified', 'instancia sem identificacao de ambiente nunca e excluida');
select is(pg_temp.veredito('75000000-0000-0000-0000-000000000005'), 'not_blocked', 'a barbearia ativa nao perde a instancia, mesmo com data de bloqueio antiga na linha');
select is(pg_temp.veredito('75000000-0000-0000-0000-000000000006'), 'not_blocked', 'a cancelada com acesso ate o fim do periodo pago nao perde a instancia');
select is(pg_temp.veredito('75000000-0000-0000-0000-000000000009'), 'not_blocked', 'a barbearia sem assinatura nao perde a instancia');
select is(private.whatsapp_instance_deletion_verdict('75000000-0000-0000-0000-0000000000ff', now()), 'not_found', 'instancia que nao existe');

select is(
  (select array_agg(i.tenant_id::text order by i.tenant_id::text)
   from public.whatsapp_instances i
   where i.id in (select private.whatsapp_instances_due_for_deletion(now()))
     and i.tenant_id::text like '75000000-0000-0000-0000-0000000000%'),
  array['75000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000007', '75000000-0000-0000-0000-000000000008'],
  'a rotina escolhe so as devidas: qualquer motivo de bloqueio conta (teste vencido, Proprietario, pagamento recusado)'
);

select is(
  (select c.confdeltype::text from pg_constraint c where c.conname = 'whatsapp_message_idempotency_instance_tenant_fkey'),
  'n',
  'apagar a instancia mantem o historico de envios: a referencia vira nula'
);

-- A rotina diaria -------------------------------------------------------------------------------------------------------
create temp table t75_rodada as select private.delete_blocked_whatsapp_instances() as total;

select is(
  (select array_agg(t.tenant_id::text order by t.tenant_id::text)
   from net.http_request_queue q
   join t75_instancias t on convert_from(q.body, 'utf8')::jsonb ->> 'instance_id' = t.id::text
   where q.url like '%/functions/v1/whatsapp-integration/delete-instance'),
  array['75000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000007', '75000000-0000-0000-0000-000000000008'],
  'a rotina diaria chama a exclusao so para as tres instancias devidas'
);

select ok(
  exists (
    select 1
    from net.http_request_queue q
    join t75_instancias t on convert_from(q.body, 'utf8')::jsonb ->> 'instance_id' = t.id::text
    where t.tenant_id = '75000000-0000-0000-0000-000000000001'
      and q.method = 'POST'
      and q.url = (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1)
        || '/functions/v1/whatsapp-integration/delete-instance'
      and q.headers ->> 'x-db-trigger-secret' = (select decrypted_secret from vault.decrypted_secrets where name = 'whatsapp_db_trigger_secret' limit 1)
  ),
  'a chamada vai para a funcao do proprio projeto, com o segredo interno que as outras rotinas do WhatsApp usam'
);

select ok(
  (select total from t75_rodada) >= 3,
  'a rotina devolve quantas chamadas fez'
);

select is(
  (select count(*)::int from cron.job where jobname = 'delete-blocked-whatsapp-instances' and schedule = '15 3 * * *' and command like '%private.delete_blocked_whatsapp_instances()%'),
  1,
  'a rotina roda todo dia as 03:15 UTC, depois da que grava o bloqueio (03:05)'
);

-- Acesso ------------------------------------------------------------------------------------------------------------------
select ok(
  has_function_privilege('service_role', 'public.whatsapp_instance_deletion_verdict(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.whatsapp_instance_deletion_verdict(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.whatsapp_instance_deletion_verdict(uuid)', 'execute'),
  'so o service_role consulta o veredito da exclusao'
);

select ok(
  not has_function_privilege('anon', 'private.delete_blocked_whatsapp_instances(timestamptz)', 'execute')
    and not has_function_privilege('authenticated', 'private.delete_blocked_whatsapp_instances(timestamptz)', 'execute')
    and not has_function_privilege('anon', 'private.whatsapp_instances_due_for_deletion(timestamptz)', 'execute')
    and not has_function_privilege('authenticated', 'private.whatsapp_instances_due_for_deletion(timestamptz)', 'execute')
    and not has_function_privilege('anon', 'private.whatsapp_instance_deletion_verdict(uuid, timestamptz)', 'execute')
    and not has_function_privilege('authenticated', 'private.whatsapp_instance_deletion_verdict(uuid, timestamptz)', 'execute')
    and not has_function_privilege('anon', 'private.runtime_environment()', 'execute')
    and not has_function_privilege('authenticated', 'private.runtime_environment()', 'execute'),
  'as funcoes privadas da exclusao nao sao executaveis por anon nem authenticated'
);

-- Gerente logado, com barbearia: a guarda e o grant.
insert into auth.users(id, email)
values ('75000000-0000-0000-0000-0000000000a1', 't75-gerente@test.local');
update public.users
set tenant_id = '75000000-0000-0000-0000-000000000001', role = 'gerente', is_active = true
where id = '75000000-0000-0000-0000-0000000000a1';

select set_config('request.jwt.claim.sub', '75000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select throws_ok(
  $$select public.whatsapp_instance_deletion_verdict('75000000-0000-0000-0000-0000000000ff')$$,
  '42501', null,
  'o Gerente logado nao consulta o veredito pelo front: quem consulta e a funcao do WhatsApp'
);
reset role;

-- Gerente sem barbearia (public.users.tenant_id nulo): a guarda e o grant, nao uma comparacao de tenant que o NULL
-- contornaria (ver o teste 32).
insert into auth.users(id, email)
values ('75000000-0000-0000-0000-0000000000a2', 't75-gerente-sem-tenant@test.local');
update public.users
set tenant_id = null, role = 'gerente', is_active = true
where id = '75000000-0000-0000-0000-0000000000a2';

select set_config('request.jwt.claim.sub', '75000000-0000-0000-0000-0000000000a2', true);
set local role authenticated;
select throws_ok(
  $$select public.whatsapp_instance_deletion_verdict('75000000-0000-0000-0000-0000000000ff')$$,
  '42501', null,
  'o Gerente sem barbearia (tenant_id nulo) tambem nao consulta'
);
reset role;

-- Sem o segredo interno, a rotina falha em vez de seguir calada (o job aparece com erro no historico do pg_cron).
select vault.update_secret((select s.id from vault.secrets s where s.name = 'whatsapp_db_trigger_secret'), null, 'whatsapp_db_trigger_secret_ausente');
select throws_ok(
  $$select private.delete_blocked_whatsapp_instances()$$,
  'P0001', null,
  'sem o segredo interno do WhatsApp a rotina falha'
);

-- Sem o ambiente no Vault o banco nao sabe o que e "deste ambiente": nada e excluido e a instancia nova nasce sem marca.
select vault.update_secret((select s.id from vault.secrets s where s.name = 'app_environment'), null, 'app_environment_ausente');

select is(
  pg_temp.veredito('75000000-0000-0000-0000-000000000001'),
  'runtime_unidentified',
  'sem o ambiente do banco no Vault, nem a instancia devida e excluida'
);

select is(
  (select count(*)::int from private.whatsapp_instances_due_for_deletion(now()) d where d in (select id from t75_instancias)),
  0,
  'e a rotina nao escolhe nenhuma'
);

insert into public.whatsapp_instances(tenant_id, instance_name, instance_token)
values ('75000000-0000-0000-0000-000000000010', 'nav_t75_y', 'token-t75-y');

select is(
  pg_temp.veredito('75000000-0000-0000-0000-000000000010'),
  'unidentified',
  'a instancia criada sem o ambiente do banco nasce sem marca, e sem marca nunca e excluida'
);

select * from finish();
rollback;
