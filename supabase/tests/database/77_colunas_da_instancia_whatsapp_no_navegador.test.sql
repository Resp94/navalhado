begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

-- Spec 053, tickets 02 e 04: o navegador le e grava whatsapp_instances so pelas colunas liberadas uma a uma.
-- instance_token e a credencial da instancia na Uazapi e nunca chega ao navegador (ADR 010, decisao 4). As migrations
-- 036 e 051 tinham concedido a tabela inteira a authenticated, o que desfazia o fechamento por coluna da 009. Este
-- teste e o guarda: falha se um GRANT de tabela voltar, se uma coluna for aberta a mais ou se alguma faltar abrir.
--
-- Este arquivo descreve o estado FINAL, depois do ticket 04: o navegador grava so configuracao. Num banco que tem apenas
-- o ticket 02 (passo 1), as assercoes do conjunto de UPDATE e as que gravam status e qr_code falham por desenho. Nao
-- "conserte" aplicando o ticket 04 antes de a tela e a Edge Function novas estarem no ar.
--
-- Convencao: coluna nova de whatsapp_instances nasce fechada. Para a tela le-la, a migration que a cria concede
-- "grant select (coluna)" e, para grava-la, "grant update (coluna)", e a lista t77_contrato abaixo muda no mesmo
-- commit. Um erro 42501 se corrige concedendo a COLUNA certa, nunca a tabela. Excecao: status e qr_code sao do servidor
-- (a Edge Function whatsapp-integration os grava, com service_role: o connect, o disconnect e a sincronizacao com o
-- provedor). Se a tela precisar gravar um deles, mova a escrita para a Edge Function em vez de conceder a coluna.
--
-- Todas as comparacoes sao de privilegio, de codigo de erro e de contagem de linhas; nenhuma le ou mostra o valor do
-- token. Tenants, usuarios e instancias de teste nascem nesta transacao e somem no rollback; nenhuma e conectada.

-- Fonte unica do teste: o contrato de colunas do navegador.
create temporary table t77_contrato (
  coluna text primary key,
  le boolean not null,
  grava boolean not null
) on commit drop;

insert into t77_contrato (coluna, le, grava) values
  ('id', true, false),
  ('tenant_id', true, false),
  ('instance_name', true, false),
  ('qr_code', true, false),
  ('status', true, false),
  ('send_confirmation', true, true),
  ('send_reminders', true, true),
  ('send_cancellation', true, true),
  ('send_welcome_balcao', true, true),
  ('reminder_hours', true, true),
  ('template_confirmation', true, true),
  ('template_reschedule', true, true),
  ('template_cancellation', true, true),
  ('template_reminder', true, true),
  ('template_welcome_balcao', true, true),
  ('template_first_contact', true, true),
  ('template_professional_created', true, true),
  ('template_professional_rescheduled', true, true),
  ('template_professional_cancelled', true, true),
  ('auto_reply_keywords', true, true),
  ('updated_at', false, true);

create temporary table t77_ctx (
  tenant_id uuid not null,
  outro_tenant_id uuid not null,
  gerente_id uuid not null,
  gerente_nulo_id uuid not null,
  barbeiro_id uuid not null,
  proprietario_id uuid not null,
  total_instancias bigint
) on commit drop;

with t1 as (
  insert into public.tenants (name, email, phone)
  values ('__t77_barbearia__', '__t77_barbearia__@teste.com', '11999990076')
  returning id
), t2 as (
  insert into public.tenants (name, email, phone)
  values ('__t77_outra__', '__t77_outra__@teste.com', '11999990077')
  returning id
), au_g as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t77_gerente__@teste.com') returning id
), au_gn as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t77_gerente_nulo__@teste.com') returning id
), au_b as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t77_barbeiro__@teste.com') returning id
), au_p as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t77_proprietario__@teste.com') returning id
)
insert into t77_ctx (tenant_id, outro_tenant_id, gerente_id, gerente_nulo_id, barbeiro_id, proprietario_id)
select t1.id, t2.id, au_g.id, au_gn.id, au_b.id, au_p.id
from t1, t2, au_g, au_gn, au_b, au_p;

update public.users set tenant_id = (select tenant_id from t77_ctx), role = 'gerente', is_active = true
where id = (select gerente_id from t77_ctx);
-- Gerente mal cadastrado, sem unidade vinculada (a precondicao do achado de 2026-09-13, pgTAP 32).
update public.users set tenant_id = null, role = 'gerente', is_active = true
where id = (select gerente_nulo_id from t77_ctx);
update public.users set tenant_id = (select tenant_id from t77_ctx), role = 'barbeiro', is_active = true
where id = (select barbeiro_id from t77_ctx);
update public.users set tenant_id = (select outro_tenant_id from t77_ctx), role = 'proprietario', is_active = true
where id = (select proprietario_id from t77_ctx);

