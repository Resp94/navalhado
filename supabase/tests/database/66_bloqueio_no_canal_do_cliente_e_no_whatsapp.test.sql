begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

-- Spec 052, ticket 04: bloqueio no Canal do Cliente e no WhatsApp.
--
-- Barbearia bloqueada: o cliente nao cria nem reagenda pelo Canal do Cliente (recusa
-- ONLINE_BOOKING_UNAVAILABLE, SQLSTATE 55000) e continua conseguindo ver e cancelar os
-- proprios agendamentos, para liberar o horario. Barbearia liberada: tudo segue como antes.
-- As funcoes do servidor (WhatsApp) leem o Estado de Acesso por get_tenant_access_state,
-- so executavel pelo service_role, e o envio descartado por bloqueio fica registrado com o
-- status discarded no livro de idempotencia e na fila.
-- Nenhuma barbearia de teste tem instancia de WhatsApp: nada sai pelo provedor.

insert into public.tenants(id, name, email, phone, slug, business_hours, timezone, slot_interval_minutes, min_booking_lead_time_minutes, onboarding_completed)
values
  ('66000000-0000-0000-0000-000000000001', 'T66 Liberada', 't66-liberada@test.local', '92999990601', 't66-liberada',
   '{"monday":{"active":true,"start":"09:00","end":"17:00"}}'::jsonb, 'America/Manaus', 30, 0, true),
  ('66000000-0000-0000-0000-000000000002', 'T66 Bloqueada', 't66-bloqueada@test.local', '92999990602', 't66-bloqueada',
   '{"monday":{"active":true,"start":"09:00","end":"17:00"}}'::jsonb, 'America/Manaus', 30, 0, true);

insert into public.tenant_subscriptions(tenant_id, plan_id, status, current_period_end)
values ('66000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', now() + interval '20 days');

