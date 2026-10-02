-- Spec 052, ticket 15: ferramentas do Proprietário.
--
-- Funções do banco só para o Proprietário (papel `proprietario`, ativo): estender o teste, dar e tirar a cortesia, desbloquear até
-- uma data com o motivo registrado, bloquear à mão, ler os detalhes da assinatura de uma barbearia e listar os avisos por e-mail
-- que falharam. Nenhuma toca o Mercado Pago. Substituem a escrita direta em `tenant_subscriptions` que a tela Admin > Tenants fazia
-- (interina desde o ticket 03, com o relógio do navegador).
--
-- O desbloqueio é uma data em cima da assinatura, e não uma situação nova: `unblocked_until`. A situação (`status`) e o motivo do
-- bloqueio seguem como estavam, então o pagamento que o Gerente fizer depois reativa a barbearia pelos caminhos de sempre. Enquanto
-- a data vale, o Estado de Acesso de uma barbearia bloqueada é `warning` com o motivo `unblocked`; passada a data, volta ao motivo
-- de antes, e a data relevante passa a ser o fim do desbloqueio (é dali que contam a data do bloqueio e os 7 dias da Instância
-- WhatsApp). Mudar a situação da assinatura (um pagamento aprovado, o bloqueio da rotina) tira o desbloqueio.
--
-- O motivo de cada ação do Proprietário fica só na trilha de auditoria (`audit_logs`), com `tenant_id` nulo: o Gerente lê a linha da
-- própria assinatura e as linhas de `audit_logs` do próprio tenant, e o motivo é nota interna.

-- 1. A data do desbloqueio ---------------------------------------------------------------------------------------------------------
alter table public.tenant_subscriptions add column if not exists unblocked_until timestamptz;

-- 2. O Estado de Acesso com o desbloqueio ------------------------------------------------------------------------------------------
create or replace function private.subscription_access_state(sub public.tenant_subscriptions, p_now timestamp with time zone)
returns table(access text, reason text, relevant_date timestamp with time zone)
language plpgsql
stable
set search_path to ''
as $function$
declare
  v_limite timestamptz;
begin
  case sub.status
    when 'trialing' then
      relevant_date := sub.trial_ends_at;
      if sub.trial_ends_at is null or p_now >= sub.trial_ends_at then
        access := 'blocked';
        reason := 'trial_expired';
      elsif sub.trial_ends_at - p_now <= interval '3 days' then
        access := 'warning';
        reason := 'trial';
      else
        access := 'allowed';
        reason := 'trial';
      end if;

    when 'active' then
      access := 'allowed';
      reason := 'active';
      relevant_date := sub.current_period_end;

    when 'past_due' then
      -- Dia 0 e a primeira recusa; bloqueia a partir do quinto dia.
      v_limite := sub.first_failed_at + interval '5 days';
      reason := 'payment_failed';
      relevant_date := v_limite;
      if v_limite is null or p_now >= v_limite then
        access := 'blocked';
      else
        access := 'warning';
      end if;

    when 'canceled' then
      relevant_date := sub.current_period_end;
      if sub.current_period_end is null or p_now >= sub.current_period_end then
        access := 'blocked';
        reason := 'canceled';
        -- O acesso fechou no cancelamento, e nao no fim de um periodo pago que ja tinha acabado: a data do bloqueio e a maior
        -- das duas (a rotina que grava o bloqueio e a contagem dos 7 dias da Instancia WhatsApp partem dela).
        relevant_date := greatest(sub.current_period_end, sub.canceled_at);
      elsif sub.canceled_at is null and sub.mp_subscription_id is not null and sub.card_brand is not null then
        -- Assinou de novo e o Mercado Pago autorizou a assinatura nova: a cobranca dela recomeca no fim do periodo pago.
        access := 'allowed';
        reason := 'active';
      else
        -- Cancelou, mas o periodo ja pago vale ate o fim: liberada, com a faixa "Assinatura cancelada. Acesso ate DD/MM.".
        access := 'warning';
        reason := 'canceled';
      end if;

    when 'courtesy' then
      relevant_date := sub.courtesy_ends_at;
      if sub.courtesy_ends_at is null or p_now < sub.courtesy_ends_at then
        access := 'allowed';
        reason := 'courtesy';
      else
        access := 'blocked';
        reason := 'courtesy_expired';
      end if;

    else
      access := 'blocked';
      reason := coalesce(sub.blocked_reason, 'blocked');
      relevant_date := sub.blocked_at;
  end case;

  -- Desbloqueio manual do Proprietario (ticket 15): liberada ate a data, com aviso. Passada a data, o acesso fechou de novo ali: a
  -- data relevante e o fim do desbloqueio (a rotina que grava o bloqueio e os 7 dias da Instancia WhatsApp partem dela).
  if access = 'blocked' and sub.unblocked_until is not null then
    if p_now < sub.unblocked_until then
      access := 'warning';
      reason := 'unblocked';
      relevant_date := sub.unblocked_until;
    else
      relevant_date := greatest(relevant_date, sub.unblocked_until);
    end if;
  end if;

  return next;
