begin;
create extension if not exists pgtap with schema extensions;
select plan(52);

-- Spec 038 (Modulo de Relatorios), ticket 07: Comparecimento, cancelamento e
-- no-show (pagina Agenda). Cobre o contrato de leitura
-- (public.get_schedule_report) e o nucleo com relogio duplo injetado
-- (private.get_schedule_report_core: p_today para os limites do periodo,
-- p_now para classificar sem-desfecho/futuro pelo instante).

create temporary table t07_context (
  tenant_a_id uuid not null,
  tenant_b_id uuid not null,
  tenant_c_id uuid not null,
  gerente_a_id uuid not null,
  barbeiro_a_id uuid not null,
  gerente_b_id uuid not null,
  gerente_nulo_id uuid not null,
  proprietario_id uuid not null
) on commit drop;

with ta as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__t07_tenant_a__', '__t07_tenant_a__@teste.com', '11999980001', 'America/Sao_Paulo')
  returning id
), tb as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__t07_tenant_b__', '__t07_tenant_b__@teste.com', '11999980002', 'America/Sao_Paulo')
  returning id
), tc as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__t07_tenant_c__', '__t07_tenant_c__@teste.com', '11999980003', 'America/Sao_Paulo')
  returning id
), au_gerente_a as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t07_gerente_a__@teste.com') returning id
), au_barbeiro_a as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t07_barbeiro_a__@teste.com') returning id
), au_gerente_b as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t07_gerente_b__@teste.com') returning id
), au_gerente_nulo as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t07_gerente_nulo__@teste.com') returning id
), au_proprietario as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t07_proprietario__@teste.com') returning id
)
insert into t07_context (
  tenant_a_id, tenant_b_id, tenant_c_id, gerente_a_id, barbeiro_a_id, gerente_b_id, gerente_nulo_id, proprietario_id
)
select ta.id, tb.id, tc.id, au_gerente_a.id, au_barbeiro_a.id, au_gerente_b.id, au_gerente_nulo.id, au_proprietario.id
from ta, tb, tc, au_gerente_a, au_barbeiro_a, au_gerente_b, au_gerente_nulo, au_proprietario;

update public.users set tenant_id = (select tenant_a_id from t07_context), role = 'gerente', is_active = true
where id = (select gerente_a_id from t07_context);
update public.users set tenant_id = (select tenant_a_id from t07_context), role = 'barbeiro', is_active = true
where id = (select barbeiro_a_id from t07_context);
update public.users set tenant_id = (select tenant_b_id from t07_context), role = 'gerente', is_active = true
where id = (select gerente_b_id from t07_context);
update public.users set tenant_id = null, role = 'gerente', is_active = true
where id = (select gerente_nulo_id from t07_context);
update public.users set tenant_id = (select tenant_c_id from t07_context), role = 'proprietario', is_active = true
where id = (select proprietario_id from t07_context);

grant select on t07_context to authenticated;

-- Amplia o expediente do tenant_a para o dia inteiro: o teste de fronteira de
-- fuso precisa de um Agendamento as 23h30 local, e o trigger
-- validate_appointment_schedule_boundaries recusa horario fora do expediente
-- (padrao 08h-20h) na insercao. Isso e so fixture, nao muda a regra do
-- relatorio, que classifica por start_time independente do expediente.
update public.tenants
set business_hours = jsonb_build_object(
  'segunda', jsonb_build_object('open', '00:00', 'close', '23:59', 'active', true),
  'terca', jsonb_build_object('open', '00:00', 'close', '23:59', 'active', true),
  'quarta', jsonb_build_object('open', '00:00', 'close', '23:59', 'active', true),
  'quinta', jsonb_build_object('open', '00:00', 'close', '23:59', 'active', true),
  'sexta', jsonb_build_object('open', '00:00', 'close', '23:59', 'active', true),
  'sabado', jsonb_build_object('open', '00:00', 'close', '23:59', 'active', true),
  'domingo', jsonb_build_object('open', '00:00', 'close', '23:59', 'active', true)
)
where id = (select tenant_a_id from t07_context);

-- ---------------------------------------------------------------------------
-- Contrato das funcoes: existencia, search_path vazio, privilegios.
-- ---------------------------------------------------------------------------
select has_function(
  'public', 'get_schedule_report', array['uuid', 'date', 'date', 'uuid'],
  'public.get_schedule_report(uuid, date, date, uuid) existe'
);
select has_function(
  'private', 'get_schedule_report_core', array['uuid', 'date', 'date', 'uuid', 'date', 'timestamptz', 'text'],
  'private.get_schedule_report_core(uuid, date, date, uuid, date, timestamptz, text) existe'
);

select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.get_schedule_report(uuid,date,date,uuid)'::regprocedure),
  'a funcao publica fixa search_path vazio'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'private.get_schedule_report_core(uuid,date,date,uuid,date,timestamptz,text)'::regprocedure),
  'o nucleo privado fixa search_path vazio'
);

select ok(
  not has_function_privilege('anon', 'public.get_schedule_report(uuid,date,date,uuid)', 'EXECUTE'),
  'anon nao executa a funcao publica'
);
select ok(
  has_function_privilege('authenticated', 'public.get_schedule_report(uuid,date,date,uuid)', 'EXECUTE'),
  'authenticated executa a funcao publica'
);
select ok(
  has_function_privilege('service_role', 'public.get_schedule_report(uuid,date,date,uuid)', 'EXECUTE'),
  'service_role executa a funcao publica'
);

select ok(
  not has_function_privilege('anon', 'private.get_schedule_report_core(uuid,date,date,uuid,date,timestamptz,text)', 'EXECUTE'),
  'anon nao executa o nucleo privado'
);
select ok(
  not has_function_privilege('authenticated', 'private.get_schedule_report_core(uuid,date,date,uuid,date,timestamptz,text)', 'EXECUTE'),
  'authenticated nao executa o nucleo privado diretamente'
);
select ok(
  has_function_privilege('service_role', 'private.get_schedule_report_core(uuid,date,date,uuid,date,timestamptz,text)', 'EXECUTE'),
  'service_role executa o nucleo privado'
);