insert into public.whatsapp_instances (tenant_id, instance_name, instance_token)
select tenant_id, 'nav_t77_barbearia', 'token-t77-barbearia' from t77_ctx
union all
select outro_tenant_id, 'nav_t77_outra', 'token-t77-outra' from t77_ctx;

-- O proprietario le todas as linhas da tabela, as de teste e as que o ambiente ja tinha.
update t77_ctx set total_instancias = (select count(*) from public.whatsapp_instances);

-- Executa um comando com o papel de quem chama e devolve "ok:<linhas>" ou o SQLSTATE do erro. Assim uma negativa nao
-- aborta a transacao e a assercao mostra o codigo recebido, sem depender do texto da mensagem.
create function pg_temp.tenta(p_sql text) returns text language plpgsql as $$
declare
  v_linhas bigint;
begin
  execute p_sql;
  get diagnostics v_linhas = row_count;
  return 'ok:' || v_linhas;
exception when others then
  return sqlstate;
end;
$$;

-- Os comandos que listam colunas saem do contrato, para a lista existir num lugar so.
create temporary table t77_sql (chave text primary key, sql text not null) on commit drop;

insert into t77_sql (chave, sql)
select 'le20', format('select %s from public.whatsapp_instances', string_agg(quote_ident(coluna), ', ' order by coluna))
from t77_contrato where le;

insert into t77_sql (chave, sql)
select 'ret20', format(
  'update public.whatsapp_instances set send_reminders = send_reminders where tenant_id = (select tenant_id from t77_ctx) returning %s',
  string_agg(quote_ident(coluna), ', ' order by coluna))
from t77_contrato where le;

insert into t77_sql (chave, sql)
select 'config', format(
  'update public.whatsapp_instances set %s, updated_at = now() where tenant_id = (select tenant_id from t77_ctx)',
  string_agg(format('%1$I = %1$I', coluna), ', ' order by coluna))
from t77_contrato where grava and coluna <> 'updated_at';

grant select on t77_ctx, t77_sql to authenticated;

select is(
  (select tenant_id from public.users where id = (select gerente_nulo_id from t77_ctx)),
  null::uuid,
  'pre-condicao: o Gerente do caso nulo fica com tenant_id nulo'
);

select is(
  (select count(*) from public.whatsapp_instances
   where tenant_id in (select tenant_id from t77_ctx union all select outro_tenant_id from t77_ctx)),
  2::bigint,
  'pre-condicao: as duas instancias de teste existem, uma por barbearia'
);

-- Privilegios no catalogo (como postgres) ----------------------------------------------------------------------------
select is(
  (select array_agg(p order by p)
   from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p
   where has_table_privilege('authenticated', 'public.whatsapp_instances', p)),
  null::text[],
  'authenticated nao tem nenhum privilegio de tabela em whatsapp_instances: so privilegio de coluna'
);

select is(
  (select array_agg(p order by p)
   from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p
   where has_table_privilege('anon', 'public.whatsapp_instances', p)),
  null::text[],
  'anon nao tem nenhum privilegio de tabela em whatsapp_instances'
);

select is(
  (select array_agg(a.attname::text order by a.attname)
   from pg_attribute a
   where a.attrelid = 'public.whatsapp_instances'::regclass and a.attnum > 0 and not a.attisdropped
     and (has_column_privilege('anon', a.attrelid, a.attnum, 'SELECT')
       or has_column_privilege('anon', a.attrelid, a.attnum, 'INSERT')
       or has_column_privilege('anon', a.attrelid, a.attnum, 'UPDATE')
       or has_column_privilege('anon', a.attrelid, a.attnum, 'REFERENCES'))),
  null::text[],
  'anon nao tem privilegio em nenhuma coluna de whatsapp_instances'
);

select is(
  (select array_agg(a.attname::text order by a.attname)
   from pg_attribute a
   where a.attrelid = 'public.whatsapp_instances'::regclass and a.attnum > 0 and not a.attisdropped
     and (has_column_privilege('authenticated', a.attrelid, a.attnum, 'INSERT')
       or has_column_privilege('authenticated', a.attrelid, a.attnum, 'REFERENCES'))),
  null::text[],
  'authenticated nao insere nem referencia nenhuma coluna: o navegador nunca cria linha de whatsapp_instances'
);

select set_eq(
  $$select a.attname::text from pg_attribute a
    where a.attrelid = 'public.whatsapp_instances'::regclass and a.attnum > 0 and not a.attisdropped
      and has_column_privilege('authenticated', a.attrelid, a.attnum, 'SELECT')$$,
  $$select coluna from t77_contrato where le$$,
  'authenticated le exatamente as 20 colunas do contrato; a diferenca mostra a coluna aberta a mais ou a que faltou abrir'
);