end;
$function$;

-- 3. Mudar a situacao da assinatura tira o desbloqueio -----------------------------------------------------------------------------
-- Um pagamento aprovado (ativa), o bloqueio da rotina, uma cortesia: o desbloqueio era de um bloqueio que ja nao existe, e uma data
-- antiga nao pode segurar um bloqueio de depois.
create or replace function private.clear_unblock_on_status_change()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  new.unblocked_until := null;
  return new;
end;
$function$;

drop trigger if exists trg_clear_unblock_on_status_change on public.tenant_subscriptions;
create trigger trg_clear_unblock_on_status_change
  before update of status on public.tenant_subscriptions
  for each row
  when (old.status is distinct from new.status)
  execute function private.clear_unblock_on_status_change();

-- 4. A Instancia WhatsApp com o desbloqueio ----------------------------------------------------------------------------------------
-- Desbloqueio em vigor: a barbearia esta liberada, e a instancia fica. Acabado o desbloqueio, os 7 dias contam dali, e nao do
-- bloqueio de antes.
create or replace function private.whatsapp_instance_deletion_verdict(p_instance_id uuid, p_now timestamptz default now())
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_tenant_id uuid;
  v_instance_environment text;
  v_status text;
  v_blocked_at timestamptz;
  v_unblocked_until timestamptz;
  v_updated_at timestamptz;
  v_runtime_environment text := private.runtime_environment();
begin
  select i.tenant_id, i.environment, s.status, s.blocked_at, s.unblocked_until, s.updated_at
  into v_tenant_id, v_instance_environment, v_status, v_blocked_at, v_unblocked_until, v_updated_at
  from public.whatsapp_instances i
  left join public.tenant_subscriptions s on s.tenant_id = i.tenant_id
  where i.id = p_instance_id;

  if not found then
    return 'not_found';
  end if;
  if v_instance_environment is null then
    return 'unidentified';
  end if;
  if v_runtime_environment is null then
    return 'runtime_unidentified';
  end if;
  if v_instance_environment <> v_runtime_environment then
    return 'other_environment';
  end if;
  if v_status is distinct from 'blocked' or v_blocked_at is null then
    return 'not_blocked';
  end if;
  -- Desbloqueio manual do Proprietario em vigor: a barbearia esta liberada.
  if p_now is not null and v_unblocked_until is not null and v_unblocked_until > p_now then
    return 'not_blocked';
  end if;
  -- O acesso fechou de novo quando o desbloqueio acabou: os 7 dias contam dali.
  v_blocked_at := greatest(v_blocked_at, v_unblocked_until);
  -- Sem horario de referencia nao ha como contar os 7 dias: nunca devida.
  if p_now is null or v_blocked_at > p_now - interval '7 days' then
    return 'too_recent';
  end if;
  -- A barbearia pode ter pago e o Mercado Pago ainda nao ter respondido (cobranca em analise resolve em ate 2 dias uteis).
  if exists (
    select 1
    from public.billing_charges c
    where c.tenant_id = v_tenant_id
      and c.status in ('in_process', 'pending')
      and c.charged_at > p_now - interval '5 days'
  ) then
    return 'payment_pending';
  end if;
  -- Ou estar no meio de assinar (a autorizacao da assinatura nova ainda nao gerou a primeira cobranca).
  if v_updated_at > p_now - interval '3 days' then
    return 'recently_changed';
  end if;
  return 'due';