-- ---------------------------------------------------------------------------
-- Acesso: barbeiro recusado, gerente pedindo outro tenant recusado, gerente
-- com tenant nulo recusado, proprietario aceito para qualquer tenant.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', (select barbeiro_a_id::text from t07_context), true);
set local role authenticated;
select throws_ok(
  $$select public.get_schedule_report(null, current_date, current_date, null)$$,
  '42501',
  'Acesso negado. Apenas gerentes podem acessar os relatórios.',
  'barbeiro recebe erro de acesso'
);
reset role;

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from t07_context), true);
set local role authenticated;
select throws_ok(
  format(
    $$select public.get_schedule_report('%s'::uuid, current_date, current_date, null)$$,
    (select tenant_b_id from t07_context)
  ),
  '42501',
  'Acesso negado para a unidade solicitada.',
  'gerente pedindo outro tenant e recusado'
);
reset role;

select set_config('request.jwt.claim.sub', (select gerente_nulo_id::text from t07_context), true);
set local role authenticated;
select throws_ok(
  format(
    $$select public.get_schedule_report('%s'::uuid, current_date, current_date, null)$$,
    (select tenant_a_id from t07_context)
  ),
  '42501',
  'Acesso negado. Gerente sem unidade vinculada.',
  'gerente com tenant nulo e recusado, mesmo pedindo um tenant valido'
);
reset role;

select set_config('request.jwt.claim.sub', (select proprietario_id::text from t07_context), true);
set local role authenticated;
select ok(
  (select public.get_schedule_report((select tenant_a_id from t07_context), '2026-08-01'::date, '2026-08-01'::date, null)) ? 'status_totals',
  'proprietario acessa o relatorio de qualquer unidade'
);
reset role;

-- ---------------------------------------------------------------------------
-- Validacao de periodo (sem granularidade: nao ha p_granularity aqui).
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select private.get_schedule_report_core('00000000-0000-0000-0000-000000000001'::uuid, null, '2026-06-16'::date, null, '2026-06-15'::date, '2026-06-15 12:00:00-03'::timestamptz, 'America/Sao_Paulo')$$,
  '22023', 'As datas de início e fim do período são obrigatórias.', 'datas nulas sao recusadas'
);
select throws_ok(
  $$select private.get_schedule_report_core('00000000-0000-0000-0000-000000000001'::uuid, '2026-06-10'::date, '2026-06-05'::date, null, '2026-06-15'::date, '2026-06-15 12:00:00-03'::timestamptz, 'America/Sao_Paulo')$$,
  '22023', 'A data final não pode ser anterior à data inicial.', 'fim antes do inicio e recusado'
);
select throws_ok(
  $$select private.get_schedule_report_core('00000000-0000-0000-0000-000000000001'::uuid, '2026-06-10'::date, '2026-06-20'::date, null, '2026-06-15'::date, '2026-06-15 12:00:00-03'::timestamptz, 'America/Sao_Paulo')$$,
  '22023', 'A data final não pode ser posterior a hoje.', 'fim depois de hoje e recusado'
);
select throws_ok(
  $$select private.get_schedule_report_core('00000000-0000-0000-0000-000000000001'::uuid, '2024-06-01'::date, '2024-06-05'::date, null, '2026-06-15'::date, '2026-06-15 12:00:00-03'::timestamptz, 'America/Sao_Paulo')$$,
  '22023', 'A data inicial não pode ser mais de 730 dias antes de hoje.', 'inicio antes de hoje menos 730 dias e recusado'
);
select throws_ok(
  $$select private.get_schedule_report_core('00000000-0000-0000-0000-000000000001'::uuid, '2025-06-01'::date, '2026-06-05'::date, null, '2026-06-15'::date, '2026-06-15 12:00:00-03'::timestamptz, 'America/Sao_Paulo')$$,
  '22023', 'O período não pode ter mais de 366 dias.', 'periodo acima de 366 dias e recusado'
);

-- ---------------------------------------------------------------------------
-- Cenario principal.
-- Periodo de teste: 2026-08-20..2026-08-24, p_today = 2026-08-24,
-- p_now = 2026-08-24 08:00:00-03 (inicio do dia final, para permitir
-- Agendamentos "futuros" ainda dentro do periodo, no mesmo dia).
-- ---------------------------------------------------------------------------
create temporary table t07_fix (
  prof_um_id uuid not null,
  prof_dois_id uuid not null,
  prof_arquivado_id uuid not null,
  servico_id uuid not null,
  ap_completed_id uuid not null,
  ap_no_show_id uuid not null,
  ap_canceled_id uuid not null,
  ap_canceled_com_motivo_a_id uuid not null,
  ap_canceled_com_motivo_b_id uuid not null,
  ap_canceled_sem_motivo_id uuid not null,
  ap_unresolved_id uuid not null,
  ap_future_id uuid not null,
  ap_completed_dois_id uuid not null,
  ap_online_completed_id uuid not null,
  ap_online_no_show_id uuid not null,
  ap_arquivado_completed_id uuid not null,
  ap_tz_boundary_id uuid not null
) on commit drop;
insert into t07_fix (
  prof_um_id, prof_dois_id, prof_arquivado_id, servico_id,
  ap_completed_id, ap_no_show_id, ap_canceled_id, ap_canceled_com_motivo_a_id,
  ap_canceled_com_motivo_b_id, ap_canceled_sem_motivo_id, ap_unresolved_id, ap_future_id,
  ap_completed_dois_id, ap_online_completed_id, ap_online_no_show_id, ap_arquivado_completed_id,
  ap_tz_boundary_id
) values (
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid()
);
grant select on t07_fix to authenticated;

insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active)
select prof_um_id, (select tenant_a_id from t07_context), '__t07_prof_um__', '11999970001', 30, true from t07_fix;
insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active)
select prof_dois_id, (select tenant_a_id from t07_context), '__t07_prof_dois__', '11999970002', 30, true from t07_fix;
insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active)
select prof_arquivado_id, (select tenant_a_id from t07_context), '__t07_prof_arquivado__', '11999970003', 30, true from t07_fix;

insert into public.services (id, tenant_id, name, price, duration_minutes, category, is_active)
select servico_id, (select tenant_a_id from t07_context), '__t07_servico__', 100, 30, 'Corte', true from t07_fix;

-- prof_um: 1 completed, 1 no_show, 3 canceled (2 com motivo diferente
-- grafia/espaco do mesmo motivo, 1 sem motivo), 1 unresolved (confirmed
-- passado), 1 future (confirmed no mesmo dia final, depois de p_now).
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason)
select ap_completed_id, (select tenant_a_id from t07_context), prof_um_id, servico_id,
  '2026-08-20 10:00:00-03'::timestamptz, '2026-08-20 10:30:00-03'::timestamptz, 'completed', 'pending', 'manual', null
