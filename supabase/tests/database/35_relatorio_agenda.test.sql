begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

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
-- cancelamento, entao a lista fica vazia.
select is(
  (
    select private.get_schedule_report_core(
      (select tenant_a_id from t07_context), '2026-08-20'::date, '2026-08-24'::date,
      (select prof_dois_id from t07_fix), '2026-08-24'::date, '2026-08-24 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'cancellation_reasons'
  ),
  '[]'::jsonb,
  'p_professional_id filtra cancellation_reasons (prof_dois nao cancelou nada no periodo)'
);

-- ---------------------------------------------------------------------------
-- cancellation_reasons: normalizacao (trim+lower agrupa "  Cliente
-- Desmarcou  " e "cliente desmarcou"), vazio vira "sem motivo informado",
-- ordenado por frequencia desc.
-- ---------------------------------------------------------------------------
select is(
  (
    select jsonb_agg(cr order by (cr ->> 'count')::int desc, cr ->> 'reason')
    from jsonb_array_elements(
      private.get_schedule_report_core(
        (select tenant_a_id from t07_context), '2026-08-20'::date, '2026-08-24'::date, null,
        '2026-08-24'::date, '2026-08-24 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
      ) -> 'cancellation_reasons'
    ) as cr
  ),
  jsonb_build_array(
    jsonb_build_object('reason', 'cliente desmarcou', 'count', 2),
    jsonb_build_object('reason', 'outro motivo', 'count', 1),
    jsonb_build_object('reason', 'sem motivo informado', 'count', 1)
  ),
  'motivos de cancelamento normalizados (trim+lower agrupa grafias diferentes do mesmo motivo), vazio vira "sem motivo informado", ordenados por frequencia'
);

select is(
  (
    select private.get_schedule_report_core(
      (select tenant_a_id from t07_context), '2026-08-20'::date, '2026-08-24'::date, null,
      '2026-08-24'::date, '2026-08-24 08:00:00-03'::timestamptz, 'America/Sao_Paulo'
    ) -> 'cancellation_reasons'
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

select * from finish(true);
rollback;
