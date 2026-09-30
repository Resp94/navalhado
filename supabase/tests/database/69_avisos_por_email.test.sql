begin;
create extension if not exists pgtap with schema extensions;
select plan(52);

-- Spec 052, ticket 08: avisos por e-mail da assinatura.
--
-- O banco decide quem recebe cada aviso e quando; a Edge Function send-billing-email so
-- renderiza e envia. billing_notices e a fila e o registro: uma linha por tenant, tipo e evento
-- (fim do teste, primeira recusa ou bloqueio), com chave unica, entao o mesmo aviso nunca sai
-- duas vezes.
--   - dia da recusa e bloqueio por estorno ou contestacao: gravados na hora por
--     apply_subscription_payment;
--   - fim do teste (3 dias antes), 3o e 4o dia da recusa e bloqueio por tempo: gravados por
--     private.enqueue_billing_notices, que roda todo dia, no dia local da barbearia;
--   - claim_billing_notices entrega os pendentes ja com os dados do e-mail e descarta o que
--     deixou de valer (a barbearia pagou entre a fila e o envio).

insert into public.tenants(id, name, email, phone, slug, onboarding_completed, timezone)
select ('69000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       'T69 ' || n, 't69-' || n || '@test.local', '9299999' || lpad((6900 + n)::text, 4, '0'), 't69-' || n, true,
       case when n in (8, 9) then 'America/Manaus' when n = 22 then 'Brasil/Manaus' else 'America/Sao_Paulo' end
from generate_series(1, 22) as n;

delete from public.tenant_subscriptions where tenant_id::text like '69000000-0000-0000-0000-0000000000%';

-- 01 teste (fim 10/06, Brasilia), 02 recusada em 01/06, 03 bloqueada por tempo em 05/06, 04
-- bloqueada antiga (20/05), 05 ativa, 06 cortesia, 07 cancelada, 08 recusada em Manaus, 09 teste
-- em Manaus, 10 ativa (recusa, retentativa, aprovacao e nova recusa), 11 ativa (estorno), 12 ativa
-- (estorno antigo), 13 teste sem cartao (recusa), 14 recusada (paga antes do envio), 15 teste
-- longe do fim, 16 recusada (dados do e-mail), 17 recusada (tentativas), 18 bloqueada por
-- estorno, 19 recusada sem Gerente, 20 recusada (finish), 21 bloqueada a mao pelo Proprietario (sem
-- motivo), 22 teste com o fuso gravado errado ("Brasil/Manaus").
insert into public.tenant_subscriptions(tenant_id, plan_id, status, trial_ends_at, current_period_start, current_period_end,
                                        first_failed_at, blocked_at, blocked_reason, card_brand, mp_subscription_id)
select ('69000000-0000-0000-0000-0000000000' || lpad(s.n::text, 2, '0'))::uuid,
       s.plan_id, s.status, s.trial_ends_at, s.period_start, s.period_end, s.first_failed_at, s.blocked_at, s.blocked_reason, s.card_brand,
       'mp-69-' || s.n
from (values
  (1,  'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11'::uuid, 'trialing', '2040-06-10 15:00:00+00'::timestamptz, null::timestamptz, null::timestamptz, null::timestamptz, null::timestamptz, null::text, null::text),
  (2,  'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'past_due', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', '2040-06-01 15:00:00+00', null, null, null),
  (3,  'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'blocked', null, null, null, '2040-06-01 15:00:00+00', '2040-06-05 06:05:00+00', 'payment_failed', null),
  (4,  'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'blocked', null, null, null, null, '2040-05-20 06:05:00+00', 'trial_expired', null),
  (5,  'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'active', null, '2040-06-01 12:00:00+00', '2040-07-01 12:00:00+00', null, null, null, 'visa'),
  (6,  'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'courtesy', null, null, null, null, null, null, null),
  (7,  'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'canceled', null, '2040-05-01 12:00:00+00', '2040-06-08 12:00:00+00', null, null, null, 'visa'),
  (8,  'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'past_due', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', '2040-06-01 03:30:00+00', null, null, null),
  (9,  'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'trialing', '2040-06-10 03:30:00+00', null, null, null, null, null, null),
  (10, 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', null, '2040-04-01 12:00:00+00', '2040-05-01 12:00:00+00', null, null, null, 'visa'),
  (11, 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', null, '2040-04-01 12:00:00+00', '2040-05-01 12:00:00+00', null, null, null, 'visa'),
  (12, 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', null, null, null, 'visa'),
  (13, 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'trialing', '2040-03-15 12:00:00+00', null, null, null, null, null, null),
  (14, 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'past_due', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', '2040-05-20 15:00:00+00', null, null, null),
  (15, 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'trialing', '2040-06-20 15:00:00+00', null, null, null, null, null, 'visa'),
  (16, 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'past_due', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', '2040-05-20 15:00:00+00', null, null, null),
  (17, 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'past_due', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', '2040-05-20 15:00:00+00', null, null, null),
  (18, 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'blocked', null, null, null, null, '2040-05-25 06:05:00+00', 'refunded', null),
  (19, 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'past_due', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', '2040-05-20 15:00:00+00', null, null, null),
  (20, 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'past_due', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', '2040-05-20 15:00:00+00', null, null, null),
  (21, 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'blocked', null, null, null, null, '2040-06-04 06:05:00+00', null, null),
  (22, 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'trialing', '2040-06-12 15:00:00+00', null, null, null, null, null, null)
) as s(n, plan_id, status, trial_ends_at, period_start, period_end, first_failed_at, blocked_at, blocked_reason, card_brand);

-- Gerentes: 16 tem dois ativos (um com e-mail em maiuscula), um inativo e um Barbeiro; 20 tem um; 19 nenhum.
insert into auth.users(id, email)
select gen_random_uuid(), e
from unnest(array['__T69_GA__@teste.com', '__t69_gb__@teste.com', '__t69_gi__@teste.com', '__t69_br__@teste.com', '__t69_g20__@teste.com']) as e;

update public.users set tenant_id = '69000000-0000-0000-0000-000000000016', role = 'gerente', is_active = true
where lower(email) in ('__t69_ga__@teste.com', '__t69_gb__@teste.com');
update public.users set tenant_id = '69000000-0000-0000-0000-000000000016', role = 'gerente', is_active = false where lower(email) = '__t69_gi__@teste.com';
update public.users set tenant_id = '69000000-0000-0000-0000-000000000016', role = 'barbeiro', is_active = true where lower(email) = '__t69_br__@teste.com';
update public.users set tenant_id = '69000000-0000-0000-0000-000000000020', role = 'gerente', is_active = true where lower(email) = '__t69_g20__@teste.com';

create function pg_temp.t(n integer) returns uuid language sql as
  $$ select ('69000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;

-- Os avisos da barbearia: "tipo:situacao", em ordem, separados por virgula.
create function pg_temp.avisos(n integer) returns text language sql as
  $$ select coalesce(string_agg(b.kind || ':' || b.status, ',' order by b.kind, b.ref_at), '-')
     from public.billing_notices b where b.tenant_id = pg_temp.t(n) $$;

-- Fila diaria: dia a dia -------------------------------------------------------------------------
-- 03/06 12:00 UTC e 09:00 em Brasilia e 08:00 em Manaus. A recusa de 08 foi as 23:30 do dia 31/05
-- em Manaus (00:30 de 01/06 em Brasilia): o terceiro dia dela e 03/06.
select is(private.enqueue_billing_notices('2040-06-03 12:00:00+00'), 1, '03/06: um aviso entra na fila (o do terceiro dia da recusa de Manaus)');
select is(pg_temp.avisos(8), 'payment_failed_day3:pending', 'o terceiro dia conta no dia local da barbearia (Manaus)');
select is(pg_temp.avisos(2), '-', 'em Brasilia a recusa de 01/06 so chega ao terceiro dia em 04/06');

select is(private.enqueue_billing_notices('2040-06-04 12:00:00+00'), 2, '04/06: o terceiro dia da recusa de Brasilia e o quarto dia da de Manaus');
select is(pg_temp.avisos(2) || '|' || pg_temp.avisos(8),
  'payment_failed_day3:pending|payment_failed_day3:pending,payment_failed_day4:pending',
  'cada barbearia recebe o aviso do seu dia');

select is(private.enqueue_billing_notices('2040-06-04 12:00:00+00'), 0, 'rodar a fila de novo no mesmo dia nao repete nenhum aviso');

select is(private.enqueue_billing_notices('2040-06-05 12:00:00+00'), 2, '05/06: o quarto dia da recusa de 02 e o bloqueio de 03');
select is(pg_temp.avisos(2), 'payment_failed_day3:pending,payment_failed_day4:pending', 'quarto dia: "amanha o acesso sera bloqueado"');
select is(pg_temp.avisos(3), 'blocked:pending', 'bloqueada por tempo: aviso de bloqueio efetivado');
select is(pg_temp.avisos(4), '-', 'bloqueada ha mais de 3 dias nao recebe aviso (nao escreve para barbearia antiga)');
select is(pg_temp.avisos(21), '-', 'bloqueio manual do Proprietario (sem motivo) nao manda e-mail');

select is(private.enqueue_billing_notices('2040-06-06 12:00:00+00'), 1, '06/06: o teste de Manaus, cujo fim e 09/06 no relogio local');
select is(pg_temp.avisos(9) || '|' || pg_temp.avisos(1), 'trial_ending:pending|-', 'tres dias antes do fim do teste, no dia local (Brasilia ainda nao)');

select is(private.enqueue_billing_notices('2040-06-07 12:00:00+00'), 1, '07/06: o teste de Brasilia, cujo fim e 10/06');
select is(pg_temp.avisos(1), 'trial_ending:pending', 'em Brasilia o aviso de 3 dias sai em 07/06');

select is(private.enqueue_billing_notices('2040-06-08 12:00:00+00'), 0, '08/06: nada novo (o bloqueio e o teste ja foram avisados)');
select is(pg_temp.avisos(5) || '|' || pg_temp.avisos(6) || '|' || pg_temp.avisos(7) || '|' || pg_temp.avisos(15), '-|-|-|-',
  'ativa, cortesia, cancelada e teste longe do fim nao recebem aviso');

-- Um fuso gravado errado em uma barbearia nao derruba a fila das outras: cai em Brasilia.
select is(private.enqueue_billing_notices('2040-06-09 12:00:00+00'), 1, '09/06: a fila roda apesar do fuso invalido de uma barbearia');
select is(pg_temp.avisos(22), 'trial_ending:pending', 'a barbearia com fuso invalido conta os dias em Brasilia (fim do teste em 12/06, aviso em 09/06)');
select is(
  private.valid_timezone('America/Manaus') || '|' || private.valid_timezone('Brasil/Manaus') || '|' || private.valid_timezone('') || '|' || private.valid_timezone(null),
  'America/Manaus|America/Sao_Paulo|America/Sao_Paulo|America/Sao_Paulo',
  'fuso valido fica como esta; invalido, vazio ou nulo vira Brasilia');

-- Dia da recusa e estorno: gravados na hora pelo pagamento ---------------------------------------
select is(
  public.apply_subscription_payment(pg_temp.t(10), 'pay-10-a', 'mp-69-10', 'rejected', 89.90, '2040-05-01 12:00:00+00', 'recurring', 'visa', '4444'),
  'payment_failed', 'ativa: a primeira recusa');
select is(pg_temp.avisos(10), 'payment_failed_day0:pending', 'a primeira recusa grava o aviso do dia da recusa');
select is(
  (select count(*)::integer from public.billing_notices b join public.tenant_subscriptions s on s.tenant_id = b.tenant_id
   where b.tenant_id = pg_temp.t(10) and b.ref_at = s.first_failed_at),
  1, 'o aviso guarda a data da primeira recusa como evento');

select public.apply_subscription_payment(pg_temp.t(10), 'pay-10-b', 'mp-69-10', 'rejected', 89.90, '2040-05-03 12:00:00+00', 'recurring', 'visa', '4444');
select is(pg_temp.avisos(10), 'payment_failed_day0:pending', 'a retentativa recusada nao gera outro aviso');

select public.apply_subscription_payment(pg_temp.t(10), 'pay-10-c', 'mp-69-10', 'approved', 89.90, '2040-05-03 12:00:00+00', 'recurring', 'visa', '4444');
select public.apply_subscription_payment(pg_temp.t(10), 'pay-10-d', 'mp-69-10', 'rejected', 89.90, '2040-06-10 12:00:00+00', 'recurring', 'visa', '4444');
select is(pg_temp.avisos(10), 'payment_failed_day0:pending,payment_failed_day0:pending', 'uma recusa nova, depois de pagar, e outro ciclo e recebe outro aviso');

select is(
  public.apply_subscription_payment(pg_temp.t(11), 'pay-11-a', 'mp-69-11', 'refunded', 89.90, '2040-04-01 12:00:00+00', 'recurring', 'visa', '4444'),
  'blocked', 'ativa: o estorno bloqueia');
select is(
  (select count(*)::integer from public.billing_notices b join public.tenant_subscriptions s on s.tenant_id = b.tenant_id
   where b.tenant_id = pg_temp.t(11) and b.kind = 'blocked' and b.ref_at = s.blocked_at),
  1, 'o bloqueio por estorno grava o aviso de bloqueio, com a data do bloqueio como evento');

select is(
  public.apply_subscription_payment(pg_temp.t(12), 'pay-12-a', 'mp-69-12', 'refunded', 89.90, '2040-03-01 12:00:00+00', 'recurring', 'visa', '4444') || '|' || pg_temp.avisos(12),
  'recorded|-', 'estorno de pagamento antigo nao bloqueia e nao avisa');
select is(
  public.apply_subscription_payment(pg_temp.t(13), 'pay-13-a', 'mp-69-13', 'rejected', 89.90, '2040-03-15 13:00:00+00', 'recurring', null, null) || '|' || pg_temp.avisos(13),
  'recorded|-', 'recusa que so entra no historico nao avisa');

-- Entrega dos pendentes ------------------------------------------------------------------------
insert into public.billing_notices(tenant_id, kind, ref_at)
values (pg_temp.t(16), 'payment_failed_day3', '2040-05-20 15:00:00+00'),
       (pg_temp.t(19), 'payment_failed_day3', '2040-05-20 15:00:00+00'),
       (pg_temp.t(18), 'blocked', '2040-05-25 06:05:00+00'),
       (pg_temp.t(14), 'payment_failed_day3', '2040-05-20 15:00:00+00');

-- A barbearia 14 pagou entre a fila e o envio.
select public.apply_subscription_payment(pg_temp.t(14), 'pay-14-a', 'mp-69-14', 'approved', 89.90, '2040-06-04 13:00:00+00', 'recurring', 'visa', '4444');

create temp table t69_claim as
  select * from public.claim_billing_notices(50, '2040-06-04 12:10:00+00')
  where tenant_name in ('T69 14', 'T69 16', 'T69 18', 'T69 19', 'T69 22');

select is((select count(*)::integer from t69_claim), 4, 'o claim entrega os pendentes que ainda valem (16, 18, 19 e 22)');
select is((select timezone from t69_claim where tenant_name = 'T69 22'), 'America/Sao_Paulo', 'o fuso invalido chega ao e-mail ja trocado por Brasilia');

select is(
  (select kind || '|' || tenant_name || '|' || timezone || '|' || array_to_string(recipients, ',') || '|' || plan_name || '|' || plan_price || '|' || blocks_at::text
   from t69_claim where tenant_name = 'T69 16'),
  'payment_failed_day3|T69 16|America/Sao_Paulo|__t69_ga__@teste.com,__t69_gb__@teste.com|Máquina|89.90|2040-05-25 15:00:00+00',
  'o aviso vem com os dados do e-mail: destinatarios so dos Gerentes ativos (em minuscula), plano, preco e a data do bloqueio (5 dias depois da recusa)');

select is(
  (select kind || '|' || coalesce(blocked_reason, '-') || '|' || (blocks_at is null)::text || '|' || (card_brand is null)::text
   from t69_claim where tenant_name = 'T69 18'),
  'blocked|refunded|true|true',
  'aviso de bloqueio: traz o motivo e nao tem data de bloqueio futura');

select is(
  (select cardinality(recipients) from t69_claim where tenant_name = 'T69 19'),
  0, 'barbearia sem Gerente ativo: a lista de destinatarios vem vazia (o envio descarta)');

select is(
  (select n.status || '|' || n.attempts from public.billing_notices n where n.tenant_id = pg_temp.t(16)),
  'sending|1', 'o entregue passa a "enviando", com uma tentativa');

select is(
  (select n.status || '|' || n.detail from public.billing_notices n where n.tenant_id = pg_temp.t(14)),
  'skipped|obsoleto', 'o aviso da barbearia que pagou antes do envio e descartado como obsoleto');

select is(
  (select count(*)::integer from public.claim_billing_notices(50, '2040-06-04 12:10:30+00') where tenant_name in ('T69 16', 'T69 18', 'T69 19')),
  0, 'quem esta sendo enviado nao e entregue duas vezes');

-- Envio que travou: volta para a fila depois de 10 minutos, ate 3 tentativas -------------------
select is(
  (select count(*)::integer from public.claim_billing_notices(50, '2040-06-04 12:21:00+00') where tenant_name = 'T69 16'),
  1, 'depois de 10 minutos preso em "enviando", o aviso volta a ser entregue');
select is(
  (select n.status || '|' || n.attempts from public.billing_notices n where n.tenant_id = pg_temp.t(16)),
  'sending|2', 'com a segunda tentativa');

update public.billing_notices set attempts = 3, claimed_at = '2040-06-04 12:00:00+00' where tenant_id = pg_temp.t(16);
select count(*) from public.claim_billing_notices(50, '2040-06-04 12:40:00+00') where tenant_name = 'T69 16';
select is(
  (select n.status || '|' || n.detail from public.billing_notices n where n.tenant_id = pg_temp.t(16)),
  'failed|tentativas esgotadas', 'depois de 3 tentativas presas, o aviso falha e para de voltar');

-- Conclusao do envio ---------------------------------------------------------------------------
insert into public.billing_notices(tenant_id, kind, ref_at, status, attempts, claimed_at)
values (pg_temp.t(20), 'payment_failed_day3', '2040-05-20 15:00:00+00', 'sending', 1, '2040-06-04 12:10:00+00');

select public.finish_billing_notice((select id from public.billing_notices where tenant_id = pg_temp.t(20)), 'retry', 'Resend 503');
select is(
  (select status || '|' || detail from public.billing_notices where tenant_id = pg_temp.t(20)),
  'pending|Resend 503', 'falha passageira: volta para a fila, com o motivo');

update public.billing_notices set status = 'sending', attempts = 3 where tenant_id = pg_temp.t(20);
select public.finish_billing_notice((select id from public.billing_notices where tenant_id = pg_temp.t(20)), 'retry', 'Resend 503');
select is(
  (select status from public.billing_notices where tenant_id = pg_temp.t(20)),
  'failed', 'falha passageira na terceira tentativa: falha de vez');

select public.finish_billing_notice((select id from public.billing_notices where tenant_id = pg_temp.t(20)), 'sent', null);
select is(
  (select status || '|' || (sent_at is not null)::text from public.billing_notices where tenant_id = pg_temp.t(20)),
  'sent|true', 'enviado: grava a hora do envio');

select throws_ok(
  $$select public.finish_billing_notice(gen_random_uuid(), 'talvez', null)$$,
  '22023', null, 'a conclusao so aceita sent, skipped, retry ou failed');

-- Segredo do cron e tarefas agendadas -------------------------------------------------------------
select is(
  public.verify_billing_notices_secret((select decrypted_secret from vault.decrypted_secrets where name = 'billing_notices_secret')),
  true, 'o segredo do cron e aceito');
select is(public.verify_billing_notices_secret('errado') or public.verify_billing_notices_secret('') or coalesce(public.verify_billing_notices_secret(null), false), false,
  'segredo errado, vazio ou nulo e recusado');

select is(
  (select string_agg(jobname || '@' || schedule, ',' order by jobname) from cron.job where jobname in ('enqueue-billing-notices', 'send-billing-notices')),
  'enqueue-billing-notices@0 12 * * *,send-billing-notices@*/5 * * * *',
  'a fila diaria roda as 12:00 UTC (09:00 em Brasilia) e o envio a cada 5 minutos');
select is(
  (select command like '%/functions/v1/send-billing-email%' and command like '%billing_notices_secret%' from cron.job where jobname = 'send-billing-notices'),
  true, 'o envio chama a funcao send-billing-email com o segredo do Vault');

-- Privilegios -------------------------------------------------------------------------------------
select ok(
  (select bool_and(
     has_function_privilege('service_role', s, 'execute')
     and not has_function_privilege('anon', s, 'execute')
     and not has_function_privilege('authenticated', s, 'execute'))
   from unnest(array[
     'public.claim_billing_notices(integer,timestamptz)',
     'public.finish_billing_notice(uuid,text,text)',
     'public.verify_billing_notices_secret(text)'
   ]) as s),
  'as funcoes do envio so sao executaveis pelo service_role');

select ok(
  (select bool_and(not has_function_privilege('anon', s, 'execute') and not has_function_privilege('authenticated', s, 'execute'))
   from unnest(array[
     'private.enqueue_billing_notice(uuid,text,timestamptz)',
     'private.enqueue_billing_notices(timestamptz)',
     'private.billing_notice_is_current(uuid,text,timestamptz,timestamptz)',
     'private.valid_timezone(text)'
   ]) as s),
  'as funcoes privadas da fila nao sao executaveis pelo front');

set local role authenticated;
select throws_ok($$select * from public.billing_notices$$, '42501', null, 'o front nao le a fila de avisos');
reset role;
set local role anon;
select throws_ok($$select * from public.billing_notices$$, '42501', null, 'anonimo nao le a fila de avisos');
reset role;

select * from finish();
rollback;
