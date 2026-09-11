begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

create temporary table ticket18_context (
  user_id uuid not null,
  tenant_id uuid not null,
  service_id uuid not null,
  professional_id uuid not null,
  unavailable_comanda_id uuid not null,
  unavailable_item_id uuid not null,
  backfill_comanda_id uuid not null,
  backfill_item_id uuid not null,
  reopen_comanda_id uuid not null,
  reopen_estimated_item_id uuid not null,
  reopen_unavailable_item_id uuid not null,
  closed_session_id uuid not null,
  appointment_id uuid not null,
  appointment_start_time timestamptz not null,
  appointment_end_time timestamptz not null,
  cancel_comanda_id uuid not null,
  mismatch_comanda_id uuid not null
) on commit drop;

insert into ticket18_context
select
  u.id,
  u.tenant_id,
  s.id,
  p.id,
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  a.start_time,
  a.end_time,
  gen_random_uuid(),
  gen_random_uuid()
from public.users u
join public.services s
  on s.tenant_id = u.tenant_id
 and coalesce(s.is_active, true)
 and s.deleted_at is null
join public.professionals p
  on p.tenant_id = u.tenant_id
 and p.is_active
 and p.deleted_at is null
join lateral (
  select a.start_time, a.end_time
  from public.appointments a
  where a.tenant_id = u.tenant_id
    and a.professional_id = p.id
    and a.service_id = s.id
  order by a.start_time desc
  limit 1
) a on true
where u.is_active
  and u.role = 'gerente'
order by u.id, s.id, p.id
limit 1;
grant select on ticket18_context to authenticated;

select is((select count(*) from ticket18_context), 1::bigint, 'encontra contexto real para os testes comportamentais');

reset role;

insert into public.comandas (
  id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at
)
select unavailable_comanda_id, tenant_id, 'fechada', 40, 0, 0, timezone('utc'::text, now())
from ticket18_context;
insert into public.comanda_itens (
  id, comanda_id, tenant_id, item_type, service_id, professional_id,
  quantity, unit_price, total_price, snapshot_status, snapshot_data_quality
)
select unavailable_item_id, unavailable_comanda_id, tenant_id, 'servico', service_id, professional_id,
  2, 20, 40, 'unavailable', 'unavailable'
from ticket18_context;

select set_config('request.jwt.claim.sub', (select user_id::text from ticket18_context), false);
set local role authenticated;

select is(
  (public.get_tenant_financial_metrics(
    timezone('utc'::text, now()) - interval '1 minute',
    timezone('utc'::text, now()) + interval '1 minute',
    (select tenant_id from ticket18_context)
  )->>'services_revenue')::numeric,
  40::numeric,
  'metrica preserva a receita armazenada de item indisponivel'
);

reset role;
insert into public.comandas (
  id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at
)
select reopen_comanda_id, tenant_id, 'fechada', 30, 0, 0, timezone('utc'::text, now())
from ticket18_context;
insert into public.comanda_itens (
  id, comanda_id, tenant_id, item_type, service_id, professional_id,
  quantity, unit_price, total_price, snapshot_status, snapshot_data_quality
)
select reopen_estimated_item_id, reopen_comanda_id, tenant_id, 'servico', service_id, professional_id,
  1, 20, 20, 'estimated', 'estimated'
from ticket18_context;
insert into public.comanda_itens (
  id, comanda_id, tenant_id, item_type, service_id, professional_id,
  quantity, unit_price, total_price, snapshot_status, snapshot_data_quality
)
select reopen_unavailable_item_id, reopen_comanda_id, tenant_id, 'servico', service_id, professional_id,
  1, 10, 10, 'unavailable', 'unavailable'
from ticket18_context;
set local role authenticated;

select lives_ok(
  $$select public.reopen_comanda((select reopen_comanda_id from ticket18_context), (select tenant_id from ticket18_context))$$,
  'reabertura comportamental conclui sem estoque ou pagamento'
);
select is(
  (select count(*) from public.comanda_itens where comanda_id = (select reopen_comanda_id from ticket18_context) and snapshot_status = 'reverted'),
  2::bigint,
  'reabertura revoga snapshots estimated e unavailable'
);