insert into public.tenant_subscriptions(tenant_id, plan_id, status, blocked_at, blocked_reason)
values ('66000000-0000-0000-0000-000000000002', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', now() - interval '1 day', 'trial_expired');

insert into public.services(id, tenant_id, name, price, duration_minutes, category, is_active, display_order)
values
  ('66000000-0000-0000-0000-000000000011', '66000000-0000-0000-0000-000000000001', 'Corte T66', 40, 60, 'Cabelo', true, 1),
  ('66000000-0000-0000-0000-000000000012', '66000000-0000-0000-0000-000000000002', 'Corte T66', 40, 60, 'Cabelo', true, 1);

insert into public.professionals(id, tenant_id, name, phone, commission_percentage, is_active, weekly_schedule)
values
  ('66000000-0000-0000-0000-000000000021', '66000000-0000-0000-0000-000000000001', 'Profissional T66 A', '92999990603', 0, true,
   '{"monday":{"start":"09:00","end":"17:00"}}'::jsonb),
  ('66000000-0000-0000-0000-000000000022', '66000000-0000-0000-0000-000000000002', 'Profissional T66 B', '92999990604', 0, true,
   '{"monday":{"start":"09:00","end":"17:00"}}'::jsonb);

insert into public.professional_services(tenant_id, professional_id, service_id, is_enabled, custom_duration_minutes)
values
  ('66000000-0000-0000-0000-000000000001', '66000000-0000-0000-0000-000000000021', '66000000-0000-0000-0000-000000000011', true, 60),
  ('66000000-0000-0000-0000-000000000002', '66000000-0000-0000-0000-000000000022', '66000000-0000-0000-0000-000000000012', true, 60);

-- Cliente e agendamento futuro da barbearia bloqueada, criados antes do bloqueio valer.
insert into public.customers(id, tenant_id, name, phone, cadastro_completo, registration_origin)
values ('66000000-0000-0000-0000-000000000031', '66000000-0000-0000-0000-000000000002', 'Cliente Bloqueado',
        private.normalize_br_phone('92999990605'), true, 'canal_cliente');

insert into public.appointments(id, tenant_id, customer_id, professional_id, service_id, start_time, end_time, status, payment_status, origin)
values ('66000000-0000-0000-0000-000000000041', '66000000-0000-0000-0000-000000000002', '66000000-0000-0000-0000-000000000031',
        '66000000-0000-0000-0000-000000000022', '66000000-0000-0000-0000-000000000012',
        '2040-01-02 13:00:00+00', '2040-01-02 14:00:00+00', 'confirmed', 'pending', 'online');

-- Canal do Cliente: barbearia bloqueada -------------------------------------
select throws_ok(
  $$select * from public.confirm_public_booking('t66-bloqueada', '66000000-0000-0000-0000-000000000012', '66000000-0000-0000-0000-000000000022',
      '2040-01-02', '11:00', 'Pessoa Nova', '92999990606', null)$$,
  '55000', null,
  'bloqueada: criar pelo Canal do Cliente e recusado'
);

select throws_like(
  $$select * from public.confirm_public_booking('t66-bloqueada', '66000000-0000-0000-0000-000000000012', '66000000-0000-0000-0000-000000000022',
      '2040-01-02', '11:00', 'Pessoa Nova', '92999990606', null)$$,
  'ONLINE_BOOKING_UNAVAILABLE%',
  'bloqueada: a recusa traz o codigo ONLINE_BOOKING_UNAVAILABLE para o front reconhecer'
);

select is(
  (select count(*)::integer from public.customers
   where tenant_id = '66000000-0000-0000-0000-000000000002' and telefone_normalizado = private.normalize_br_phone('92999990606')),
  0,
  'bloqueada: a recusa nao deixa cliente novo cadastrado'
);

select throws_ok(
  $$select public.create_appointment_by_token(
      (select token_acesso from public.customers where id = '66000000-0000-0000-0000-000000000031'),
      '66000000-0000-0000-0000-000000000012', '66000000-0000-0000-0000-000000000022', '2040-01-02', '11:00')$$,
  '55000', null,
  'bloqueada: criar com o token do cliente existente e recusado'
);

select throws_ok(
  $$select public.reschedule_appointment_by_token(
      (select token_acesso from public.customers where id = '66000000-0000-0000-0000-000000000031'),
      '66000000-0000-0000-0000-000000000041', '66000000-0000-0000-0000-000000000012', '66000000-0000-0000-0000-000000000022',
      '2040-01-02', '11:00')$$,
  '55000', null,
  'bloqueada: reagendar e recusado'
);

select is(
  (select start_time from public.appointments where id = '66000000-0000-0000-0000-000000000041'),
  '2040-01-02 13:00:00+00'::timestamptz,
  'bloqueada: o reagendamento recusado nao muda o horario'
);

select is(
  (select count(*)::integer from public.get_customer_appointments_by_token(
    (select token_acesso from public.customers where id = '66000000-0000-0000-0000-000000000031'))),
  1,
  'bloqueada: o cliente continua vendo os proprios agendamentos'
);

select lives_ok(
  $$select public.cancel_appointment_by_token(
      (select token_acesso from public.customers where id = '66000000-0000-0000-0000-000000000031'),
      '66000000-0000-0000-0000-000000000041', 'Cancelado pelo cliente')$$,
  'bloqueada: cancelar continua permitido'
);

select is(
  (select status from public.appointments where id = '66000000-0000-0000-0000-000000000041'),
  'canceled',
  'bloqueada: o cancelamento libera o horario'
);

-- Canal do Cliente: barbearia liberada, tudo como antes -----------------------
select is(
  (select customer_name from public.confirm_public_booking('t66-liberada', '66000000-0000-0000-0000-000000000011', '66000000-0000-0000-0000-000000000021',
      '2040-01-02', '09:00', 'Maria Liberada', '92999990607', null)),
  'Maria Liberada'::text,
  'liberada: criar pelo Canal do Cliente funciona como antes'
);

select lives_ok(
  $$select public.reschedule_appointment_by_token(
      (select c.token_acesso from public.customers c where c.tenant_id = '66000000-0000-0000-0000-000000000001'),
      (select a.id from public.appointments a where a.tenant_id = '66000000-0000-0000-0000-000000000001'),
      '66000000-0000-0000-0000-000000000011', '66000000-0000-0000-0000-000000000021', '2040-01-02', '11:00')$$,
  'liberada: reagendar funciona como antes'
);

select lives_ok(
  $$select public.cancel_appointment_by_token(
      (select c.token_acesso from public.customers c where c.tenant_id = '66000000-0000-0000-0000-000000000001'),
      (select a.id from public.appointments a where a.tenant_id = '66000000-0000-0000-0000-000000000001'),
      'Cancelado pelo cliente')$$,
  'liberada: cancelar funciona como antes'
);

-- Sessao publica do cliente (o caminho do menu): a guarda vale tambem por ela, e cancelar continua.
insert into auth.users(id, email) values (gen_random_uuid(), '__t66_ses__@teste.com');
insert into public.public_customer_sessions(auth_user_id, tenant_id, customer_id)
values ((select id from auth.users where email = '__t66_ses__@teste.com'),
        '66000000-0000-0000-0000-000000000002', '66000000-0000-0000-0000-000000000031');

insert into public.appointments(id, tenant_id, customer_id, professional_id, service_id, start_time, end_time, status, payment_status, origin)
values ('66000000-0000-0000-0000-000000000042', '66000000-0000-0000-0000-000000000002', '66000000-0000-0000-0000-000000000031',
        '66000000-0000-0000-0000-000000000022', '66000000-0000-0000-0000-000000000012',
        '2040-01-02 15:00:00+00', '2040-01-02 16:00:00+00', 'confirmed', 'pending', 'online');

select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = '__t66_ses__@teste.com'), true);
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = '__t66_ses__@teste.com'), 'role', 'authenticated', 'is_anonymous', true)::text, true);
set local role authenticated;