from t07_fix;
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason)
select ap_no_show_id, (select tenant_a_id from t07_context), prof_um_id, servico_id,
  '2026-08-21 10:00:00-03'::timestamptz, '2026-08-21 10:30:00-03'::timestamptz, 'no_show', 'pending', 'manual', null
from t07_fix;
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason)
select ap_canceled_com_motivo_a_id, (select tenant_a_id from t07_context), prof_um_id, servico_id,
  '2026-08-21 14:00:00-03'::timestamptz, '2026-08-21 14:30:00-03'::timestamptz, 'canceled', 'pending', 'manual', '  Cliente Desmarcou  '
from t07_fix;
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason)
select ap_canceled_com_motivo_b_id, (select tenant_a_id from t07_context), prof_um_id, servico_id,
  '2026-08-22 09:00:00-03'::timestamptz, '2026-08-22 09:30:00-03'::timestamptz, 'canceled', 'pending', 'manual', 'cliente desmarcou'
from t07_fix;
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason)
select ap_canceled_sem_motivo_id, (select tenant_a_id from t07_context), prof_um_id, servico_id,
  '2026-08-22 11:00:00-03'::timestamptz, '2026-08-22 11:30:00-03'::timestamptz, 'canceled', 'pending', 'manual', null
from t07_fix;
-- ap_canceled_id: motivo unico, para compor a contagem total de cancelados
-- (4 no total: motivo_a+motivo_b normalizam juntos = 2, sem_motivo = 1,
-- este = 1 com motivo proprio "outro motivo").
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason)
select ap_canceled_id, (select tenant_a_id from t07_context), prof_um_id, servico_id,
  '2026-08-23 09:00:00-03'::timestamptz, '2026-08-23 09:30:00-03'::timestamptz, 'canceled', 'pending', 'manual', 'Outro Motivo'
from t07_fix;
-- unresolved: confirmed com start_time no passado relativo a p_now
-- (2026-08-24 08:00:00-03).
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason)
select ap_unresolved_id, (select tenant_a_id from t07_context), prof_um_id, servico_id,
  '2026-08-23 15:00:00-03'::timestamptz, '2026-08-23 15:30:00-03'::timestamptz, 'confirmed', 'pending', 'manual', null
from t07_fix;
-- future: confirmed com start_time depois de p_now, ainda dentro do periodo
-- (mesmo dia final, 2026-08-24 10h > p_now 08h).
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason)
select ap_future_id, (select tenant_a_id from t07_context), prof_um_id, servico_id,
  '2026-08-24 10:00:00-03'::timestamptz, '2026-08-24 10:30:00-03'::timestamptz, 'confirmed', 'pending', 'manual', null
from t07_fix;

-- prof_dois: 1 completed (manual).
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason)
select ap_completed_dois_id, (select tenant_a_id from t07_context), prof_dois_id, servico_id,
  '2026-08-20 11:00:00-03'::timestamptz, '2026-08-20 11:30:00-03'::timestamptz, 'completed', 'pending', 'manual', null
from t07_fix;

-- origem online: 1 completed, 1 no_show (para testar by_origin isolado de
-- manual, e a taxa de comparecimento por origem).
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason)
select ap_online_completed_id, (select tenant_a_id from t07_context), prof_dois_id, servico_id,
  '2026-08-20 15:00:00-03'::timestamptz, '2026-08-20 15:30:00-03'::timestamptz, 'completed', 'pending', 'online', null
from t07_fix;
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason)
select ap_online_no_show_id, (select tenant_a_id from t07_context), prof_dois_id, servico_id,
  '2026-08-21 16:00:00-03'::timestamptz, '2026-08-21 16:30:00-03'::timestamptz, 'no_show', 'pending', 'online', null
from t07_fix;

-- prof_arquivado: 1 completed, depois inativado/arquivado -- deve aparecer
-- em by_professional mesmo assim, mas por 'p_professional_id' NAO filtrado.
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason)
select ap_arquivado_completed_id, (select tenant_a_id from t07_context), prof_arquivado_id, servico_id,
  '2026-08-20 09:00:00-03'::timestamptz, '2026-08-20 09:30:00-03'::timestamptz, 'completed', 'pending', 'manual', null
from t07_fix;
update public.professionals set is_active = false, deleted_at = now()
where id = (select prof_arquivado_id from t07_fix);

-- Fronteira de fuso: 23h30 local no ultimo dia do periodo anterior
-- (2026-08-19, America/Sao_Paulo = UTC-3) deve cair no periodo ANTERIOR
-- (19 esta fora do periodo 20-24), nao no periodo atual nem em outro dia
-- UTC. Em UTC isso e 2026-08-20 02:30:00, que se o filtro usasse dia UTC
-- entraria erroneamente no periodo atual.
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason)
select ap_tz_boundary_id, (select tenant_a_id from t07_context), prof_um_id, servico_id,
  '2026-08-19 23:30:00-03'::timestamptz, '2026-08-20 00:00:00-03'::timestamptz, 'completed', 'pending', 'manual', null
from t07_fix;