end;
$function$;
revoke all on function private.whatsapp_instance_deletion_verdict(uuid, timestamptz) from public, anon, authenticated;

-- 5. Auxiliares das funcoes do Proprietario ----------------------------------------------------------------------------------------
create or replace function private.assert_saas_admin()
returns void
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not private.is_saas_admin() then
    raise exception 'ADMIN_ONLY' using errcode = '42501';
  end if;
end;
$function$;
revoke all on function private.assert_saas_admin() from public, anon, authenticated;

-- O "ate o dia D" termina no fim do dia D no fuso da barbearia: 23:59:59.999999 de D, um microssegundo antes de o dia D+1 comecar la.
-- A data que a tela mostra (o Gerente, o Proprietario, a faixa de aviso) e a mesma que o Proprietario digitou: um instante na
-- virada do dia seguinte apareceria como D+1.
create or replace function private.end_of_day_in_tenant(p_tenant_id uuid, p_day date)
returns timestamptz
language sql
stable
set search_path to ''
as $function$
  select ((p_day + 1)::timestamp at time zone private.valid_timezone((select t.timezone from public.tenants t where t.id = p_tenant_id))) - interval '1 microsecond';
$function$;
revoke all on function private.end_of_day_in_tenant(uuid, date) from public, anon, authenticated;

