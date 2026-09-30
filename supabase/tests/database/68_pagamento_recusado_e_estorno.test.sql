begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

-- Spec 052, ticket 07: pagamento recusado, bloqueio no 5o dia, estorno e contestacao.
--
-- apply_subscription_payment traduz o pagamento que o webhook buscou no Mercado Pago:
--   - mensalidade recusada: ativa (ou em teste, se for a primeira cobranca) vira "pagamento
--     recusado" e grava a data da primeira recusa uma vez so;
--   - recusa em bloqueada, cancelada ou cortesia so entra no historico (nao devolve prazo);
--   - recusa de upgrade so entra no historico (a barbearia continua no plano anterior);
--   - estorno ou contestacao bloqueia na hora (bloqueada, com o motivo), menos a cortesia; o
--     estorno de um pagamento antigo (mais de 3 dias antes do periodo atual) nao bloqueia quem ja
--     pagou o periodo em curso, e a contestacao bloqueia sempre;
--   - em teste, so a primeira cobranca automatica do cartao autorizado, perto do fim do teste,
--     vira "pagamento recusado": sem cartao autorizado (cobranca imediata depois do teste) ou com o
--     teste ainda longe de acabar, a recusa so entra no historico.
-- A rotina diaria (block_expired_subscriptions) grava o bloqueio no quinto dia da recusa.
-- O prazo de 5 dias em si esta no pgTAP 65; aqui vale o caminho completo da recusa ate o bloqueio.