select set_eq(
  $$select a.attname::text from pg_attribute a
    where a.attrelid = 'public.whatsapp_instances'::regclass and a.attnum > 0 and not a.attisdropped
      and has_column_privilege('authenticated', a.attrelid, a.attnum, 'UPDATE')$$,
  $$select coluna from t77_contrato where grava$$,
  'authenticated grava exatamente as colunas de configuracao do contrato (grava = true); a diferenca mostra o excesso ou a falta'
);

-- Nominal, com a instrucao de correcao na mensagem. A de environment passa vazia onde a coluna ainda nao existe.
select is(
  (select array_agg(c.coluna order by c.coluna)
   from unnest(array['environment', 'instance_token', 'provider', 'provider_instance_id']) as c(coluna)
   join pg_attribute a on a.attrelid = 'public.whatsapp_instances'::regclass and a.attname = c.coluna
     and a.attnum > 0 and not a.attisdropped
   where has_column_privilege('authenticated', a.attrelid, a.attnum, 'SELECT')
      or has_column_privilege('authenticated', a.attrelid, a.attnum, 'UPDATE')),
  null::text[],
  'instance_token, provider_instance_id, provider e environment nao tem SELECT nem UPDATE para o navegador; se alguma aparecer, revogue e conceda so as colunas do contrato (spec 053), nunca a tabela'
);

-- Quem grava status e qr_code e a Edge Function, com service_role (privilegio proprio, que o fechamento do navegador
-- nao toca). Sem isso a tela nao conectaria mais. Se falhar, o array mostra a coluna que faltou.
select is(
  (select array_agg(c order by c)
   from unnest(array['qr_code', 'status']) as c
   where not has_column_privilege('service_role', 'public.whatsapp_instances', c, 'UPDATE')),
  null::text[],
  'service_role grava status e qr_code: a Edge Function whatsapp-integration e quem os grava'
);

select ok(
  has_column_privilege('authenticated', 'public.whatsapp_instances', 'id', 'SELECT'),
  'id (chave primaria) tem SELECT: sem ele o Realtime entrega "Error 401: Unauthorized"'
);

select ok(
  has_column_privilege('authenticated', 'public.whatsapp_instances', 'tenant_id', 'SELECT'),
  'tenant_id tem SELECT: o filtro da assinatura do Realtime e o WHERE das gravacoes dependem dele'
);

-- Gerente do tenant -----------------------------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', (select gerente_id::text from t77_ctx), true);
set local role authenticated;

select is(
  pg_temp.tenta((select sql from t77_sql where chave = 'le20')),
  'ok:1',
  'Gerente le as 20 colunas e so a linha da propria barbearia'
);

select throws_ok(
  $$select instance_token from public.whatsapp_instances$$,
  '42501', null,
  'Gerente nao le instance_token'
);

select throws_ok(
  $$select * from public.whatsapp_instances$$,
  '42501', null,
  'Gerente que faz select * recebe 42501: o codigo precisa listar as colunas'
);

select is(
  pg_temp.tenta((select sql from t77_sql where chave = 'ret20')),
  'ok:1',
  'Gerente faz update ... returning das 20 colunas'
);

select is(
  pg_temp.tenta((select sql from t77_sql where chave = 'config')),
  'ok:1',
  'Gerente grava modelos, flags, reminder_hours, auto_reply_keywords e updated_at'
);

select throws_ok(
  $$update public.whatsapp_instances set instance_token = null where tenant_id = (select tenant_id from t77_ctx)$$,
  '42501', null,
  'Gerente nao regrava instance_token'
);

select throws_ok(
  $$update public.whatsapp_instances set instance_name = null where tenant_id = (select tenant_id from t77_ctx)$$,
  '42501', null,
  'Gerente nao regrava instance_name'
);

select throws_ok(
  $$update public.whatsapp_instances set provider_instance_id = null where tenant_id = (select tenant_id from t77_ctx)$$,
  '42501', null,
  'Gerente nao regrava provider_instance_id'
);

select is(
  pg_temp.tenta($$update public.whatsapp_instances set environment = null where tenant_id = (select tenant_id from t77_ctx)$$),
  case when exists (
    select 1 from pg_attribute
    where attrelid = 'public.whatsapp_instances'::regclass and attname = 'environment' and not attisdropped
  ) then '42501' else '42703' end,
  'Gerente nao regrava environment, que a rotina de exclusao do 7o dia usa (42703 onde a coluna ainda nao existe)'
);