select throws_ok(
  $$select public.reschedule_appointment_by_public_session(
      '66000000-0000-0000-0000-000000000042', '66000000-0000-0000-0000-000000000012', '66000000-0000-0000-0000-000000000022',
      '2040-01-02', '11:00')$$,
  '55000', null,
  'bloqueada: reagendar pela sessao publica e recusado'
);

select lives_ok(
  $$select public.cancel_appointment_by_public_session('66000000-0000-0000-0000-000000000042', 'Cancelado pelo cliente')$$,
  'bloqueada: cancelar pela sessao publica continua funcionando'
);

reset role;
select set_config('request.jwt.claims', '', true);

-- Disponibilidade para a tela do cliente -------------------------------------
select is(public.get_public_booking_availability('t66-bloqueada'), false,
  'a tela do cliente descobre que o agendamento online esta indisponivel');
select is(public.get_public_booking_availability('t66-liberada'), true,
  'barbearia liberada aparece como disponivel');
select is(public.get_public_booking_availability('  T66-Liberada '), true,
  'o slug e comparado sem diferenciar maiusculas e sem espacos, como nas outras funcoes publicas');
select is(public.get_public_booking_availability('t66-nao-existe'), null,
  'slug que nao existe nao vira "indisponivel": devolve nulo e o fluxo normal trata o erro');

select ok(
  has_function_privilege('anon', 'public.get_public_booking_availability(text)', 'execute')
  and has_function_privilege('authenticated', 'public.get_public_booking_availability(text)', 'execute'),
  'a disponibilidade e publica: o cliente ainda nao tem login'
);

select ok(
  not has_function_privilege('anon', 'private.assert_online_booking_allowed(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.assert_online_booking_allowed(uuid)', 'execute'),
  'a guarda do Canal do Cliente nao e executavel por anon nem por authenticated'
);

-- Estado de Acesso para as funcoes do servidor --------------------------------
select is(
  (select e.access || '|' || e.reason from public.get_tenant_access_state('66000000-0000-0000-0000-000000000002') e),
  'blocked|trial_expired',
  'o servidor le o Estado de Acesso da barbearia bloqueada, com o motivo'
);

select ok(
  has_function_privilege('service_role', 'public.get_tenant_access_state(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.get_tenant_access_state(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.get_tenant_access_state(uuid)', 'execute'),
  'get_tenant_access_state so e executavel pelo service_role'
);