insert into public.tenants(id, name, email, phone, slug, onboarding_completed)
select ('68000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       'T68 ' || n, 't68-' || n || '@test.local', '9299999' || lpad((6800 + n)::text, 4, '0'), 't68-' || n, true
from generate_series(1, 17) as n;

delete from public.tenant_subscriptions where tenant_id::text like '68000000-0000-0000-0000-0000000000%';

-- 01 ativa (recusa, retentativa, bloqueio), 02 ativa (recusa e aprovacao depois), 03 em teste
-- (primeira cobranca recusada), 04 bloqueada, 05 cancelada, 06 cortesia, 07 ativa (recusa de
-- upgrade), 08 ativa (recusa de antes do periodo pago), 09 ativa (estorno), 10 ativa (contestacao),
-- 11 cancelada com periodo pago (estorno), 12 recusada (estorno), 13 ativa (estorno de pagamento
-- antigo), 14 ativa (contestacao de pagamento antigo), 15 em teste ja vencido e sem cartao
-- autorizado (recusa da cobranca imediata), 16 em teste com cartao e com dias sobrando (recusa),
-- 17 em teste com cartao (estorno).
insert into public.tenant_subscriptions(tenant_id, plan_id, status, trial_ends_at, current_period_start, current_period_end,
                                        first_failed_at, blocked_at, blocked_reason, courtesy_ends_at, mp_subscription_id, card_brand)
select ('68000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22',
       s.status, s.trial_ends_at, s.period_start, s.period_end, s.first_failed_at, s.blocked_at, s.blocked_reason, null,
       'mp-68-' || n, s.card_brand
from (values
  (1,  'active',   null::timestamptz, '2040-04-01 12:00:00+00'::timestamptz, '2040-05-01 12:00:00+00'::timestamptz, null::timestamptz, null::timestamptz, null::text, null::text),
  (2,  'active',   null, '2040-04-01 12:00:00+00', '2040-05-01 12:00:00+00', null, null, null, null),
  (3,  'trialing', '2040-03-15 12:00:00+00', null, null, null, null, null, 'visa'),
  (4,  'blocked',  null, null, null, null, '2040-03-01 12:00:00+00', 'trial_expired', null),
  (5,  'canceled', null, '2040-04-01 12:00:00+00', '2040-05-01 12:00:00+00', null, null, null, null),
  (6,  'courtesy', null, null, null, null, null, null, null),
  (7,  'active',   null, '2040-04-01 12:00:00+00', '2040-05-01 12:00:00+00', null, null, null, null),
  (8,  'active',   null, '2040-04-01 12:00:00+00', '2040-05-01 12:00:00+00', null, null, null, null),
  (9,  'active',   null, '2040-04-01 12:00:00+00', '2040-05-01 12:00:00+00', null, null, null, null),
  (10, 'active',   null, '2040-04-01 12:00:00+00', '2040-05-01 12:00:00+00', null, null, null, null),
  (11, 'canceled', null, '2040-04-01 12:00:00+00', '2040-05-01 12:00:00+00', null, null, null, null),
  (12, 'past_due', null, '2040-04-01 12:00:00+00', '2040-05-01 12:00:00+00', '2040-04-28 12:00:00+00', null, null, null),
  (13, 'active',   null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', null, null, null, null),
  (14, 'active',   null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', null, null, null, null),
  (15, 'trialing', '2040-03-15 12:00:00+00', null, null, null, null, null, null),
  (16, 'trialing', '2040-03-25 12:00:00+00', null, null, null, null, null, 'visa'),
  (17, 'trialing', '2040-03-25 12:00:00+00', null, null, null, null, null, 'visa')
) as s(n, status, trial_ends_at, period_start, period_end, first_failed_at, blocked_at, blocked_reason, card_brand);

create function pg_temp.t(n integer) returns uuid language sql as
  $$ select ('68000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;

create function pg_temp.linha(n integer) returns text language sql as
  $$ select s.status || '|' || coalesce(s.first_failed_at::text, '-') || '|' || coalesce(s.blocked_reason, '-') || '|' || coalesce(s.current_period_end::text, '-')
     from public.tenant_subscriptions s where s.tenant_id = pg_temp.t(n) $$;

create function pg_temp.estado(n integer, p_now timestamptz) returns text language sql as
  $$ select st.access || '|' || st.reason || '|' || coalesce(st.relevant_date::text, '-')
     from private.tenant_access_state(pg_temp.t(n), p_now) st $$;

-- Recusa da mensalidade: ativa vira "pagamento recusado" -----------------------------------
select is(
  public.apply_subscription_payment(pg_temp.t(1), 'pay-1-a', 'mp-68-1', 'rejected', 89.90,
    '2040-05-01 12:00:00+00', 'recurring', 'visa', '4444'),
  'payment_failed',
  'ativa: a mensalidade recusada devolve payment_failed'
);

select is(
  pg_temp.linha(1),
  'past_due|2040-05-01 12:00:00+00|-|2040-05-01 12:00:00+00',
  'a situacao vira pagamento recusado, com a data da recusa, e o periodo pago nao muda'
);

select is(
  (select c.status || '|' || c.amount from public.billing_charges c where c.mp_payment_id = 'pay-1-a'),
  'rejected|89.90',
  'a recusa tambem entra no historico'
);

select is(
  public.apply_subscription_payment(pg_temp.t(1), 'pay-1-b', 'mp-68-1', 'rejected', 89.90,
    '2040-05-03 12:00:00+00', 'recurring', 'visa', '4444'),
  'recorded',
  'a nova tentativa recusada so entra no historico'
);

select is(
  pg_temp.linha(1),
  'past_due|2040-05-01 12:00:00+00|-|2040-05-01 12:00:00+00',
  'a data da primeira recusa nao muda com a segunda'
);

select is(
  public.apply_subscription_payment(pg_temp.t(1), 'pay-1-b', 'mp-68-1', 'rejected', 89.90,
    '2040-05-03 12:00:00+00', 'recurring', 'visa', '4444'),
  'recorded',
  'o mesmo aviso repetido tambem nao mexe na data'
);

-- Do dia da recusa ao bloqueio: o Estado de Acesso -----------------------------------------
select is(
  pg_temp.estado(1, '2040-05-01 12:00:01+00'),
  'warning|payment_failed|2040-05-06 12:00:00+00',
  'no dia da recusa: liberado com aviso, e a data relevante e a do bloqueio (5 dias depois)'
);

select is(
  pg_temp.estado(1, '2040-05-06 11:59:59+00'),
  'warning|payment_failed|2040-05-06 12:00:00+00',
  'no quarto dia: ainda liberado com aviso'
);

select is(
  pg_temp.estado(1, '2040-05-06 12:00:00+00'),
  'blocked|payment_failed|2040-05-06 12:00:00+00',
  'no quinto dia: bloqueado'
);

-- Aprovado depois da recusa: volta para ativa ----------------------------------------------
select is(
  public.apply_subscription_payment(pg_temp.t(2), 'pay-2-a', 'mp-68-2', 'rejected', 89.90,
    '2040-05-01 12:00:00+00', 'recurring', 'visa', '4444'),
  'payment_failed',
  'ativa: a recusa que vai ser regularizada'
);

select is(
  public.apply_subscription_payment(pg_temp.t(2), 'pay-2-b', 'mp-68-2', 'approved', 89.90,
    '2040-05-03 12:00:00+00', 'recurring', 'visa', '4444'),
  'activated',
  'o pagamento aprovado depois da recusa reativa a assinatura'
);

select is(
  pg_temp.linha(2),
  'active|-|-|2040-06-03 12:00:00+00',
  'volta para ativa, sem a data da recusa, e o periodo pago comeca na data do pagamento'
);

-- Primeira cobranca do teste recusada -------------------------------------------------------
select is(
  public.apply_subscription_payment(pg_temp.t(3), 'pay-3-a', 'mp-68-3', 'rejected', 89.90,
    '2040-03-15 11:00:00+00', 'recurring', null, null),
  'payment_failed',
  'em teste: a primeira cobranca recusada tambem vira pagamento recusado'
);

select is(
  pg_temp.linha(3),
  'past_due|2040-03-15 11:00:00+00|-|-',
  'a data da recusa e a da cobranca (a folga de 5 dias comeca ai, nao no fim do teste)'
);

-- Recusa que nao muda a situacao ------------------------------------------------------------
select is(
  public.apply_subscription_payment(pg_temp.t(4), 'pay-4-a', 'mp-68-4', 'rejected', 59.90,
    '2040-05-01 12:00:00+00', 'recurring', null, null),
  'recorded',
  'bloqueada: a recusa (por exemplo, no Pagar) so entra no historico'
);

select is(
  pg_temp.linha(4),
  'blocked|-|trial_expired|-',
  'bloqueada continua bloqueada, sem ganhar 5 dias de folga e sem trocar o motivo'
);

select is(
  public.apply_subscription_payment(pg_temp.t(5), 'pay-5-a', 'mp-68-5', 'rejected', 89.90,
    '2040-05-01 12:00:00+00', 'recurring', null, null) || '|' || pg_temp.linha(5),
  'recorded|canceled|-|-|2040-05-01 12:00:00+00',
  'cancelada: a recusa so entra no historico'
);

select is(
  public.apply_subscription_payment(pg_temp.t(6), 'pay-6-a', 'mp-68-6', 'rejected', 89.90,
    '2040-05-01 12:00:00+00', 'recurring', null, null) || '|' || pg_temp.linha(6),
  'recorded|courtesy|-|-|-',
  'cortesia: a recusa so entra no historico'
);

select is(
  public.apply_subscription_payment(pg_temp.t(7), 'pay-7-a', 'mp-68-7', 'rejected', 10.00,
    '2040-04-20 12:00:00+00', 'upgrade', null, null) || '|' || pg_temp.linha(7),
  'recorded|active|-|-|2040-05-01 12:00:00+00',
  'recusa da diferenca de plano: continua ativa no plano anterior'
);

select is(
  public.apply_subscription_payment(pg_temp.t(8), 'pay-8-a', 'mp-68-8', 'rejected', 89.90,
    '2040-03-20 12:00:00+00', 'recurring', null, null) || '|' || pg_temp.linha(8),
  'recorded|active|-|-|2040-05-01 12:00:00+00',
  'recusa de antes do periodo pago atual (aviso atrasado) nao derruba a assinatura'
);

-- Estorno e contestacao: bloqueio na hora ----------------------------------------------------
select is(
  public.apply_subscription_payment(pg_temp.t(9), 'pay-9-a', 'mp-68-9', 'approved', 89.90,
    '2040-05-01 12:00:00+00', 'recurring', 'visa', '4444'),
  'renewed',
  'ativa: a mensalidade aprovada renova'
);

select is(
  public.apply_subscription_payment(pg_temp.t(9), 'pay-9-a', 'mp-68-9', 'refunded', 89.90,
    '2040-05-01 12:00:00+00', 'recurring', 'visa', '4444'),
  'blocked',
  'o estorno bloqueia na hora'
);

select is(
  (select s.status || '|' || s.blocked_reason || '|' || (s.blocked_at between now() - interval '1 minute' and now() + interval '1 minute')::text
   from public.tenant_subscriptions s where s.tenant_id = pg_temp.t(9)),
  'blocked|refunded|true',
  'bloqueada com o motivo estorno e a data de agora'
);

select is(
  (select st.access || '|' || st.reason from private.tenant_access_state(pg_temp.t(9)) st),
  'blocked|refunded',
  'o Estado de Acesso e bloqueado, com o motivo estorno'
);

select is(
  (select c.status from public.billing_charges c where c.mp_payment_id = 'pay-9-a'),
  'refunded',
  'o historico mostra o pagamento como estornado'
);

select is(
  public.apply_subscription_payment(pg_temp.t(9), 'pay-9-a', 'mp-68-9', 'refunded', 89.90,
    '2040-05-01 12:00:00+00', 'recurring', 'visa', '4444'),
  'duplicate',
  'o aviso de estorno repetido e ignorado'
);

select is(
  public.apply_subscription_payment(pg_temp.t(9), 'pay-9-b', 'mp-68-9', 'approved', 89.90,
    '2040-06-10 12:00:00+00', 'recurring', 'visa', '4444'),
  'activated',
  'bloqueada por estorno: um pagamento aprovado novo libera'
);

select is(
  public.apply_subscription_payment(pg_temp.t(9), 'pay-9-a', 'mp-68-9', 'refunded', 89.90,
    '2040-05-01 12:00:00+00', 'recurring', 'visa', '4444') || '|' || pg_temp.linha(9),
  'duplicate|active|-|-|2040-07-10 12:00:00+00',
  'o aviso de estorno atrasado, repetido depois de pagar de novo, nao bloqueia outra vez'
);

select is(
  public.apply_subscription_payment(pg_temp.t(10), 'pay-10-a', 'mp-68-10', 'charged_back', 89.90,
    '2040-04-01 12:00:00+00', 'recurring', 'visa', '4444'),
  'blocked',
  'a contestacao bloqueia na hora'
);

select is(
  pg_temp.linha(10),
  'blocked|-|charged_back|2040-05-01 12:00:00+00',
  'bloqueada com o motivo contestacao'
);

select is(
  public.apply_subscription_payment(pg_temp.t(11), 'pay-11-a', 'mp-68-11', 'refunded', 89.90,
    '2040-04-01 12:00:00+00', 'recurring', 'visa', '4444') || '|' || pg_temp.linha(11),
  'blocked|blocked|-|refunded|2040-05-01 12:00:00+00',
  'cancelada com periodo pago pela frente: o estorno bloqueia na hora (o dinheiro voltou)'
);

select is(
  public.apply_subscription_payment(pg_temp.t(12), 'pay-12-a', 'mp-68-12', 'refunded', 89.90,
    '2040-04-01 12:00:00+00', 'recurring', 'visa', '4444') || '|' || pg_temp.linha(12),
  'blocked|blocked|2040-04-28 12:00:00+00|refunded|2040-05-01 12:00:00+00',
  'com pagamento recusado: o estorno bloqueia na hora e troca o motivo'
);

select is(
  public.apply_subscription_payment(pg_temp.t(4), 'pay-4-b', 'mp-68-4', 'charged_back', 59.90,
    '2040-03-01 12:00:00+00', 'recurring', null, null) || '|' || pg_temp.linha(4),
  'recorded|blocked|-|trial_expired|-',
  'ja bloqueada: a contestacao so entra no historico e o motivo original fica'
);

select is(
  public.apply_subscription_payment(pg_temp.t(6), 'pay-6-b', 'mp-68-6', 'refunded', 59.90,
    '2040-03-01 12:00:00+00', 'recurring', null, null) || '|' || pg_temp.linha(6),
  'recorded|courtesy|-|-|-',
  'cortesia (decisao do Proprietario): o estorno so entra no historico'
);

-- Limites da revisao de codigo ---------------------------------------------------------------
select is(
  public.apply_subscription_payment(pg_temp.t(13), 'pay-13-a', 'mp-68-13', 'refunded', 89.90,
    '2040-03-01 12:00:00+00', 'recurring', 'visa', '4444') || '|' || pg_temp.linha(13),
  'recorded|active|-|-|2040-06-01 12:00:00+00',
  'ativa: o estorno de um pagamento antigo (antes do periodo atual) so entra no historico'
);

select is(
  public.apply_subscription_payment(pg_temp.t(14), 'pay-14-a', 'mp-68-14', 'charged_back', 89.90,
    '2040-03-01 12:00:00+00', 'recurring', 'visa', '4444') || '|' || pg_temp.linha(14),
  'blocked|blocked|-|charged_back|2040-06-01 12:00:00+00',
  'ativa: a contestacao bloqueia mesmo sendo de um pagamento antigo'
);

select is(
  public.apply_subscription_payment(pg_temp.t(15), 'pay-15-a', 'mp-68-15', 'rejected', 89.90,
    '2040-03-15 13:00:00+00', 'recurring', null, null) || '|' || pg_temp.linha(15),
  'recorded|trialing|-|-|-',
  'teste vencido sem cartao autorizado: a recusa da cobranca imediata so entra no historico'
);

select is(
  pg_temp.estado(15, '2040-03-15 13:00:01+00'),
  'blocked|trial_expired|2040-03-15 12:00:00+00',
  'e a barbearia continua bloqueada por teste vencido, sem os 5 dias da recusa'
);

select is(
  public.apply_subscription_payment(pg_temp.t(16), 'pay-16-a', 'mp-68-16', 'rejected', 89.90,
    '2040-03-15 11:00:00+00', 'recurring', null, null) || '|' || pg_temp.linha(16),
  'recorded|trialing|-|-|-',
  'em teste com cartao mas com dias sobrando: a recusa so entra no historico'
);

select is(
  public.apply_subscription_payment(pg_temp.t(17), 'pay-17-a', 'mp-68-17', 'refunded', 89.90,
    '2040-03-10 12:00:00+00', 'recurring', 'visa', '4444') || '|' || pg_temp.linha(17),
  'blocked|blocked|-|refunded|-',
  'em teste: o estorno bloqueia na hora'
);

-- A rotina diaria roda para todas as barbearias, e em 2040 vence o teste e o periodo de varias das
-- de cima: por isso fica por ultimo. A barbearia 01 e a da recusa do inicio do arquivo.
-- Do dia da recusa ao bloqueio (rotina diaria) ---------------------------------------------
select private.block_expired_subscriptions('2040-05-06 11:59:59+00');

select is(
  (select s.status from public.tenant_subscriptions s where s.tenant_id = pg_temp.t(1)),
  'past_due',
  'a rotina diaria nao bloqueia antes do quinto dia'
);

select private.block_expired_subscriptions('2040-05-06 12:00:00+00');

select is(
  (select s.status || '|' || s.blocked_at::text || '|' || s.blocked_reason from public.tenant_subscriptions s where s.tenant_id = pg_temp.t(1)),
  'blocked|2040-05-06 12:00:00+00|payment_failed',
  'a rotina diaria bloqueia no quinto dia e grava a data do bloqueio'
);

select * from finish();
rollback;
