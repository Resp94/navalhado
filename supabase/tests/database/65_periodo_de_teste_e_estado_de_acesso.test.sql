begin;
create extension if not exists pgtap with schema extensions;
select plan(76);

-- Spec 052, ticket 03: periodo de teste, Estado de Acesso e bloqueio.
--
-- tenant_subscriptions passa a ter uma linha por tenant, com as situacoes
-- trialing, active, past_due, blocked, canceled e courtesy. A funcao
-- private.tenant_access_state(tenant, agora) devolve o Estado de Acesso:
-- allowed, warning ou blocked, com o motivo e a data relevante. A rotina diaria
-- private.block_expired_subscriptions grava o bloqueio das transicoes que so
-- dependem do tempo. O painel nao ganha regra de acesso no banco por causa disso.

create function pg_temp.t0() returns timestamptz language sql immutable as
  $$select '2026-10-01 12:00:00+00'::timestamptz$$;

create function pg_temp.d(p timestamptz) returns text language sql immutable as
  $$select coalesce(to_char(p at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'), '-')$$;

-- Casos de assinatura, todos avaliados em t0 = 2026-10-01 12:00 UTC.
create temp table t65_casos (
  nome text primary key,
  status text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  first_failed_at timestamptz,
  courtesy_ends_at timestamptz,
  blocked_at timestamptz,
  blocked_reason text
);

insert into t65_casos values
  ('trial_folga', 'trialing', pg_temp.t0() + interval '10 days', null, null, null, null, null),
  ('trial_3d', 'trialing', pg_temp.t0() + interval '3 days', null, null, null, null, null),
  ('trial_3d_e_1s', 'trialing', pg_temp.t0() + interval '3 days 1 second', null, null, null, null, null),
  ('trial_ultimo_dia', 'trialing', pg_temp.t0() + interval '10 hours', null, null, null, null, null),
  ('trial_no_limite', 'trialing', pg_temp.t0(), null, null, null, null, null),
  ('trial_vencido', 'trialing', pg_temp.t0() - interval '2 days', null, null, null, null, null),
  ('ativa', 'active', null, pg_temp.t0() + interval '20 days', null, null, null, null),
  ('ativa_periodo_vencido', 'active', null, pg_temp.t0() - interval '1 day', null, null, null, null),
  ('recusa_dia0', 'past_due', null, null, pg_temp.t0(), null, null, null),
  ('recusa_dia4', 'past_due', null, null, pg_temp.t0() - interval '4 days 23 hours', null, null, null),
  ('recusa_dia5', 'past_due', null, null, pg_temp.t0() - interval '5 days', null, null, null),
  ('recusa_dia6', 'past_due', null, null, pg_temp.t0() - interval '6 days', null, null, null),
  ('cancelada_no_periodo', 'canceled', null, pg_temp.t0() + interval '5 days', null, null, null, null),
  ('cancelada_no_limite', 'canceled', null, pg_temp.t0(), null, null, null, null),
  ('cancelada_vencida', 'canceled', null, pg_temp.t0() - interval '3 days', null, null, null, null),
  ('cancelada_sem_periodo', 'canceled', null, null, null, null, null, null),
  ('cortesia_sem_fim', 'courtesy', null, null, null, null, null, null),
  ('cortesia_com_fim', 'courtesy', null, null, null, pg_temp.t0() + interval '30 days', null, null),
  ('cortesia_no_limite', 'courtesy', null, null, null, pg_temp.t0(), null, null),
  ('cortesia_vencida', 'courtesy', null, null, null, pg_temp.t0() - interval '1 day', null, null),
  ('bloqueada', 'blocked', null, null, null, null, pg_temp.t0() - interval '2 days', 'trial_expired'),
  ('bloqueada_manual', 'blocked', null, null, null, null, pg_temp.t0() - interval '2 days', null);

insert into public.tenants (name, email, phone)
select '__t65_' || nome || '__', '__t65_' || nome || '__@teste.com',
       '1199965' || lpad((row_number() over (order by nome))::text, 4, '0')
from t65_casos;

insert into public.tenants (name, email, phone) values
  ('__t65_a__', '__t65_a__@teste.com', '11999965001'),
  ('__t65_b__', '__t65_b__@teste.com', '11999965002'),
  ('__t65_sem_assinatura__', '__t65_sem_assinatura__@teste.com', '11999965003');

insert into public.tenant_subscriptions
  (tenant_id, plan_id, status, trial_ends_at, current_period_end, first_failed_at, courtesy_ends_at, blocked_at, blocked_reason)
select t.id, 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', c.status, c.trial_ends_at, c.current_period_end,
       c.first_failed_at, c.courtesy_ends_at, c.blocked_at, c.blocked_reason
from t65_casos c
join public.tenants t on t.name = '__t65_' || c.nome || '__';

-- A: teste nos ultimos 3 dias (aviso). B: bloqueada pelo fim do teste. Tempo real.
insert into public.tenant_subscriptions (tenant_id, plan_id, status, trial_ends_at, blocked_at, blocked_reason)
select id, 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'trialing', now() + interval '2 days', null, null
from public.tenants where name = '__t65_a__';

insert into public.tenant_subscriptions (tenant_id, plan_id, status, trial_ends_at, blocked_at, blocked_reason)
select id, 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'blocked', null, now() - interval '1 day', 'trial_expired'
from public.tenants where name = '__t65_b__';

create function pg_temp.estado(p_nome text) returns text language sql as
  $$select e.access || '|' || e.reason || '|' || pg_temp.d(e.relevant_date)
    from public.tenants t, private.tenant_access_state(t.id, pg_temp.t0()) e
    where t.name = '__t65_' || p_nome || '__'$$;

create function pg_temp.linha(p_nome text) returns text language sql as
  $$select s.status || '|' || pg_temp.d(s.blocked_at) || '|' || coalesce(s.blocked_reason, '-')
    from public.tenant_subscriptions s
    join public.tenants t on t.id = s.tenant_id
    where t.name = '__t65_' || p_nome || '__'$$;

-- Estrutura ------------------------------------------------------------------
select columns_are('public', 'tenant_subscriptions', array[
  'id', 'tenant_id', 'plan_id', 'status', 'created_at', 'updated_at',
  'trial_ends_at', 'current_period_start', 'current_period_end', 'first_failed_at',
  'blocked_at', 'blocked_reason', 'canceled_at', 'courtesy_ends_at',
  'scheduled_plan_id', 'mp_subscription_id', 'card_brand', 'card_last4', 'unblocked_until'
], 'a assinatura absorve start_date, end_date e billing_cycle nos campos novos');

select throws_ok(
  $$insert into public.tenant_subscriptions (tenant_id, plan_id, status, trial_ends_at)
    select id, 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'trialing', now()
    from public.tenants where name = '__t65_a__'$$,
  '23505', null,
  'uma barbearia tem uma unica assinatura'
);

select throws_ok(
  $$insert into public.tenant_subscriptions (tenant_id, plan_id, status)
    select id, 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'suspended'
    from public.tenants where name = '__t65_sem_assinatura__'$$,
  '23514', null,
  'o valor antigo suspended nao existe mais'
);

select throws_ok(
  $$insert into public.tenant_subscriptions (tenant_id, plan_id, status)
    select id, 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'trialing'
    from public.tenants where name = '__t65_sem_assinatura__'$$,
  '23514', null,
  'assinatura em teste exige a data de fim do teste'
);

select throws_ok(
  $$insert into public.tenant_subscriptions (tenant_id, plan_id, status)
    select id, 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'past_due'
    from public.tenants where name = '__t65_sem_assinatura__'$$,
  '23514', null,
  'assinatura com pagamento recusado exige a data da primeira recusa'
);

select throws_ok(
  $$insert into public.tenant_subscriptions (tenant_id, plan_id, status, blocked_reason)
    select id, 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'blocked', 'porque_sim'
    from public.tenants where name = '__t65_sem_assinatura__'$$,
  '23514', null,
  'o motivo do bloqueio so aceita os motivos conhecidos'
);

-- Estado de Acesso: teste ----------------------------------------------------
select is(pg_temp.estado('trial_folga'), 'allowed|trial|2026-10-11T12:00:00',
  'teste com 10 dias de folga: liberado');
select is(pg_temp.estado('trial_3d'), 'warning|trial|2026-10-04T12:00:00',
  'teste com exatamente 3 dias restantes: liberado com aviso');
select is(pg_temp.estado('trial_3d_e_1s'), 'allowed|trial|2026-10-04T12:00:01',
  'teste com 3 dias e 1 segundo restantes: ainda sem aviso');
select is(pg_temp.estado('trial_ultimo_dia'), 'warning|trial|2026-10-01T22:00:00',
  'ultimo dia do teste: liberado com aviso');
select is(pg_temp.estado('trial_no_limite'), 'blocked|trial_expired|2026-10-01T12:00:00',
  'no instante do fim do teste: bloqueado');
select is(pg_temp.estado('trial_vencido'), 'blocked|trial_expired|2026-09-29T12:00:00',
  'teste vencido ha 2 dias: bloqueado, com a data do fim do teste');

-- Estado de Acesso: ativa ----------------------------------------------------
select is(pg_temp.estado('ativa'), 'allowed|active|2026-10-21T12:00:00',
  'assinatura ativa: liberada, com o fim do periodo pago');
select is(pg_temp.estado('ativa_periodo_vencido'), 'allowed|active|2026-09-30T12:00:00',
  'ativa com periodo vencido (renovacao a caminho): continua liberada');

-- Estado de Acesso: pagamento recusado ---------------------------------------
select is(pg_temp.estado('recusa_dia0'), 'warning|payment_failed|2026-10-06T12:00:00',
  'dia 0 da recusa: aviso, com a data em que bloqueia');
select is(pg_temp.estado('recusa_dia4'), 'warning|payment_failed|2026-10-01T13:00:00',
  'dia 4 da recusa (falta 1 hora): ainda com aviso');
select is(pg_temp.estado('recusa_dia5'), 'blocked|payment_failed|2026-10-01T12:00:00',
  'dia 5 da recusa: bloqueado');
select is(pg_temp.estado('recusa_dia6'), 'blocked|payment_failed|2026-09-30T12:00:00',
  'dia 6 da recusa: bloqueado desde o quinto dia');

-- Estado de Acesso: cancelada ------------------------------------------------
-- Ticket 12: liberada com aviso (e nao so liberada), para a faixa dizer "Assinatura cancelada. Acesso ate DD/MM.".
select is(pg_temp.estado('cancelada_no_periodo'), 'warning|canceled|2026-10-06T12:00:00',
  'cancelada dentro do periodo pago: liberada com aviso ate o fim do periodo');
select is(pg_temp.estado('cancelada_no_limite'), 'blocked|canceled|2026-10-01T12:00:00',
  'cancelada no instante do fim do periodo: bloqueada');
select is(pg_temp.estado('cancelada_vencida'), 'blocked|canceled|2026-09-28T12:00:00',
  'cancelada com periodo vencido: bloqueada');
select is(pg_temp.estado('cancelada_sem_periodo'), 'blocked|canceled|-',
  'cancelada sem periodo pago registrado: bloqueada');

-- Estado de Acesso: cortesia -------------------------------------------------
select is(pg_temp.estado('cortesia_sem_fim'), 'allowed|courtesy|-',
  'cortesia sem fim: liberada sempre');
select is(pg_temp.estado('cortesia_com_fim'), 'allowed|courtesy|2026-10-31T12:00:00',
  'cortesia com fim no futuro: liberada');
select is(pg_temp.estado('cortesia_no_limite'), 'blocked|courtesy_expired|2026-10-01T12:00:00',
  'cortesia no instante do fim: bloqueada');
select is(pg_temp.estado('cortesia_vencida'), 'blocked|courtesy_expired|2026-09-30T12:00:00',
  'cortesia vencida: bloqueada como teste vencido');

-- Estado de Acesso: bloqueada e sem assinatura -------------------------------
select is(pg_temp.estado('bloqueada'), 'blocked|trial_expired|2026-09-29T12:00:00',
  'bloqueada devolve o motivo gravado e a data do bloqueio');
select is(pg_temp.estado('bloqueada_manual'), 'blocked|blocked|2026-09-29T12:00:00',
  'bloqueada sem motivo gravado devolve o motivo generico');
select is(pg_temp.estado('sem_assinatura'), 'allowed|no_subscription|-',
  'barbearia sem assinatura nao e bloqueada');

-- A funcao usa a hora do servidor quando nao recebe o instante.
select is(
  (select e.access || '|' || e.reason
   from public.tenants t, private.tenant_access_state(t.id) e where t.name = '__t65_a__'),
  'warning|trial',
  'sem instante informado usa now(): teste com 2 dias restantes tem aviso'
);
select is(
  (select e.access || '|' || e.reason
   from public.tenants t, private.tenant_access_state(t.id) e where t.name = '__t65_b__'),
  'blocked|trial_expired',
  'sem instante informado usa now(): bloqueada continua bloqueada'
);

-- Rotina diaria --------------------------------------------------------------
select cmp_ok(
  private.block_expired_subscriptions(pg_temp.t0()), '>=', 9,
  'a rotina bloqueia as 9 assinaturas vencidas dos casos'
);

select is(pg_temp.linha('trial_no_limite'), 'blocked|2026-10-01T12:00:00|trial_expired',
  'rotina: teste vencido vira bloqueada, com a data do fim do teste e o motivo');
select is(pg_temp.linha('trial_vencido'), 'blocked|2026-09-29T12:00:00|trial_expired',
  'rotina: o bloqueio grava quando o acesso acabou, nao quando a rotina rodou');
select is(pg_temp.linha('recusa_dia5'), 'blocked|2026-10-01T12:00:00|payment_failed',
  'rotina: quinto dia da recusa vira bloqueada');
select is(pg_temp.linha('recusa_dia6'), 'blocked|2026-09-30T12:00:00|payment_failed',
  'rotina: recusa antiga grava o quinto dia como data do bloqueio');
select is(pg_temp.linha('cancelada_no_limite'), 'blocked|2026-10-01T12:00:00|canceled',
  'rotina: cancelada vira bloqueada no fim do periodo pago');
select is(pg_temp.linha('cancelada_vencida'), 'blocked|2026-09-28T12:00:00|canceled',
  'rotina: cancelada vencida grava o fim do periodo como data do bloqueio');
select is(pg_temp.linha('cancelada_sem_periodo'), 'blocked|2026-10-01T12:00:00|canceled',
  'rotina: cancelada sem periodo usa o instante da rotina como data do bloqueio');
select is(pg_temp.linha('cortesia_no_limite'), 'blocked|2026-10-01T12:00:00|courtesy_expired',
  'rotina: cortesia vencida vira bloqueada');
select is(pg_temp.linha('cortesia_vencida'), 'blocked|2026-09-30T12:00:00|courtesy_expired',
  'rotina: cortesia antiga grava o fim da cortesia como data do bloqueio');

select is(
  (select string_agg(c.nome || '=' || s.status, ',' order by c.nome)
   from t65_casos c
   join public.tenants t on t.name = '__t65_' || c.nome || '__'
   join public.tenant_subscriptions s on s.tenant_id = t.id
   where c.nome in ('trial_folga', 'trial_3d', 'trial_3d_e_1s', 'trial_ultimo_dia', 'ativa',
                    'ativa_periodo_vencido', 'recusa_dia0', 'recusa_dia4',
                    'cancelada_no_periodo', 'cortesia_sem_fim', 'cortesia_com_fim')),
  'ativa=active,ativa_periodo_vencido=active,cancelada_no_periodo=canceled,cortesia_com_fim=courtesy,cortesia_sem_fim=courtesy,recusa_dia0=past_due,recusa_dia4=past_due,trial_3d=trialing,trial_3d_e_1s=trialing,trial_folga=trialing,trial_ultimo_dia=trialing',
  'rotina: nao mexe em teste valido, ativa, recusa dentro do prazo, cancelada no periodo nem cortesia valida'
);

select is(
  (select count(*)::integer
   from t65_casos c
   join public.tenants t on t.name = '__t65_' || c.nome || '__'
   join public.tenant_subscriptions s on s.tenant_id = t.id
   where c.nome in ('trial_folga', 'trial_3d', 'trial_3d_e_1s', 'trial_ultimo_dia', 'ativa',
                    'ativa_periodo_vencido', 'recusa_dia0', 'recusa_dia4',
                    'cancelada_no_periodo', 'cortesia_sem_fim', 'cortesia_com_fim')
     and s.blocked_at is not null),
  0,
  'rotina: as assinaturas que ela nao bloqueia continuam sem data de bloqueio'
);

select is(pg_temp.linha('bloqueada'), 'blocked|2026-09-29T12:00:00|trial_expired',
  'rotina: assinatura ja bloqueada nao tem a data do bloqueio reescrita');

select is(private.block_expired_subscriptions(pg_temp.t0()), 0,
  'rotina: rodar de novo nao bloqueia nada e nao reescreve datas');

select is(pg_temp.estado('trial_vencido'), 'blocked|trial_expired|2026-09-29T12:00:00',
  'depois da rotina, o Estado de Acesso do teste vencido e o mesmo de antes dela');
select is(pg_temp.estado('recusa_dia5'), 'blocked|payment_failed|2026-10-01T12:00:00',
  'depois da rotina, o Estado de Acesso da recusa vencida e o mesmo de antes dela');

select lives_ok(
  $$select private.block_expired_subscriptions()$$,
  'a rotina roda sem argumento, como o pg_cron chama'
);

select ok(
  exists (
    select 1 from cron.job
    where jobname = 'block-expired-subscriptions'
      and schedule = '5 3 * * *'
      and command ilike '%private.block_expired_subscriptions%'
  ),
  'a rotina esta agendada no pg_cron uma vez por dia'
);

select ok(
  not has_function_privilege('anon', 'private.block_expired_subscriptions(timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'private.block_expired_subscriptions(timestamptz)', 'execute')
  and not has_function_privilege('anon', 'private.tenant_access_state(uuid,timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'private.tenant_access_state(uuid,timestamptz)', 'execute'),
  'a rotina e a funcao de estado por tenant nao sao executaveis por anon nem por authenticated'
);

-- Usuarios para as metricas, a RPC e a RLS -----------------------------------
insert into auth.users (id, email)
select gen_random_uuid(), '__t65_' || n || '__@teste.com'
from unnest(array['gerA', 'barbA', 'gerB', 'gerNulo', 'prop']) as n;

update public.users set tenant_id = (select id from public.tenants where name = '__t65_a__'),
  role = 'gerente', is_active = true where email = '__t65_gerA__@teste.com';
update public.users set tenant_id = (select id from public.tenants where name = '__t65_a__'),
  role = 'barbeiro', is_active = true where email = '__t65_barbA__@teste.com';
update public.users set tenant_id = (select id from public.tenants where name = '__t65_b__'),
  role = 'gerente', is_active = true where email = '__t65_gerB__@teste.com';
update public.users set tenant_id = null, role = 'gerente', is_active = true
  where email = '__t65_gerNulo__@teste.com';
update public.users set tenant_id = null, role = 'proprietario', is_active = true
  where email = '__t65_prop__@teste.com';

-- Visao do Proprietario e metricas -------------------------------------------
select is(
  (select subscription_status || '|' || plan_name from public.view_tenants_management
   where tenant_name = '__t65_cancelada_no_periodo__'),
  'canceled|Tesoura',
  'Admin > Tenants continua mostrando a assinatura cancelada, que ainda tem acesso'
);
select is(
  (select subscription_end_date from public.view_tenants_management
   where tenant_name = '__t65_trial_folga__'),
  '2026-10-11 12:00:00+00'::timestamptz,
  'a data de fim mostrada para quem esta em teste e o fim do teste'
);
select is(
  (select subscription_end_date from public.view_tenants_management
   where tenant_name = '__t65_ativa__'),
  '2026-10-21 12:00:00+00'::timestamptz,
  'a data de fim mostrada para a assinatura ativa e o fim do periodo pago'
);

select set_config('request.jwt.claim.sub',
  (select id::text from auth.users where email = '__t65_prop__@teste.com'), true);

select is(
  (public.get_admin_dashboard_metrics() ->> 'mrr')::numeric,
  (select coalesce(sum(p.price), 0) from public.tenant_subscriptions s
   join public.plans p on p.id = s.plan_id where s.status = 'active'),
  'metricas: o MRR soma o preco mensal das assinaturas ativas'
);
select is(
  (public.get_admin_dashboard_metrics() ->> 'active_tenants')::integer,
  (select count(distinct tenant_id)::integer from public.tenant_subscriptions where status = 'active'),
  'metricas: barbearias ativas contam as assinaturas ativas'
);
select is(
  (public.get_admin_dashboard_metrics() ->> 'suspended_tenants')::integer,
  (select count(distinct tenant_id)::integer from public.tenant_subscriptions where status = 'blocked'),
  'metricas: barbearias suspensas contam as bloqueadas'
);
select cmp_ok(
  (public.get_admin_dashboard_metrics() ->> 'suspended_tenants')::integer, '>=', 12,
  'metricas: as 12 bloqueadas dos casos aparecem como suspensas'
);

-- Cadastro: a barbearia nova nasce em teste de 15 dias -----------------------
insert into auth.users (id, email, raw_user_meta_data)
values (
  gen_random_uuid(),
  '__t65_cadastro__auth@teste.com',
  jsonb_build_object(
    'name', 'Gestor T65',
    'tenant_signup', jsonb_build_object(
      'name', 'Barbearia T65 Cadastro',
      'email', 'contato@barbeariat65.com',
      'phone', '11988886565',
      'plan_id', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22'
    )
  )
);

select is(
  (select s.status from public.tenant_subscriptions s
   join public.tenants t on t.id = s.tenant_id where t.name = 'Barbearia T65 Cadastro'),
  'trialing',
  'o cadastro cria a assinatura em teste'
);
select is(
  (select s.trial_ends_at from public.tenant_subscriptions s
   join public.tenants t on t.id = s.tenant_id where t.name = 'Barbearia T65 Cadastro'),
  now() + interval '15 days',
  'o teste da barbearia nova dura 15 dias'
);
select is(
  (select e.access || '|' || e.reason
   from public.tenants t, private.tenant_access_state(t.id) e where t.name = 'Barbearia T65 Cadastro'),
  'allowed|trial',
  'a barbearia nova entra liberada, sem aviso'
);

-- RPC get_my_access_state: cada usuario ve so o estado da propria barbearia ---
select ok(
  has_function_privilege('authenticated', 'public.get_my_access_state()', 'execute')
  and not has_function_privilege('anon', 'public.get_my_access_state()', 'execute'),
  'get_my_access_state e executavel por authenticated e nao por anon'
);

select set_config('request.jwt.claim.sub',
  (select id::text from auth.users where email = '__t65_gerA__@teste.com'), true);
set local role authenticated;

select is(
  (select access || '|' || reason from public.get_my_access_state()),
  'warning|trial',
  'o Gerente da barbearia A recebe o estado da barbearia A'
);
select is(
  (select string_agg(status, ',') from public.tenant_subscriptions),
  'trialing',
  'o Gerente le so a assinatura do proprio tenant'
);
select lives_ok(
  $$update public.tenant_subscriptions set status = 'active'$$,
  'o Gerente tenta alterar a assinatura: a RLS esconde a linha, sem erro'
);
select throws_ok(
  $$insert into public.tenant_subscriptions (tenant_id, plan_id, status)
    values (gen_random_uuid(), 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'active')$$,
  '42501', null,
  'o Gerente nao cria assinatura'
);
select lives_ok(
  $$delete from public.tenant_subscriptions$$,
  'o Gerente tenta apagar a assinatura: a RLS esconde a linha, sem erro'
);

reset role;

select is(
  (select s.status from public.tenant_subscriptions s
   join public.tenants t on t.id = s.tenant_id where t.name = '__t65_a__'),
  'trialing',
  'a assinatura continua intacta depois das tentativas do Gerente'
);
select set_config('request.jwt.claim.sub',
  (select id::text from auth.users where email = '__t65_barbA__@teste.com'), true);
set local role authenticated;

select is(
  (select access || '|' || reason from public.get_my_access_state()),
  'warning|trial',
  'o Barbeiro da barbearia A recebe o estado da barbearia A'
);
select is(
  (select count(*)::integer from public.tenant_subscriptions),
  0,
  'o Barbeiro nao le a tabela de assinatura (cartao e id do Mercado Pago): so o Estado de Acesso pela RPC'
);
select lives_ok(
  $$update public.tenant_subscriptions set status = 'active'$$,
  'o Barbeiro tenta alterar a assinatura: a RLS esconde a linha, sem erro'
);
select throws_ok(
  $$insert into public.tenant_subscriptions (tenant_id, plan_id, status)
    values (gen_random_uuid(), 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'active')$$,
  '42501', null,
  'o Barbeiro nao cria assinatura'
);
select lives_ok(
  $$delete from public.tenant_subscriptions$$,
  'o Barbeiro tenta apagar a assinatura: a RLS esconde a linha, sem erro'
);

reset role;

select is(
  (select s.status from public.tenant_subscriptions s
   join public.tenants t on t.id = s.tenant_id where t.name = '__t65_a__'),
  'trialing',
  'a assinatura continua intacta depois das tentativas do Barbeiro'
);
select set_config('request.jwt.claim.sub',
  (select id::text from auth.users where email = '__t65_gerB__@teste.com'), true);
set local role authenticated;

select is(
  (select access || '|' || reason from public.get_my_access_state()),
  'blocked|trial_expired',
  'o Gerente da barbearia B, bloqueada, recebe o estado bloqueado'
);

reset role;
select set_config('request.jwt.claim.sub',
  (select id::text from auth.users where email = '__t65_gerNulo__@teste.com'), true);
set local role authenticated;

select is(
  (select count(*)::integer from public.get_my_access_state()),
  0,
  'o Gerente sem tenant nao recebe estado de nenhuma barbearia'
);
select is(
  (select count(*)::integer from public.tenant_subscriptions),
  0,
  'o Gerente sem tenant nao le assinatura nenhuma'
);

reset role;

select * from finish();
rollback;