insert into auth.users(id, email)
select gen_random_uuid(), '__t66_' || n || '__@teste.com' from unnest(array['ger', 'gernulo']) as n;

update public.users set tenant_id = '66000000-0000-0000-0000-000000000002', role = 'gerente', is_active = true
  where email = '__t66_ger__@teste.com';
update public.users set tenant_id = null, role = 'gerente', is_active = true
  where email = '__t66_gernulo__@teste.com';

select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = '__t66_ger__@teste.com'), true);
set local role authenticated;

select throws_ok(
  $$select * from public.get_tenant_access_state('66000000-0000-0000-0000-000000000002')$$,
  '42501', null,
  'o Gerente da propria barbearia nao le o estado por essa funcao (ele usa get_my_access_state)'
);

reset role;
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = '__t66_gernulo__@teste.com'), true);
set local role authenticated;

select throws_ok(
  $$select * from public.get_tenant_access_state('66000000-0000-0000-0000-000000000002')$$,
  '42501', null,
  'o Gerente com tenant_id nulo tambem e barrado'
);

reset role;

-- Envio descartado: livro de idempotencia e fila -------------------------------
select lives_ok(
  $$insert into public.whatsapp_message_idempotency(tenant_id, direction, event_type, idempotency_key, status, attempt_count, last_error, completed_at)
    values ('66000000-0000-0000-0000-000000000002', 'outbound', 'appointment_created', 'appointment:t66:appointment_created',
            'discarded', 0, 'tenant_blocked:trial_expired', now())$$,
  'o livro de idempotencia aceita o status discarded, com o motivo'
);

select throws_ok(
  $$insert into public.whatsapp_message_idempotency(tenant_id, direction, event_type, idempotency_key, status)
    values ('66000000-0000-0000-0000-000000000002', 'outbound', 'appointment_created', 'appointment:t66:outro', 'talvez')$$,
  '23514', null,
  'o livro continua recusando status desconhecido'
);

insert into public.whatsapp_message_outbox(id, tenant_id, event_type, idempotency_key, payload, status, attempt_count, lease_until)
values
  ('66000000-0000-0000-0000-000000000051', '66000000-0000-0000-0000-000000000002', 'appointment_created', 'appointment:t66:fila-1',
   '{"event":"appointment_created"}'::jsonb, 'processing', 1, now() + interval '2 minutes'),
  ('66000000-0000-0000-0000-000000000052', '66000000-0000-0000-0000-000000000002', 'appointment_created', 'appointment:t66:fila-2',
   '{"event":"appointment_created"}'::jsonb, 'queued', 0, null);

select is(
  public.discard_whatsapp_message_outbox('66000000-0000-0000-0000-000000000051', 'tenant_blocked:trial_expired'),
  true,
  'a fila descarta um item em processamento'
);

select is(
  (select status || '|' || last_error || '|' || (processed_at is not null)::text || '|' || (lease_until is null)::text
   from public.whatsapp_message_outbox where id = '66000000-0000-0000-0000-000000000051'),
  'discarded|tenant_blocked:trial_expired|true|true',
  'o item descartado guarda o motivo, a hora e solta a reserva'
);

select is(
  public.discard_whatsapp_message_outbox('66000000-0000-0000-0000-000000000052', 'tenant_blocked:trial_expired'),
  false,
  'a fila nao descarta um item que ninguem reservou'
);

select is(
  (select count(*)::integer from public.claim_whatsapp_message_outbox(100)
   where id = '66000000-0000-0000-0000-000000000051'),
  0,
  'um item descartado nunca volta para a fila'
);

select ok(
  has_function_privilege('service_role', 'public.discard_whatsapp_message_outbox(uuid,text)', 'execute')
  and not has_function_privilege('anon', 'public.discard_whatsapp_message_outbox(uuid,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.discard_whatsapp_message_outbox(uuid,text)', 'execute'),
  'descartar item da fila so e executavel pelo service_role'
);