-- id e tenant_id recebem o proprio valor: com null, a policy (WITH CHECK) e o NOT NULL responderiam antes do
-- privilegio de coluna e o teste passaria sem provar nada.
select throws_ok(
  $$update public.whatsapp_instances set tenant_id = tenant_id where tenant_id = (select tenant_id from t77_ctx)$$,
  '42501', null,
  'Gerente nao regrava tenant_id'
);

select throws_ok(
  $$update public.whatsapp_instances set id = id where tenant_id = (select tenant_id from t77_ctx)$$,
  '42501', null,
  'Gerente nao regrava id'
);

-- Cada coluna na sua assercao: um update das duas juntas passaria se so uma delas estivesse fechada. O valor e
-- constante: "status = status" leria a coluna, e um 42501 por falta de SELECT passaria por UPDATE fechado.
select throws_ok(
  $$update public.whatsapp_instances set status = 'disconnected' where tenant_id = (select tenant_id from t77_ctx)$$,
  '42501', null,
  'Gerente nao regrava status, que e do servidor (a Edge Function grava ao conectar, desconectar e sincronizar); se a tela precisar dele, mova a escrita para a Edge Function, nao conceda a coluna'
);

select throws_ok(
  $$update public.whatsapp_instances set qr_code = null where tenant_id = (select tenant_id from t77_ctx)$$,
  '42501', null,
  'Gerente nao regrava qr_code, que e do servidor (mesma regra do status)'
);

-- Gerente com tenant_id nulo: o bloqueio e de privilegio, nao da policy -----------------------------------------------
reset role;
select set_config('request.jwt.claim.sub', (select gerente_nulo_id::text from t77_ctx), true);
set local role authenticated;

select is(
  pg_temp.tenta((select sql from t77_sql where chave = 'le20')),
  'ok:0',
  'Gerente sem tenant le as 20 colunas e a policy devolve 0 linhas'
);

select throws_ok(
  $$select instance_token from public.whatsapp_instances$$,
  '42501', null,
  'Gerente sem tenant recebe 42501 ao ler instance_token (privilegio de coluna, e nao 0 linhas por causa da policy)'
);

select throws_ok(
  $$update public.whatsapp_instances set instance_token = null where tenant_id = (select tenant_id from t77_ctx)$$,
  '42501', null,
  'Gerente sem tenant recebe 42501 ao regravar instance_token'
);

select throws_ok(
  $$update public.whatsapp_instances set status = 'disconnected' where tenant_id = (select tenant_id from t77_ctx)$$,
  '42501', null,
  'Gerente sem tenant recebe 42501 ao regravar status (privilegio de coluna, e nao 0 linhas por causa da policy)'
);

select is(
  pg_temp.tenta((select sql from t77_sql where chave = 'config')),
  'ok:0',
  'Gerente sem tenant grava modelo de mensagem em 0 linhas: a policy esconde a instancia da barbearia'
);

-- Barbeiro ---------------------------------------------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claim.sub', (select barbeiro_id::text from t77_ctx), true);
set local role authenticated;

select throws_ok(
  $$select instance_token from public.whatsapp_instances$$,
  '42501', null,
  'Barbeiro nao le instance_token'
);

select is(
  pg_temp.tenta((select sql from t77_sql where chave = 'le20')),
  'ok:0',
  'Barbeiro le as 20 colunas e a policy devolve 0 linhas'
);

-- Proprietario ------------------------------------------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claim.sub', (select proprietario_id::text from t77_ctx), true);
set local role authenticated;

select throws_ok(
  $$select instance_token from public.whatsapp_instances$$,
  '42501', null,
  'Proprietario nao le instance_token de nenhuma barbearia'
);

select throws_ok(
  $$update public.whatsapp_instances set instance_token = null where tenant_id = (select tenant_id from t77_ctx)$$,
  '42501', null,
  'Proprietario nao regrava instance_token'
);

select throws_ok(
  $$update public.whatsapp_instances set status = 'disconnected' where tenant_id = (select tenant_id from t77_ctx)$$,
  '42501', null,
  'Proprietario nao regrava status: a policy libera a linha dele, o privilegio de coluna fecha a escrita'
);

select is(
  pg_temp.tenta((select sql from t77_sql where chave = 'le20')),
  'ok:' || (select total_instancias from t77_ctx),
  'Proprietario le as 20 colunas de todas as linhas'
);

select is(
  pg_temp.tenta($$select whatsapp_status from public.view_tenants_management where tenant_id = (select tenant_id from t77_ctx)$$),
  'ok:1',
  'Proprietario segue vendo o status do WhatsApp em view_tenants_management'
);

-- anon --------------------------------------------------------------------------------------------------------------------
reset role;
set local role anon;

select throws_ok(
  $$select id from public.whatsapp_instances$$,
  '42501', null,
  'anon nao le nada de whatsapp_instances'
);

reset role;
select * from finish(true);
rollback;