-- A trilha das acoes do Proprietario: sem tenant_id (o Gerente le as linhas de audit_logs do proprio tenant, e o motivo e nota
-- interna); a barbearia vai em details.tenant_id.
create or replace function private.log_admin_action(p_action text, p_tenant_id uuid, p_details jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.audit_logs(tenant_id, user_id, action, resource, details)
  values (null, (select auth.uid()), p_action, 'tenant_subscription', jsonb_build_object('tenant_id', p_tenant_id) || coalesce(p_details, '{}'::jsonb));
end;
$function$;
revoke all on function private.log_admin_action(text, uuid, jsonb) from public, anon, authenticated;

-- 6. As funcoes do Proprietario ----------------------------------------------------------------------------------------------------
-- Erros (message / SQLSTATE): ADMIN_ONLY 42501; SUBSCRIPTION_NOT_FOUND e TENANT_NOT_FOUND P0002; INVALID_DATE e REASON_REQUIRED
-- 22023; NOT_IN_TRIAL, NOT_COURTESY, NOT_BLOCKED e ALREADY_BLOCKED 55000.

-- Estender o teste ate o fim do dia `p_until` (no fuso da barbearia): serve a quem esta em teste e a quem o teste (ou a cortesia)
-- vencido ja bloqueou. Estender nao encurta.
create or replace function public.admin_extend_trial(p_tenant_id uuid, p_until date)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_sub public.tenant_subscriptions;
  v_fim timestamptz;
begin
  perform private.assert_saas_admin();

  select * into v_sub from public.tenant_subscriptions where tenant_id = p_tenant_id for update;
  if not found then
    raise exception 'SUBSCRIPTION_NOT_FOUND' using errcode = 'P0002';
  end if;
  -- `blocked_reason` nulo (o bloqueio manual) nao e teste vencido: sem o coalesce o `in` daria NULL e o `if` deixaria passar.
  if not (v_sub.status = 'trialing' or (v_sub.status = 'blocked' and coalesce(v_sub.blocked_reason, '') in ('trial_expired', 'courtesy_expired'))) then
    raise exception 'NOT_IN_TRIAL' using errcode = '55000';
  end if;
  if p_until is null then
    raise exception 'INVALID_DATE' using errcode = '22023';
  end if;
  v_fim := private.end_of_day_in_tenant(p_tenant_id, p_until);
  if v_fim <= now() or (v_sub.status = 'trialing' and v_fim <= coalesce(v_sub.trial_ends_at, now())) then
    raise exception 'INVALID_DATE' using errcode = '22023';
  end if;

  update public.tenant_subscriptions
  set status = 'trialing',
      trial_ends_at = v_fim,
      blocked_at = null,
      blocked_reason = null,
      first_failed_at = null,
      courtesy_ends_at = null,
      updated_at = now()
  where id = v_sub.id;

  perform private.log_admin_action(
    'admin_extend_trial',
    p_tenant_id,
    jsonb_build_object('previous_status', v_sub.status, 'previous_trial_ends_at', v_sub.trial_ends_at, 'trial_ends_at', v_fim)
  );
end;
$function$;

-- Marcar a cortesia: sem cobranca e sem bloqueio ate o fim do dia `p_ends_on`, ou sem fim se a data vier nula. Nao toca o Mercado Pago.
create or replace function public.admin_set_courtesy(p_tenant_id uuid, p_ends_on date default null)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_sub public.tenant_subscriptions;
  v_fim timestamptz;
begin
  perform private.assert_saas_admin();

  select * into v_sub from public.tenant_subscriptions where tenant_id = p_tenant_id for update;
  if not found then
    raise exception 'SUBSCRIPTION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_ends_on is not null then
    v_fim := private.end_of_day_in_tenant(p_tenant_id, p_ends_on);
    if v_fim <= now() then
      raise exception 'INVALID_DATE' using errcode = '22023';
    end if;
  end if;

  update public.tenant_subscriptions
  set status = 'courtesy',
      courtesy_ends_at = v_fim,
      blocked_at = null,
      blocked_reason = null,
      canceled_at = null,
      first_failed_at = null,
      updated_at = now()
  where id = v_sub.id;

  perform private.log_admin_action(
    'admin_set_courtesy',
    p_tenant_id,
    jsonb_build_object('previous_status', v_sub.status, 'courtesy_ends_at', v_fim)
  );
end;
$function$;

-- Desmarcar a cortesia: ela termina agora e a barbearia segue a regra do teste vencido (bloqueada, motivo courtesy_expired).
create or replace function public.admin_end_courtesy(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_sub public.tenant_subscriptions;
begin
  perform private.assert_saas_admin();

  select * into v_sub from public.tenant_subscriptions where tenant_id = p_tenant_id for update;
  if not found then
    raise exception 'SUBSCRIPTION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_sub.status <> 'courtesy' then
    raise exception 'NOT_COURTESY' using errcode = '55000';
  end if;

  update public.tenant_subscriptions
  set status = 'blocked',
      blocked_at = now(),
      blocked_reason = 'courtesy_expired',
      courtesy_ends_at = now(),
      updated_at = now()
  where id = v_sub.id;

  perform private.log_admin_action(
    'admin_end_courtesy',
    p_tenant_id,
    jsonb_build_object('previous_courtesy_ends_at', v_sub.courtesy_ends_at)
  );
end;
$function$;

-- Desbloquear ate o fim do dia `p_until`, com o motivo (obrigatorio, so na trilha de auditoria). So vale para quem esta bloqueado
-- (mesmo que um desbloqueio anterior ainda esteja em vigor: desbloquear de novo muda a data).
create or replace function public.admin_unblock_tenant(p_tenant_id uuid, p_until date, p_reason text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_sub public.tenant_subscriptions;
  v_base public.tenant_subscriptions;
  v_access text;
  v_motivo text := btrim(coalesce(p_reason, ''));
  v_fim timestamptz;
begin
  perform private.assert_saas_admin();

  select * into v_sub from public.tenant_subscriptions where tenant_id = p_tenant_id for update;
  if not found then
    raise exception 'SUBSCRIPTION_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- O bloqueio de verdade, sem o desbloqueio que ja esteja valendo.
  v_base := v_sub;
  v_base.unblocked_until := null;
  select e.access into v_access from private.subscription_access_state(v_base, now()) e;
  if v_access is distinct from 'blocked' then
    raise exception 'NOT_BLOCKED' using errcode = '55000';
  end if;
  if v_motivo = '' then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;
  if p_until is null then
    raise exception 'INVALID_DATE' using errcode = '22023';
  end if;
  v_fim := private.end_of_day_in_tenant(p_tenant_id, p_until);
  if v_fim <= now() then
    raise exception 'INVALID_DATE' using errcode = '22023';
  end if;

  update public.tenant_subscriptions
  set unblocked_until = v_fim,
      updated_at = now()
  where id = v_sub.id;

  perform private.log_admin_action(
    'admin_unblock_tenant',
    p_tenant_id,
    jsonb_build_object(
      'reason', v_motivo,
      'unblocked_until', v_fim,
      'previous_unblocked_until', v_sub.unblocked_until,
      'status', v_sub.status,
      'blocked_reason', v_sub.blocked_reason
    )
  );
end;
$function$;

-- Bloquear a mao (a data do bloqueio e a do relogio do banco, e nao a do navegador), com o motivo (obrigatorio, so na trilha de
-- auditoria). Sem motivo de cobranca: a tela de bloqueio diz so que o acesso esta suspenso e o e-mail de bloqueio nao sai.
create or replace function public.admin_block_tenant(p_tenant_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_sub public.tenant_subscriptions;
  v_motivo text := btrim(coalesce(p_reason, ''));
begin
  perform private.assert_saas_admin();

  select * into v_sub from public.tenant_subscriptions where tenant_id = p_tenant_id for update;
  if not found then
    raise exception 'SUBSCRIPTION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_sub.status = 'blocked' then
    raise exception 'ALREADY_BLOCKED' using errcode = '55000';
  end if;
  if v_motivo = '' then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;

  update public.tenant_subscriptions
  set status = 'blocked',
      blocked_at = now(),
      blocked_reason = null,
      updated_at = now()
  where id = v_sub.id;

  perform private.log_admin_action(
    'admin_block_tenant',
    p_tenant_id,
    jsonb_build_object('reason', v_motivo, 'previous_status', v_sub.status)
  );
end;
$function$;

-- Os detalhes da assinatura de uma barbearia: tudo o que o Proprietario precisa para atender o suporte sem abrir o banco.
create or replace function public.admin_get_tenant_subscription(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_tenant public.tenants;
  v_sub public.tenant_subscriptions;
  v_tem_assinatura boolean;
  v_plano public.plans;
  v_plano_agendado public.plans;
begin
  perform private.assert_saas_admin();

  select * into v_tenant from public.tenants where id = p_tenant_id;
  if not found then
    raise exception 'TENANT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_sub from public.tenant_subscriptions where tenant_id = p_tenant_id;
  v_tem_assinatura := found;
  if v_tem_assinatura then
    select * into v_plano from public.plans where id = v_sub.plan_id;
    select * into v_plano_agendado from public.plans where id = v_sub.scheduled_plan_id;
  end if;

  return jsonb_build_object(
    'tenant', jsonb_build_object(
      'id', v_tenant.id,
      'name', v_tenant.name,
      'email', v_tenant.email,
      'phone', v_tenant.phone,
      'timezone', v_tenant.timezone,
      'created_at', v_tenant.created_at
    ),
    'subscription', case when v_tem_assinatura then jsonb_build_object(
      'status', v_sub.status,
      'trial_ends_at', v_sub.trial_ends_at,
      'current_period_start', v_sub.current_period_start,
      'current_period_end', v_sub.current_period_end,
      'first_failed_at', v_sub.first_failed_at,
      'blocked_at', v_sub.blocked_at,
      'blocked_reason', v_sub.blocked_reason,
      'canceled_at', v_sub.canceled_at,
      'courtesy_ends_at', v_sub.courtesy_ends_at,
      'unblocked_until', v_sub.unblocked_until,
      'mp_subscription_id', v_sub.mp_subscription_id,
      'card_brand', v_sub.card_brand,
      'card_last4', v_sub.card_last4,
      'plan', jsonb_build_object('id', v_plano.id, 'name', v_plano.name, 'price', v_plano.price, 'max_professionals', v_plano.max_professionals),
      'scheduled_plan', case when v_plano_agendado.id is null then null else
        jsonb_build_object('id', v_plano_agendado.id, 'name', v_plano_agendado.name, 'price', v_plano_agendado.price, 'max_professionals', v_plano_agendado.max_professionals)
      end
    ) else null end,
    'access', (select jsonb_build_object('access', e.access, 'reason', e.reason, 'relevant_date', e.relevant_date) from private.tenant_access_state(p_tenant_id) e),
    'active_professionals', (select count(*) from public.professionals pr where pr.tenant_id = p_tenant_id and pr.deleted_at is null),
    'charges', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.charged_at desc)
      from (
        select bc.id, bc.mp_payment_id, bc.mp_subscription_id, bc.kind, bc.status, bc.amount, bc.charged_at, bc.card_brand, bc.card_last4
        from public.billing_charges bc
        where bc.tenant_id = p_tenant_id
        order by bc.charged_at desc
        limit 50
      ) c
    ), '[]'::jsonb),
    'unblock', case when v_tem_assinatura and v_sub.unblocked_until is not null then (
      select jsonb_build_object('reason', a.details->>'reason', 'at', a.created_at, 'until', v_sub.unblocked_until)
      from public.audit_logs a
      where a.action = 'admin_unblock_tenant' and a.details->>'tenant_id' = p_tenant_id::text
      order by a.created_at desc
      limit 1
    ) else null end,
    'admin_actions', coalesce((
      select jsonb_agg(jsonb_build_object('action', x.action, 'at', x.created_at, 'by', u.name, 'details', x.details - 'tenant_id') order by x.created_at desc)
      from (
        select a.action, a.created_at, a.user_id, a.details
        from public.audit_logs a
        where a.action like 'admin\_%' and a.details->>'tenant_id' = p_tenant_id::text
        order by a.created_at desc
        limit 20
      ) x
      left join public.users u on u.id = x.user_id
    ), '[]'::jsonb)
  );
end;
$function$;

-- Os avisos por e-mail que falharam (esgotaram as tentativas, ou o Resend recusou), com o motivo, para o Proprietario perceber uma
-- chave do Resend vencida ou um dominio sem verificacao antes de o cliente reclamar (ticket 08).
create or replace function public.admin_list_failed_billing_notices(p_limit integer default 50)
returns table(id uuid, tenant_id uuid, tenant_name text, kind text, ref_at timestamptz, attempts integer, detail text, created_at timestamptz)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform private.assert_saas_admin();

  return query
  select n.id, n.tenant_id, t.name, n.kind, n.ref_at, n.attempts, n.detail, n.created_at
  from public.billing_notices n
  left join public.tenants t on t.id = n.tenant_id
  where n.status = 'failed'
  order by n.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$function$;

revoke all on function public.admin_extend_trial(uuid, date) from public, anon;
revoke all on function public.admin_set_courtesy(uuid, date) from public, anon;
revoke all on function public.admin_end_courtesy(uuid) from public, anon;
revoke all on function public.admin_unblock_tenant(uuid, date, text) from public, anon;
revoke all on function public.admin_block_tenant(uuid, text) from public, anon;
revoke all on function public.admin_get_tenant_subscription(uuid) from public, anon;
revoke all on function public.admin_list_failed_billing_notices(integer) from public, anon;
grant execute on function public.admin_extend_trial(uuid, date) to authenticated;
grant execute on function public.admin_set_courtesy(uuid, date) to authenticated;
grant execute on function public.admin_end_courtesy(uuid) to authenticated;
grant execute on function public.admin_unblock_tenant(uuid, date, text) to authenticated;
grant execute on function public.admin_block_tenant(uuid, text) to authenticated;
grant execute on function public.admin_get_tenant_subscription(uuid) to authenticated;
grant execute on function public.admin_list_failed_billing_notices(integer) to authenticated;

-- 7. A lista de barbearias mostra ate quando uma desbloqueada esta liberada (a data e o fim de um dia no fuso da barbearia) -------------
create or replace view public.view_tenants_management as
 select t.id as tenant_id,
    t.name as tenant_name,
    t.email as tenant_email,
    t.phone as tenant_phone,
    t.logo_url as tenant_logo_url,
    t.created_at as tenant_created_at,
    p.name as plan_name,
    p.price as plan_price,
    sub.status as subscription_status,
        case sub.status
            when 'trialing'::text then sub.trial_ends_at
            when 'courtesy'::text then sub.courtesy_ends_at
            when 'blocked'::text then sub.blocked_at
            else sub.current_period_end
        end as subscription_end_date,
    inst.status as whatsapp_status,
    sub.unblocked_until as subscription_unblocked_until,
    t.timezone as tenant_timezone
   from tenants t
     left join tenant_subscriptions sub on sub.tenant_id = t.id
     left join plans p on p.id = sub.plan_id
     left join whatsapp_instances inst on inst.tenant_id = t.id;
alter view public.view_tenants_management set (security_invoker = true);