reset role;
insert into public.professional_services (
  tenant_id, professional_id, service_id, custom_commission_percentage, is_enabled
)
select tenant_id, professional_id, service_id, 37, true
from ticket18_context
on conflict (tenant_id, professional_id, service_id)
do update set custom_commission_percentage = excluded.custom_commission_percentage,
              is_enabled = excluded.is_enabled;
insert into public.comandas (
  id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at
)
select backfill_comanda_id, tenant_id, 'fechada', 50, 0, 0, timezone('utc'::text, now())
from ticket18_context;
insert into public.comanda_itens (
  id, comanda_id, tenant_id, item_type, service_id, professional_id,
  quantity, unit_price, total_price
)
select backfill_item_id, backfill_comanda_id, tenant_id, 'servico', service_id, professional_id,
  1, 50, 50
from ticket18_context;
set local role authenticated;

select lives_ok(
  $$select public.backfill_financial_history((select tenant_id from ticket18_context), 500)$$,
  'backfill comportamental conclui para item reconstruivel'
);
select is(
  (select snapshot_commission_rule from public.comanda_itens where id = (select backfill_item_id from ticket18_context)),
  'professional_service',
  'backfill grava a regra de comissao efetivamente usada'
);

reset role;
insert into public.cash_sessions (
  id, tenant_id, opened_by, closed_by, opened_at, closed_at,
  initial_amount, closing_amount, expected_amount, difference_amount, status
)
select closed_session_id, tenant_id, user_id, user_id,
  timezone('utc'::text, now()) - interval '2 hours',
  timezone('utc'::text, now()) - interval '1 hour',
  0, 0, 0, 0, 'closed'
from ticket18_context;
set local role authenticated;

select throws_ok(
  $$insert into public.cash_movements (tenant_id, cash_session_id, type, amount, reason, performed_by)
    select tenant_id, closed_session_id, 'suprimento', 10, 'teste', user_id from ticket18_context$$,
  '42501',
  null,
  'policy rejeita movimentacao em caixa fechado'
);

reset role;
set local session_replication_role = replica;
insert into public.appointments (
  id, tenant_id, professional_id, service_id, status, payment_status, start_time, end_time
)
select appointment_id, tenant_id, professional_id, service_id, 'confirmed', 'pending',
  appointment_start_time,
  appointment_end_time
from ticket18_context;
insert into public.comandas (
  id, tenant_id, appointment_id, status, total_amount, discount_amount, tip_amount
)
select cancel_comanda_id, tenant_id, appointment_id, 'aberta', 0, 0, 0
from ticket18_context;
insert into public.comandas (
  id, tenant_id, status, total_amount, discount_amount, tip_amount
)
select mismatch_comanda_id, tenant_id, 'aberta', 0, 0, 0
from ticket18_context;
set local session_replication_role = origin;
set local role authenticated;

select throws_ok(
  $$select public.cancel_comanda_appointment(
    (select mismatch_comanda_id from ticket18_context),
    (select appointment_id from ticket18_context),
    (select tenant_id from ticket18_context)
  )$$,
  '22023',
  'Comanda e agendamento nao pertencem ao mesmo atendimento.',
  'cancelamento rejeita vinculo inexistente'
);

select lives_ok(
  $$select public.cancel_comanda_appointment(
    (select cancel_comanda_id from ticket18_context),
    (select appointment_id from ticket18_context),
    (select tenant_id from ticket18_context)
  )$$,
  'cancelamento transacional conclui para comanda e agendamento'
);
select is((select status from public.comandas where id = (select cancel_comanda_id from ticket18_context)), 'cancelada', 'cancelamento atualiza a comanda');
select is((select status from public.appointments where id = (select appointment_id from ticket18_context)), 'canceled', 'cancelamento atualiza o agendamento');

select * from finish();
rollback;