-- ---------------------------------------------------------------------------
-- Classificacao e status_totals do periodo 2026-08-20..2026-08-24, com
-- p_now = 2026-08-24 08:00:00-03.
-- Total esperado (exclui a fronteira de fuso, que cai no dia 19): completed
-- 4 (ap_completed, ap_completed_dois, ap_online_completed, ap_arquivado_completed),
-- no_show 2 (ap_no_show, ap_online_no_show), canceled 4, unresolved 1, future 1.
-- total = 4+2+4+1+1 = 12.
-- ---------------------------------------------------------------------------
select is(
  (
    select private.get_schedule_report_core(
      (select tenant_a_id from t07_context), '2026-08-20'::date, '2026-08-24'::date, null,
      '2026-08-24'::date, '2026-08-24 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'status_totals'
  ),
  jsonb_build_object(
    'total', 12, 'completed', 4, 'no_show', 2, 'canceled', 4, 'unresolved', 1, 'future', 1,
    'attendance_rate', round(4.0 / 6, 4), 'cancellation_rate', round(4.0 / (12 - 1), 4)
  ),
  'status_totals classifica corretamente completed/no_show/canceled/unresolved/future, com o limite de fuso excluindo o Agendamento do dia anterior'
);

-- unresolved: confirmed com start_time < p_now e classificado como sem
-- desfecho, nao como future nem completed.
select is(
  (
    select a.status
    from public.appointments a
    where a.id = (select ap_unresolved_id from t07_fix)
  ),
  'confirmed',
  'fixture: o Agendamento sem desfecho continua com status confirmed no banco (classificacao e so na leitura)'
);

-- future: confirmed com start_time >= p_now, mesmo dentro do periodo, nao
-- entra nas taxas (denominador de cancellation_rate exclui future).
select is(
  (
    select (private.get_schedule_report_core(
      (select tenant_a_id from t07_context), '2026-08-20'::date, '2026-08-24'::date, null,
      '2026-08-24'::date, '2026-08-24 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'status_totals' ->> 'future')::int
  ),
  1,
  'Agendamento confirmed com start_time depois de p_now, dentro do periodo, e classificado como future'
);

-- attendance_rate e cancellation_rate nulos quando o denominador e zero
-- (periodo sem nenhum Agendamento).
select is(
  (
    select private.get_schedule_report_core(
      (select tenant_a_id from t07_context), '2026-09-01'::date, '2026-09-01'::date, null,
      '2026-09-01'::date, '2026-09-01 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'status_totals'
  ),
  jsonb_build_object(
    'total', 0, 'completed', 0, 'no_show', 0, 'canceled', 0, 'unresolved', 0, 'future', 0,
    'attendance_rate', null, 'cancellation_rate', null
  ),
  'periodo sem Agendamento devolve totais zerados e taxas nulas (denominador zero)'
);

-- ---------------------------------------------------------------------------
-- by_origin: origem manual e online contadas isoladamente.
-- manual: completed 2 (ap_completed, ap_completed_dois) + arquivado 1 = 3,
-- no_show 1, canceled 4, unresolved 1, future 1 -> total 10.
-- online: completed 1, no_show 1 -> total 2.
-- ---------------------------------------------------------------------------
select is(
  (
    select o
    from jsonb_array_elements(
      private.get_schedule_report_core(
        (select tenant_a_id from t07_context), '2026-08-20'::date, '2026-08-24'::date, null,
        '2026-08-24'::date, '2026-08-24 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
      ) -> 'by_origin'
    ) as o
    where o ->> 'origin' = 'online'
  ),
  jsonb_build_object(
    'origin', 'online', 'total', 2, 'completed', 1, 'no_show', 1, 'canceled', 0, 'unresolved', 0,
    'attendance_rate', round(1.0 / 2, 4)
  ),
  'by_origin conta e calcula a taxa de comparecimento isoladamente por origem'
);

select is(
  (
    select (o ->> 'total')::int
    from jsonb_array_elements(
      private.get_schedule_report_core(
        (select tenant_a_id from t07_context), '2026-08-20'::date, '2026-08-24'::date, null,
        '2026-08-24'::date, '2026-08-24 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
      ) -> 'by_origin'
    ) as o
    where o ->> 'origin' = 'manual'
  ),
  10,
  'by_origin manual soma os Agendamentos de origem manual do periodo'
);

-- ---------------------------------------------------------------------------
-- by_professional: inclui inativo/arquivado com Agendamento no periodo, e
-- p_professional_id NAO filtra esta lista.
-- ---------------------------------------------------------------------------
select is(
  (
    select jsonb_build_object('is_active', p ->> 'is_active', 'archived', p ->> 'archived', 'total', p ->> 'total', 'completed', p ->> 'completed')
    from jsonb_array_elements(
      private.get_schedule_report_core(
        (select tenant_a_id from t07_context), '2026-08-20'::date, '2026-08-24'::date, null,
        '2026-08-24'::date, '2026-08-24 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
      ) -> 'by_professional'
    ) as p
    where (p ->> 'professional_id')::uuid = (select prof_arquivado_id from t07_fix)
  ),
  jsonb_build_object('is_active', 'false', 'archived', 'true', 'total', '1', 'completed', '1'),
  'profissional inativo e arquivado com Agendamento no periodo aparece marcado em by_professional'
);

select is(
  (
    select count(*)
    from jsonb_array_elements(
      private.get_schedule_report_core(
        (select tenant_a_id from t07_context), '2026-08-20'::date, '2026-08-24'::date,
        (select prof_dois_id from t07_fix), '2026-08-24'::date, '2026-08-24 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
      ) -> 'by_professional'
    )
  ),
  3::bigint,
  'p_professional_id NAO filtra by_professional (continuam os 3 profissionais com Agendamento no periodo)'
);

-- p_professional_id FILTRA status_totals: so os Agendamentos de prof_dois
-- (2 completed: manual + online).
select is(
  (
    select private.get_schedule_report_core(
      (select tenant_a_id from t07_context), '2026-08-20'::date, '2026-08-24'::date,
      (select prof_dois_id from t07_fix), '2026-08-24'::date, '2026-08-24 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'status_totals' ->> 'total'
  )::int,
  3,
  'p_professional_id filtra status_totals (so os Agendamentos do profissional pedido)'
);

-- p_professional_id FILTRA by_origin.
select is(
  (
    select count(*)
    from jsonb_array_elements(
      private.get_schedule_report_core(
        (select tenant_a_id from t07_context), '2026-08-20'::date, '2026-08-24'::date,
        (select prof_dois_id from t07_fix), '2026-08-24'::date, '2026-08-24 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
      ) -> 'by_origin'
    )
  ),
  2::bigint,
  'p_professional_id filtra by_origin (so as origens do profissional pedido: manual e online)'
);

-- p_professional_id FILTRA cancellation_reasons: prof_dois nao tem
-- cancelamento, entao os tres grupos ficam vazios. Os Agendamentos cancelados
-- desta fixture nunca tiveram canceled_by gravado (fixture anterior a spec
-- 043, mesmo caso de cancelamento sem autoria) -- caem todos em
-- 'desconhecida' (spec 044, ticket 16).
select is(
  (
    select private.get_schedule_report_core(
      (select tenant_a_id from t07_context), '2026-08-20'::date, '2026-08-24'::date,
      (select prof_dois_id from t07_fix), '2026-08-24'::date, '2026-08-24 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'cancellation_reasons'
  ),
  jsonb_build_object('shop', '[]'::jsonb, 'customer', '[]'::jsonb, 'desconhecida', '[]'::jsonb),
  'p_professional_id filtra cancellation_reasons nos tres grupos (prof_dois nao cancelou nada no periodo)'
);

-- ---------------------------------------------------------------------------
-- cancellation_reasons: normalizacao (trim+lower agrupa "  Cliente
-- Desmarcou  " e "cliente desmarcou"), vazio vira "sem motivo informado",
-- ordenado por frequencia desc. Todos sem canceled_by, entao caem em
-- 'desconhecida' (spec 044, ticket 16); shop/customer ficam vazios.
-- ---------------------------------------------------------------------------
select is(
  (
    select jsonb_agg(cr order by (cr ->> 'count')::int desc, cr ->> 'reason')
    from jsonb_array_elements(
      private.get_schedule_report_core(
        (select tenant_a_id from t07_context), '2026-08-20'::date, '2026-08-24'::date, null,
        '2026-08-24'::date, '2026-08-24 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
      ) -> 'cancellation_reasons' -> 'desconhecida'
    ) as cr
  ),
  jsonb_build_array(
    jsonb_build_object('reason', 'cliente desmarcou', 'count', 2),
    jsonb_build_object('reason', 'outro motivo', 'count', 1),
    jsonb_build_object('reason', 'sem motivo informado', 'count', 1)
  ),
  'motivos de cancelamento normalizados (trim+lower agrupa grafias diferentes do mesmo motivo), vazio vira "sem motivo informado", ordenados por frequencia, dentro do grupo desconhecida'
);

select is(
  (
    select private.get_schedule_report_core(
      (select tenant_a_id from t07_context), '2026-08-20'::date, '2026-08-24'::date, null,
      '2026-08-24'::date, '2026-08-24 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'cancellation_reasons' -> 'shop'
  ) = '[]'::jsonb
  and (
    select private.get_schedule_report_core(
      (select tenant_a_id from t07_context), '2026-08-20'::date, '2026-08-24'::date, null,
      '2026-08-24'::date, '2026-08-24 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'cancellation_reasons' -> 'customer'
  ) = '[]'::jsonb,
  true,
  'shop e customer ficam vazios quando nenhum cancelamento da fixture tem canceled_by gravado'
);

select is(
  (
    select private.get_schedule_report_core(
      (select tenant_a_id from t07_context), '2026-08-20'::date, '2026-08-24'::date, null,
      '2026-08-24'::date, '2026-08-24 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'cancellation_reasons' -> 'desconhecida'
  ) @> jsonb_build_array(jsonb_build_object('reason', 'cliente desmarcou', 'count', 2)),
  true,
  'o motivo mais frequente aparece primeiro com a contagem agrupada'
);

-- ---------------------------------------------------------------------------
-- previous_period: datas do periodo anterior de mesma extensao (5 dias:
-- 20 a 24 -> anterior e 15 a 19).
-- ---------------------------------------------------------------------------
select is(
  (
    select private.get_schedule_report_core(
      (select tenant_a_id from t07_context), '2026-08-20'::date, '2026-08-24'::date, null,
      '2026-08-24'::date, '2026-08-24 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'previous_period'
  ),
  jsonb_build_object('start', '2026-08-15'::date, 'end', '2026-08-19'::date),
  'previous_period e a janela de mesma extensao imediatamente anterior ao periodo'
);

-- O Agendamento da fronteira de fuso (2026-08-19 23:30 local) cai no
-- periodo anterior, contado em previous_status_totals.completed.
select is(
  (
    select (private.get_schedule_report_core(
      (select tenant_a_id from t07_context), '2026-08-20'::date, '2026-08-24'::date, null,
      '2026-08-24'::date, '2026-08-24 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'previous_status_totals' ->> 'completed')::int
  ),
  1,
  'previous_status_totals conta o Agendamento do periodo anterior (fronteira de fuso, dia local 19)'
);

-- ---------------------------------------------------------------------------
-- Fuso: o Agendamento as 23h30 local do dia 19 conta no dia local 19 (fora
-- do periodo 20-24), nao no dia UTC (que seria 20 as 02h30 UTC, dentro do
-- periodo se o filtro usasse UTC). Confirmado indiretamente acima
-- (status_totals do periodo NAO inclui esse Agendamento) -- teste explicito
-- a seguir usando o offset de horario para evidenciar.
-- ---------------------------------------------------------------------------
select is(
  (
    select (private.get_schedule_report_core(
      (select tenant_a_id from t07_context), '2026-08-19'::date, '2026-08-19'::date, null,
      '2026-08-24'::date, '2026-08-24 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'status_totals' ->> 'completed')::int
  ),
  1,
  'Agendamento as 23h30 local conta no dia local (19), confirmando o corte por fuso e nao por dia UTC'
);


-- ---------------------------------------------------------------------------
-- Ticket 08 da spec 038: mapa de calor (heatmap). Contexto isolado (t08_*),
-- tenant proprio, para nao interferir nos totais exatos ja fixados acima
-- (status_totals/by_origin/by_professional do ticket 07). Semana cheia
-- 2026-09-07 (segunda) a 2026-09-13 (domingo), p_today = 2026-09-13,
-- p_now = 2026-09-13 08:00:00-03 (mesmo padrao do ticket 07: inicio do dia
-- final, permitindo Agendamento "futuro" no mesmo dia).
-- Convencao de weekday testada: extract(dow), 0 = domingo .. 6 = sabado.
-- ---------------------------------------------------------------------------
create temporary table t08_context (
  tenant_h_id uuid not null,
  prof_h1_id uuid not null,
  prof_h2_id uuid not null,
  servico_h_id uuid not null
) on commit drop;

with th as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__t08_tenant_h__', '__t08_tenant_h__@teste.com', '11999990001', 'America/Sao_Paulo')
  returning id
)
insert into t08_context (tenant_h_id, prof_h1_id, prof_h2_id, servico_h_id)
select th.id, gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
from th;

insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active)
select prof_h1_id, tenant_h_id, '__t08_prof_h1__', '11999960001', 30, true from t08_context;
insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active)
select prof_h2_id, tenant_h_id, '__t08_prof_h2__', '11999960002', 30, true from t08_context;
insert into public.services (id, tenant_id, name, price, duration_minutes, category, is_active)
select servico_h_id, tenant_h_id, '__t08_servico_h__', 100, 30, 'Corte', true from t08_context;

-- Expediente aberto o dia inteiro so para permitir a insercao dos
-- Agendamentos de fixture (o trigger de validacao de horario recusa
-- horario fora do expediente configurado no momento do insert) -- igual ao
-- truque ja usado no fixture do ticket 07. O expediente REAL usado pelo
-- teste do mapa de calor e configurado depois, so para a leitura do
-- relatorio.
update public.tenants
set business_hours = jsonb_build_object(
  'segunda', jsonb_build_object('open', '00:00', 'close', '23:59', 'active', true),
  'terca', jsonb_build_object('open', '00:00', 'close', '23:59', 'active', true),
  'quarta', jsonb_build_object('open', '00:00', 'close', '23:59', 'active', true),
  'quinta', jsonb_build_object('open', '00:00', 'close', '23:59', 'active', true),
  'sexta', jsonb_build_object('open', '00:00', 'close', '23:59', 'active', true),
  'sabado', jsonb_build_object('open', '00:00', 'close', '23:59', 'active', true),
  'domingo', jsonb_build_object('open', '00:00', 'close', '23:59', 'active', true)
)
where id = (select tenant_h_id from t08_context);

-- segunda (2026-09-07) 10h completed (prof_h1) -> cell (1,10); e um
-- cancelado na mesma segunda as 11h, que NAO deve aparecer no mapa.
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason)
select gen_random_uuid(), tenant_h_id, prof_h1_id, servico_h_id,
  '2026-09-07 10:00:00-03'::timestamptz, '2026-09-07 10:30:00-03'::timestamptz, 'completed', 'pending', 'manual', null
from t08_context;
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason)
select gen_random_uuid(), tenant_h_id, prof_h1_id, servico_h_id,
  '2026-09-07 11:00:00-03'::timestamptz, '2026-09-07 11:30:00-03'::timestamptz, 'canceled', 'pending', 'manual', 'cliente desmarcou'
from t08_context;

-- terca (2026-09-08) 20h no_show (prof_h1), fora do expediente ativo
-- (09h-18h) -> amplia o mapa ate a hora 20, cell (2,20).
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason)
select gen_random_uuid(), tenant_h_id, prof_h1_id, servico_h_id,
  '2026-09-08 20:00:00-03'::timestamptz, '2026-09-08 20:30:00-03'::timestamptz, 'no_show', 'pending', 'manual', null
from t08_context;

-- quinta (2026-09-10) 12h confirmed com start_time < p_now (sem desfecho)
-- (prof_h1) -> cell (4,12). Quinta fica ausente da configuracao de
-- expediente (chave nao existe), sem efeito no teste de amplitude porque a
-- hora 12 ja cai dentro da faixa dos dias ativos.
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason)
select gen_random_uuid(), tenant_h_id, prof_h1_id, servico_h_id,
  '2026-09-10 12:00:00-03'::timestamptz, '2026-09-10 12:30:00-03'::timestamptz, 'confirmed', 'pending', 'manual', null
from t08_context;

-- sexta (2026-09-11) 14h confirmed com start_time >= p_now (futuro,
-- prof_h1) -> cell (5,14); e 15h completed (prof_h2) -> cell (5,15), usado
-- para o teste de filtro por profissional.
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason)
select gen_random_uuid(), tenant_h_id, prof_h1_id, servico_h_id,
  '2026-09-11 14:00:00-03'::timestamptz, '2026-09-11 14:30:00-03'::timestamptz, 'confirmed', 'pending', 'manual', null
from t08_context;
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason)
select gen_random_uuid(), tenant_h_id, prof_h2_id, servico_h_id,
  '2026-09-11 15:00:00-03'::timestamptz, '2026-09-11 15:30:00-03'::timestamptz, 'completed', 'pending', 'manual', null
from t08_context;

-- domingo (2026-09-13) 23h45 local, completed (prof_h1) -- fronteira de
-- fuso: em UTC isso e 2026-09-14 02:45 (segunda as 2h). Se o mapa lesse
-- UTC em vez do fuso do tenant, cairia em weekday=1 (segunda) hora=2, nao
-- weekday=0 (domingo) hora=23.
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason)
select gen_random_uuid(), tenant_h_id, prof_h1_id, servico_h_id,
  '2026-09-13 23:45:00-03'::timestamptz, '2026-09-14 00:15:00-03'::timestamptz, 'completed', 'pending', 'manual', null
from t08_context;

-- Expediente real para o teste do mapa: segunda/terca/sexta ativos
-- 09h-18h; quarta presente mas INATIVA com expediente mais largo
-- (07h-22h), para provar que um dia inativo nao amplia o mapa mesmo tendo
-- expediente configurado fora da faixa dos dias ativos; quinta ausente da
-- configuracao (mesmo efeito de inativo); sabado e domingo inativos.
update public.tenants
set business_hours = jsonb_build_object(
  'segunda', jsonb_build_object('open', '09:00', 'close', '18:00', 'active', true),
  'terca', jsonb_build_object('open', '09:00', 'close', '18:00', 'active', true),
  'quarta', jsonb_build_object('open', '07:00', 'close', '22:00', 'active', false),
  'sexta', jsonb_build_object('open', '09:00', 'close', '18:00', 'active', true),
  'sabado', jsonb_build_object('open', '09:00', 'close', '18:00', 'active', false),
  'domingo', jsonb_build_object('open', '09:00', 'close', '18:00', 'active', false)
)
where id = (select tenant_h_id from t08_context);

-- heatmap.cells exclui o cancelado (segunda 11h) e inclui completed,
-- no_show, sem desfecho e futuro -- 6 celulas, cada uma com contagem 1.
select is(
  (
    select private.get_schedule_report_core(
      (select tenant_h_id from t08_context), '2026-09-07'::date, '2026-09-13'::date, null,
      '2026-09-13'::date, '2026-09-13 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'heatmap' -> 'cells'
  ),
  jsonb_build_array(
    jsonb_build_object('weekday', 0, 'hour', 23, 'count', 1),
    jsonb_build_object('weekday', 1, 'hour', 10, 'count', 1),
    jsonb_build_object('weekday', 2, 'hour', 20, 'count', 1),
    jsonb_build_object('weekday', 4, 'hour', 12, 'count', 1),
    jsonb_build_object('weekday', 5, 'hour', 14, 'count', 1),
    jsonb_build_object('weekday', 5, 'hour', 15, 'count', 1)
  ),
  'heatmap.cells exclui o Agendamento cancelado e inclui concluido, falta, sem desfecho e futuro, um por celula'
);

-- Fuso: o Agendamento de domingo as 23h45 local cai em weekday=0 (domingo),
-- hora 23 -- nao em weekday=1 (segunda), hora 2, que seria o resultado se o
-- mapa lesse o instante em UTC.
select is(
  (
    select (private.get_schedule_report_core(
      (select tenant_h_id from t08_context), '2026-09-07'::date, '2026-09-13'::date, null,
      '2026-09-13'::date, '2026-09-13 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'heatmap' -> 'cells') @> jsonb_build_array(jsonb_build_object('weekday', 0, 'hour', 23, 'count', 1))
  ),
  true,
  'Agendamento de domingo as 23h45 local conta no dia e hora locais (domingo, 23h)'
);
select is(
  (
    select exists(
      select 1
      from jsonb_array_elements(
        private.get_schedule_report_core(
          (select tenant_h_id from t08_context), '2026-09-07'::date, '2026-09-13'::date, null,
          '2026-09-13'::date, '2026-09-13 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
        ) -> 'heatmap' -> 'cells'
      ) as c
      where (c ->> 'weekday')::int = 1 and (c ->> 'hour')::int = 2
    )
  ),
  false,
  'o mapa nao usa o dia/hora em UTC (nao existe celula segunda as 2h, que seria o corte por UTC)'
);

-- hours vai de 09h (menor abertura entre os dias ativos: segunda/terca/
-- sexta) a 23h (ampliado pelo Agendamento de domingo 23h45), sem incluir o
-- expediente do dia inativo (quarta, 07h-22h).
select is(
  (
    select private.get_schedule_report_core(
      (select tenant_h_id from t08_context), '2026-09-07'::date, '2026-09-13'::date, null,
      '2026-09-13'::date, '2026-09-13 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'heatmap' -> 'hours'
  ),
  (select jsonb_agg(h) from generate_series(9, 23) h),
  'hours cobre de 09h (abertura dos dias ativos) a 23h (ampliado por Agendamento fora do expediente), sem o expediente do dia inativo'
);
select is(
  (
    (private.get_schedule_report_core(
      (select tenant_h_id from t08_context), '2026-09-07'::date, '2026-09-13'::date, null,
      '2026-09-13'::date, '2026-09-13 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'heatmap' -> 'hours' -> 0)::int
  ),
  9,
  'dia inativo (quarta, expediente 07h-22h) nao amplia o mapa: a hora inicial continua 09h, nao 07h'
);

-- p_professional_id filtra o heatmap: so a celula do profissional pedido
-- aparece (prof_h2, sexta as 15h).
select is(
  (
    select count(*)
    from jsonb_array_elements(
      private.get_schedule_report_core(
        (select tenant_h_id from t08_context), '2026-09-07'::date, '2026-09-13'::date,
        (select prof_h2_id from t08_context), '2026-09-13'::date, '2026-09-13 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
      ) -> 'heatmap' -> 'cells'
    )
  ),
  1::bigint,
  'p_professional_id filtra o heatmap para uma unica celula do profissional pedido'
);
select is(
  (
    select private.get_schedule_report_core(
      (select tenant_h_id from t08_context), '2026-09-07'::date, '2026-09-13'::date,
      (select prof_h2_id from t08_context), '2026-09-13'::date, '2026-09-13 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'heatmap' -> 'cells'
  ),
  jsonb_build_array(jsonb_build_object('weekday', 5, 'hour', 15, 'count', 1)),
  'p_professional_id filtra o heatmap: mostra so a celula do profissional filtrado (prof_h2, sexta as 15h)'
);

-- ---------------------------------------------------------------------------
-- cancellation_reasons separado por autoria (spec 044, ticket 16): grupos
-- shop/customer/desconhecida, exclusao do texto de preenchimento do Canal do
-- Cliente do ranking (mas nao do total), filtro de profissional e isolamento
-- por barbearia. Periodo proprio (2026-09-05), fora do periodo 20-24 usado
-- acima e do 2026-09-01 usado no teste de totais zerados, para nao alterar
-- nenhuma contagem ja testada.
-- ---------------------------------------------------------------------------
create temporary table t16_fix (
  ap_shop_id uuid not null,
  ap_customer_id uuid not null,
  ap_customer_preenchido_id uuid not null,
  ap_desconhecida_id uuid not null
) on commit drop;
insert into t16_fix (ap_shop_id, ap_customer_id, ap_customer_preenchido_id, ap_desconhecida_id)
values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
grant select on t16_fix to authenticated;

insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason, canceled_by)
select ap_shop_id, (select tenant_a_id from t07_context), (select prof_um_id from t07_fix), (select servico_id from t07_fix),
  '2026-09-05 10:00:00-03'::timestamptz, '2026-09-05 10:30:00-03'::timestamptz, 'canceled', 'pending', 'manual', 'Falta de horário', 'shop'
from t16_fix;
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason, canceled_by)
select ap_customer_id, (select tenant_a_id from t07_context), (select prof_um_id from t07_fix), (select servico_id from t07_fix),
  '2026-09-05 11:00:00-03'::timestamptz, '2026-09-05 11:30:00-03'::timestamptz, 'canceled', 'pending', 'manual', 'Imprevisto', 'customer'
from t16_fix;
-- Motivo e literalmente o texto de preenchimento do Canal do Cliente
-- (MOTIVO_CANCELAMENTO_PADRAO_CLIENTE): deve desaparecer do ranking, mas
-- continuar contado em status_totals.canceled.
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason, canceled_by)
select ap_customer_preenchido_id, (select tenant_a_id from t07_context), (select prof_um_id from t07_fix), (select servico_id from t07_fix),
  '2026-09-05 12:00:00-03'::timestamptz, '2026-09-05 12:30:00-03'::timestamptz, 'canceled', 'pending', 'manual', 'Cancelado pelo cliente', 'customer'
from t16_fix;
-- canceled_by nulo: cancelamento anterior a spec 043 (ou de uma via que
-- ainda nao grava autoria) -- cai em 'desconhecida', nunca inferido pelo
-- texto do motivo.
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, cancellation_reason, canceled_by)
select ap_desconhecida_id, (select tenant_a_id from t07_context), (select prof_um_id from t07_fix), (select servico_id from t07_fix),
  '2026-09-05 13:00:00-03'::timestamptz, '2026-09-05 13:30:00-03'::timestamptz, 'canceled', 'pending', 'manual', 'Motivo antigo', null
from t16_fix;

select is(
  (
    select private.get_schedule_report_core(
      (select tenant_a_id from t07_context), '2026-09-05'::date, '2026-09-05'::date, null,
      '2026-09-05'::date, '2026-09-05 20:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'cancellation_reasons'
  ),
  jsonb_build_object(
    'shop', jsonb_build_array(jsonb_build_object('reason', 'falta de horário', 'count', 1)),
    'customer', jsonb_build_array(jsonb_build_object('reason', 'imprevisto', 'count', 1)),
    'desconhecida', jsonb_build_array(jsonb_build_object('reason', 'motivo antigo', 'count', 1))
  ),
  'cancellation_reasons separa shop/customer/desconhecida, e o texto de preenchimento do Canal do Cliente some do ranking do grupo customer'
);

select is(
  (
    select (
      private.get_schedule_report_core(
        (select tenant_a_id from t07_context), '2026-09-05'::date, '2026-09-05'::date, null,
        '2026-09-05'::date, '2026-09-05 20:00:00-03'::timestamptz, 'America/Sao_Paulo'
      ) -> 'status_totals' ->> 'canceled'
    )::int
  ),
  4,
  'o cancelamento com o texto de preenchimento continua contado em status_totals.canceled, so sai do ranking de motivos'
);

-- p_professional_id filtra os tres grupos: nenhum dos quatro cancelamentos
-- desta fixture e do prof_dois.
select is(
  (
    select private.get_schedule_report_core(
      (select tenant_a_id from t07_context), '2026-09-05'::date, '2026-09-05'::date,
      (select prof_dois_id from t07_fix), '2026-09-05'::date, '2026-09-05 20:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'cancellation_reasons'
  ),
  jsonb_build_object('shop', '[]'::jsonb, 'customer', '[]'::jsonb, 'desconhecida', '[]'::jsonb),
  'p_professional_id filtra os tres grupos de cancellation_reasons (prof_dois nao cancelou nada no periodo)'
);

-- Isolamento por barbearia: tenant_b nao tem nenhum Agendamento -- os tres
-- grupos ficam vazios mesmo no mesmo periodo em que tenant_a tem os quatro
-- cancelamentos acima.
select is(
  (
    select private.get_schedule_report_core(
      (select tenant_b_id from t07_context), '2026-09-05'::date, '2026-09-05'::date, null,
      '2026-09-05'::date, '2026-09-05 20:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'cancellation_reasons'
  ),
  jsonb_build_object('shop', '[]'::jsonb, 'customer', '[]'::jsonb, 'desconhecida', '[]'::jsonb),
  'isolamento por barbearia: tenant_b nao ve os cancelamentos de tenant_a no mesmo periodo'
);

-- ---------------------------------------------------------------------------
-- waiting_list (spec 044, ticket 17): quantos Agendamentos do periodo vieram
-- da Lista de Espera (cancelados inclusive) e, desses, quantos concluidos.
-- Periodo proprio (2026-09-06), fora dos periodos ja usados pelos tickets
-- anteriores desta spec neste arquivo.
-- ---------------------------------------------------------------------------
create temporary table t17_fix (
  ap_wl_completed_id uuid not null,
  ap_wl_canceled_id uuid not null,
  ap_wl_no_show_id uuid not null,
  ap_no_wl_completed_id uuid not null
) on commit drop;
insert into t17_fix (ap_wl_completed_id, ap_wl_canceled_id, ap_wl_no_show_id, ap_no_wl_completed_id)
values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
grant select on t17_fix to authenticated;

insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, from_waiting_list)
select ap_wl_completed_id, (select tenant_a_id from t07_context), (select prof_um_id from t07_fix), (select servico_id from t07_fix),
  '2026-09-06 10:00:00-03'::timestamptz, '2026-09-06 10:30:00-03'::timestamptz, 'completed', 'pending', 'manual', true
from t17_fix;
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, from_waiting_list)
select ap_wl_canceled_id, (select tenant_a_id from t07_context), (select prof_um_id from t07_fix), (select servico_id from t07_fix),
  '2026-09-06 11:00:00-03'::timestamptz, '2026-09-06 11:30:00-03'::timestamptz, 'canceled', 'pending', 'manual', true
from t17_fix;
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, from_waiting_list)
select ap_wl_no_show_id, (select tenant_a_id from t07_context), (select prof_um_id from t07_fix), (select servico_id from t07_fix),
  '2026-09-06 12:00:00-03'::timestamptz, '2026-09-06 12:30:00-03'::timestamptz, 'no_show', 'pending', 'manual', true
from t17_fix;
-- controle: concluido, mas SEM a marca -- nao deve entrar em waiting_list.
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, from_waiting_list)
select ap_no_wl_completed_id, (select tenant_a_id from t07_context), (select prof_um_id from t07_fix), (select servico_id from t07_fix),
  '2026-09-06 13:00:00-03'::timestamptz, '2026-09-06 13:30:00-03'::timestamptz, 'completed', 'pending', 'manual', false
from t17_fix;

select is(
  (
    select private.get_schedule_report_core(
      (select tenant_a_id from t07_context), '2026-09-06'::date, '2026-09-06'::date, null,
      '2026-09-06'::date, '2026-09-06 20:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'waiting_list'
  ),
  jsonb_build_object('total', 3, 'completed', 1),
  'waiting_list conta os 3 Agendamentos marcados (concluido, cancelado e falta), so 1 concluido; o sem marca nao entra'
);

select is(
  (
    select private.get_schedule_report_core(
      (select tenant_a_id from t07_context), '2026-09-06'::date, '2026-09-06'::date,
      (select prof_dois_id from t07_fix), '2026-09-06'::date, '2026-09-06 20:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'waiting_list'
  ),
  jsonb_build_object('total', 0, 'completed', 0),
  'p_professional_id filtra waiting_list (prof_dois nao tem Agendamento no periodo)'
);

select is(
  (
    select (o ->> 'total')::int
    from jsonb_array_elements(
      private.get_schedule_report_core(
        (select tenant_a_id from t07_context), '2026-09-06'::date, '2026-09-06'::date, null,
        '2026-09-06'::date, '2026-09-06 20:00:00-03'::timestamptz, 'America/Sao_Paulo'
      ) -> 'by_origin'
    ) as o
    where o ->> 'origin' = 'manual'
  ),
  4,
  'by_origin continua contando os 4 Agendamentos do periodo (marcados e nao marcados), sem linha nova nem numero diferente'
);

select is(
  (
    select private.get_schedule_report_core(
      (select tenant_b_id from t07_context), '2026-09-06'::date, '2026-09-06'::date, null,
      '2026-09-06'::date, '2026-09-06 20:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'waiting_list'
  ),
  jsonb_build_object('total', 0, 'completed', 0),
  'isolamento por barbearia: tenant_b nao ve os Agendamentos da Lista de Espera de tenant_a no mesmo periodo'
);

-- Periodo sem nenhum Agendamento (mesmo periodo ja usado no teste de totais
-- zerados): waiting_list mostra zero, nao vazio.
select is(
  (
    select private.get_schedule_report_core(
      (select tenant_a_id from t07_context), '2026-09-01'::date, '2026-09-01'::date, null,
      '2026-09-01'::date, '2026-09-01 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'waiting_list'
  ),
  jsonb_build_object('total', 0, 'completed', 0),
  'periodo sem Agendamento mostra waiting_list zerado, nao vazio'
);

select * from finish(true);
rollback;