-- Descarte no livro de idempotencia: register_whatsapp_message_discard ----------------
select lives_ok(
  $$select public.register_whatsapp_message_discard('66000000-0000-0000-0000-000000000002', null, 'outbound', 'appointment_reminder',
      'appointment:t66:lembrete-novo', '66000000-0000-0000-0000-000000000041', '2h', 'tenant_blocked:trial_expired')$$,
  'o descarte cria a linha quando a chave ainda nao existe'
);

select is(
  (select status || '|' || attempt_count || '|' || last_error || '|' || (completed_at is not null)::text
   from public.whatsapp_message_idempotency where idempotency_key = 'appointment:t66:lembrete-novo'),
  'discarded|0|tenant_blocked:trial_expired|true',
  'a linha descartada guarda o motivo, tentativas zeradas e a hora'
);

select lives_ok(
  $$select public.register_whatsapp_message_discard('66000000-0000-0000-0000-000000000002', null, 'outbound', 'appointment_reminder',
      'appointment:t66:lembrete-novo', '66000000-0000-0000-0000-000000000041', '2h', 'tenant_blocked:payment_failed')$$,
  'descartar de novo a mesma chave nao da erro (a barbearia bloqueada e reexaminada a cada rodada)'
);

insert into public.whatsapp_message_idempotency(tenant_id, direction, event_type, idempotency_key, status, attempt_count, last_error)
values
  ('66000000-0000-0000-0000-000000000002', 'outbound', 'appointment_created', 'appointment:t66:falhou', 'failed', 1, 'provider timeout'),
  ('66000000-0000-0000-0000-000000000002', 'outbound', 'appointment_created', 'appointment:t66:enviado', 'succeeded', 1, null),
  ('66000000-0000-0000-0000-000000000002', 'outbound', 'appointment_created', 'appointment:t66:permanente', 'failed', 1, 'permanent provider error: numero invalido');

select public.register_whatsapp_message_discard('66000000-0000-0000-0000-000000000002', null, 'outbound', 'appointment_created', 'appointment:t66:falhou', null, null, 'tenant_blocked:trial_expired');
select public.register_whatsapp_message_discard('66000000-0000-0000-0000-000000000002', null, 'outbound', 'appointment_created', 'appointment:t66:enviado', null, null, 'tenant_blocked:trial_expired');
select public.register_whatsapp_message_discard('66000000-0000-0000-0000-000000000002', null, 'outbound', 'appointment_created', 'appointment:t66:permanente', null, null, 'tenant_blocked:trial_expired');

select is(
  (select status || '|' || last_error from public.whatsapp_message_idempotency where idempotency_key = 'appointment:t66:falhou'),
  'discarded|tenant_blocked:trial_expired',
  'uma chave que ficou failed (retentavel) vira discarded: nao volta a ser reclamada depois do desbloqueio'
);

select is(
  (select status from public.whatsapp_message_idempotency where idempotency_key = 'appointment:t66:enviado'),
  'succeeded',
  'uma mensagem enviada antes do bloqueio continua succeeded'
);

select is(
  (select status || '|' || last_error from public.whatsapp_message_idempotency where idempotency_key = 'appointment:t66:permanente'),
  'failed|permanent provider error: numero invalido',
  'a falha permanente do provedor continua registrada como estava'
);

select lives_ok(
  $$select public.register_whatsapp_message_discard('66000000-0000-0000-0000-000000000002', null, 'outbound', 'appointment_reminder',
      'appointment:t66:outra-chave-mesma-janela', '66000000-0000-0000-0000-000000000041', '2h', 'tenant_blocked:trial_expired')$$,
  'o descarte tambem nao da erro quando outro indice unico do livro (mesma janela de lembrete) ja tem a linha'
);

select ok(
  has_function_privilege('service_role', 'public.register_whatsapp_message_discard(uuid,uuid,text,text,text,uuid,text,text)', 'execute')
  and not has_function_privilege('anon', 'public.register_whatsapp_message_discard(uuid,uuid,text,text,text,uuid,text,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.register_whatsapp_message_discard(uuid,uuid,text,text,text,uuid,text,text)', 'execute'),
  'registrar descarte no livro so e executavel pelo service_role'
);

select * from finish();
rollback;
