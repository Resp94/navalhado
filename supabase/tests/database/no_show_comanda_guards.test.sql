begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into public.tenants(
  id, name, email, phone, slug, business_hours, timezone,
  slot_interval_minutes, min_booking_lead_time_minutes, onboarding_completed
)
values(
  '82100000-0000-0000-0000-000000000001',
  'No-show guards',
  'no-show-guards@test.local',
  '92999990821',
  'no-show-guards-test',
  '{"segunda":{"active":true,"open":"08:00","close":"20:00"}}'::jsonb,
  'America/Manaus',
  30,
  0,
  true
);

insert into public.services(
  id, tenant_id, name, price, duration_minutes, category, is_active, display_order
)
values(
  '82100000-0000-0000-0000-000000000011',
  '82100000-0000-0000-0000-000000000001',
  'Serviço no-show',
  40,
  30,
  'Cabelo',
  true,
  1
);

insert into public.professionals(
  id, tenant_id, name, phone, commission_percentage, is_active, weekly_schedule
)
values(
  '82100000-0000-0000-0000-000000000021',
  '82100000-0000-0000-0000-000000000001',
  'Profissional no-show',
  '92999990822',
  0,
  true,
  '{}'::jsonb
);

insert into public.appointments(
  id, tenant_id, professional_id, service_id, start_time, end_time,
  status, payment_status, origin, is_fitting
)
values(
  '82100000-0000-0000-0000-000000000031',
  '82100000-0000-0000-0000-000000000001',
  '82100000-0000-0000-0000-000000000021',
  '82100000-0000-0000-0000-000000000011',
  '2040-01-02 10:00:00-04',
  '2040-01-02 10:30:00-04',
  'confirmed',
  'pending',
  'manual',
  true
);

select ok(
  exists(
    select 1 from pg_trigger
    where tgname = 'trg_auto_cancel_comanda_on_appointment_cancel'
      and tgrelid = 'public.appointments'::regclass
  ),
  'o gatilho de cancelamento de comanda continua instalado'
);

update public.appointments
set status = 'no_show'
where id = '82100000-0000-0000-0000-000000000031';

select is(
  (select status from public.comandas where appointment_id = '82100000-0000-0000-0000-000000000031'),
  'cancelada',
  'no-show cancela somente a comanda aberta vinculada'
);

update public.comandas
set status = 'aberta'
where appointment_id = '82100000-0000-0000-0000-000000000031';

select throws_ok(
  $$update public.comandas
    set status = 'fechada'
    where appointment_id = '82100000-0000-0000-0000-000000000031'$$,
  '23514',
  'Não é permitido fechar comanda de atendimento no_show.',
  'comanda de no-show não pode ser fechada'
);

select throws_ok(
  $$insert into public.comanda_pagamentos(
      comanda_id, tenant_id, payment_method, amount, change_amount, paid_at
    )
    select id, tenant_id, 'pix', 40, 0, pg_catalog.now()
    from public.comandas
    where appointment_id = '82100000-0000-0000-0000-000000000031'$$,
  '23514',
  'Não é permitido registrar pagamento para atendimento no_show.',
  'comanda de no-show não aceita novo pagamento'
);

insert into public.appointments(
  id, tenant_id, professional_id, service_id, start_time, end_time,
  status, payment_status, origin, is_fitting
)
values(
  '82100000-0000-0000-0000-000000000032',
  '82100000-0000-0000-0000-000000000001',
  '82100000-0000-0000-0000-000000000021',
  '82100000-0000-0000-0000-000000000011',
  '2040-01-02 11:00:00-04',
  '2040-01-02 11:30:00-04',
  'confirmed',
  'pending',
  'manual',
  true
);

update public.comandas
set status = 'fechada'
where appointment_id = '82100000-0000-0000-0000-000000000032';

update public.appointments
set status = 'no_show'
where id = '82100000-0000-0000-0000-000000000032';

select is(
  (select status from public.comandas where appointment_id = '82100000-0000-0000-0000-000000000032'),
  'fechada',
  'no-show não altera uma comanda que já estava fechada'
);

select has_function(
  'private',
  'prevent_payment_for_ineligible_appointment',
  'a proteção de pagamento está isolada no schema privado'
);

select * from finish();
rollback;
