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
-- WhatsApp). Mudar o que define o acesso (a situação da assinatura, o fim do teste, o fim da cortesia, o período pago, a primeira
-- recusa ou o cancelamento: um pagamento aprovado, o bloqueio da rotina, estender o teste) tira o desbloqueio, e bloquear de novo uma
-- barbearia desbloqueada o encerra na hora.
--
-- O motivo de cada ação do Proprietário fica só na trilha de auditoria (`audit_logs`), com `tenant_id` nulo: o Gerente lê a linha da
-- própria assinatura e as linhas de `audit_logs` do próprio tenant, e o motivo é nota interna. Como o Gerente também grava em
-- `audit_logs` (com o `tenant_id` dele), a leitura da trilha só conta as linhas sem `tenant_id`.
--
-- Os dias das funções (`date`) valem até 20 anos à frente: mais que isso é erro de digitação (2206 no lugar de 2026) ou `infinity`,
-- que o front nem sabe mostrar.

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

-- 3. Mudar o que define o acesso tira o desbloqueio --------------------------------------------------------------------------------
-- Um pagamento aprovado (ativa), o bloqueio da rotina, uma cortesia, estender o teste, o fim da cortesia, o periodo pago que avanca,
-- uma recusa nova, o cancelamento: o desbloqueio era de um bloqueio que ja nao existe, e uma data antiga nao pode segurar um bloqueio
-- de depois. So a situacao nao basta: estender o teste de quem segue em teste, ou mudar o fim da cortesia de quem segue em cortesia,
-- troca a data e mantem a situacao. Cartao, plano, id no Mercado Pago e motivo do bloqueio nao mexem no acesso, e a mesma instrucao
-- que poe o desbloqueio (a data muda junto) nao o tira.
drop trigger if exists trg_clear_unblock_on_status_change on public.tenant_subscriptions;
drop function if exists private.clear_unblock_on_status_change();

create or replace function private.clear_unblock_on_access_change()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  new.unblocked_until := null;
  return new;
end;
$function$;

drop trigger if exists trg_clear_unblock_on_access_change on public.tenant_subscriptions;
create trigger trg_clear_unblock_on_access_change
  before update on public.tenant_subscriptions
  for each row
  when (
    old.unblocked_until is not null
    and new.unblocked_until is not distinct from old.unblocked_until
    and (old.status, old.trial_ends_at, old.courtesy_ends_at, old.current_period_end, old.first_failed_at, old.canceled_at)
        is distinct from
        (new.status, new.trial_ends_at, new.courtesy_ends_at, new.current_period_end, new.first_failed_at, new.canceled_at)
  )
  execute function private.clear_unblock_on_access_change();

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

-- 4b. Os avisos por e-mail com o desbloqueio ---------------------------------------------------------------------------------------
-- O aviso de bloqueio ("seu acesso foi bloqueado") decide pelo Estado de Acesso, e nao so por `status = 'blocked'`: com um Desbloqueio
-- Manual em vigor a situacao segue `blocked`, mas a barbearia esta liberada, e o e-mail dizendo que o acesso foi bloqueado seria falso
-- (nem sai, nem vale o que ja estiver na fila). O evento do aviso e a data em que o acesso fechou, a data relevante do Estado de Acesso
-- (`blocked_at`, ou o fim do desbloqueio quando ele acabou): acabado o desbloqueio sai o aviso, dentro dos 3 dias de sempre.
create or replace function private.billing_notice_is_current(p_tenant_id uuid, p_kind text, p_ref_at timestamptz, p_now timestamptz)
returns boolean
language sql
stable
set search_path to ''
as $function$
  select exists (
    select 1
    from public.tenant_subscriptions s
    where s.tenant_id = p_tenant_id
      and case p_kind
        when 'trial_ending' then s.status = 'trialing' and s.trial_ends_at = p_ref_at and s.trial_ends_at > p_now
        when 'blocked' then s.status = 'blocked'
          and (select e.access from private.subscription_access_state(s, p_now) e) = 'blocked'
          and (select e.relevant_date from private.subscription_access_state(s, p_now) e) = p_ref_at
        else s.status = 'past_due' and s.first_failed_at = p_ref_at
      end
  );
$function$;
revoke all on function private.billing_notice_is_current(uuid, text, timestamptz, timestamptz) from public, anon, authenticated;

create or replace function private.enqueue_billing_notices(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_total integer;
begin
  insert into public.billing_notices(tenant_id, kind, ref_at)
  select c.tenant_id, c.kind, c.ref_at
  from (
    select s.tenant_id, k.kind, k.ref_at
    from public.tenant_subscriptions s
    join public.tenants t on t.id = s.tenant_id
    cross join lateral (select private.valid_timezone(t.timezone) as tz) z
    cross join lateral (values
      ('trial_ending',
        case when s.status = 'trialing' and s.trial_ends_at > p_now
                  and (s.trial_ends_at at time zone z.tz)::date - 3 = (p_now at time zone z.tz)::date
             then s.trial_ends_at end),
      ('payment_failed_day3',
        case when s.status = 'past_due' and s.first_failed_at is not null
                  and (s.first_failed_at at time zone z.tz)::date + 3 = (p_now at time zone z.tz)::date
             then s.first_failed_at end),
      ('payment_failed_day4',
        case when s.status = 'past_due' and s.first_failed_at is not null
                  and (s.first_failed_at at time zone z.tz)::date + 4 = (p_now at time zone z.tz)::date
             then s.first_failed_at end),
      ('blocked',
        case when s.status = 'blocked' and s.blocked_reason is not null
                  and (select e.access from private.subscription_access_state(s, p_now) e) = 'blocked'
                  and (select e.relevant_date from private.subscription_access_state(s, p_now) e) between p_now - interval '3 days' and p_now
             then (select e.relevant_date from private.subscription_access_state(s, p_now) e) end)
    ) as k(kind, ref_at)
    where k.ref_at is not null
  ) c
  on conflict (tenant_id, kind, ref_at) do nothing;

  get diagnostics v_total = row_count;
  return v_total;
end;
$function$;
revoke all on function private.enqueue_billing_notices(timestamptz) from public, anon, authenticated;

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

-- O "ate o dia D" termina no fim do dia D no fuso da barbearia: um microssegundo antes de o dia D+1 comecar la (23:59:59.999999 de D).
-- A data que a tela mostra (o Gerente, o Proprietario, a faixa de aviso) e a mesma que o Proprietario digitou: um instante na
-- virada do dia seguinte apareceria como D+1. O comeco de D+1 e o menor de dois candidatos, porque cada um erra num caso: a meia-noite
-- de D+1 que se repete (Havana, Acores: o banco escolhe a segunda) vem uma hora tarde, e as 23:59:59.999999 de D que nao existem
-- (Nuuk: o relogio pula das 23:00 para as 00:00) tambem; o menor dos dois e o certo nos dois. O fuso que o banco nao conhece cai em
-- Sao Paulo (`private.valid_timezone`), como no resto do sistema. Recusa `infinity` e dia a mais de 20 anos (erro de digitacao).
create or replace function private.end_of_day_in_tenant(p_tenant_id uuid, p_day date)
returns timestamptz
language plpgsql
stable
set search_path to ''
as $function$
declare
  v_tz text := private.valid_timezone((select t.timezone from public.tenants t where t.id = p_tenant_id));
begin
  if p_day is null or not isfinite(p_day) or p_day > ((now() at time zone v_tz)::date + interval '20 years')::date then
    raise exception 'INVALID_DATE' using errcode = '22023';
  end if;

  return least(
    (p_day + 1)::timestamp at time zone v_tz,
    ((p_day::timestamp + time '23:59:59.999999') at time zone v_tz) + interval '1 microsecond'
  ) - interval '1 microsecond';
end;
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
  v_motivo text := btrim(coalesce(p_reason, ''), E' \t\r\n\f\v');
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
-- Numa barbearia ja bloqueada com um desbloqueio em vigor, bloquear encerra o desbloqueio na hora: a data dele vira a de agora (o
-- bloqueio volta a ser o de antes, e dali contam os 7 dias da Instancia WhatsApp). Sem desbloqueio em vigor, ja esta bloqueada.
create or replace function public.admin_block_tenant(p_tenant_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_sub public.tenant_subscriptions;
  v_motivo text := btrim(coalesce(p_reason, ''), E' \t\r\n\f\v');
begin
  perform private.assert_saas_admin();

  select * into v_sub from public.tenant_subscriptions where tenant_id = p_tenant_id for update;
  if not found then
    raise exception 'SUBSCRIPTION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_sub.status = 'blocked' and (v_sub.unblocked_until is null or v_sub.unblocked_until <= now()) then
    raise exception 'ALREADY_BLOCKED' using errcode = '55000';
  end if;
  if v_motivo = '' then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;

  if v_sub.status = 'blocked' then
    update public.tenant_subscriptions
    set unblocked_until = now(),
        updated_at = now()
    where id = v_sub.id;

    perform private.log_admin_action(
      'admin_block_tenant',
      p_tenant_id,
      jsonb_build_object('reason', v_motivo, 'previous_status', v_sub.status, 'ended_unblock_until', v_sub.unblocked_until)
    );
    return;
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

-- Os detalhes da assinatura de uma barbearia: tudo o que o Proprietario precisa para atender o suporte sem abrir o banco. O fuso sai
-- como o banco o usa (`private.valid_timezone`): o gravado e texto livre e um que o Intl nao conhece quebraria a tela. O desbloqueio
-- so aparece enquanto vale (um que ja acabou e o bloqueio de antes). A trilha so conta as linhas sem `tenant_id` (as da funcao
-- `private.log_admin_action`): o Gerente grava linhas com o `tenant_id` dele, e uma com a acao e o motivo falsos nao pode passar por
-- uma acao do Proprietario (nem forcar uma leitura de `audit_logs` inteira: o indice que serve a consulta e o do `tenant_id`).
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
  v_acesso record;
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

  select e.access, e.reason, e.relevant_date into v_acesso from private.tenant_access_state(p_tenant_id) e;

  return jsonb_build_object(
    'tenant', jsonb_build_object(
      'id', v_tenant.id,
      'name', v_tenant.name,
      'email', v_tenant.email,
      'phone', v_tenant.phone,
      'timezone', private.valid_timezone(v_tenant.timezone),
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
    'access', jsonb_build_object('access', v_acesso.access, 'reason', v_acesso.reason, 'relevant_date', v_acesso.relevant_date),
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
    'unblock', case when v_acesso.reason = 'unblocked' then (
      select jsonb_build_object('reason', a.details->>'reason', 'at', a.created_at, 'until', v_sub.unblocked_until)
      from public.audit_logs a
      where a.tenant_id is null and a.action = 'admin_unblock_tenant' and a.details->>'tenant_id' = p_tenant_id::text
      order by a.created_at desc
      limit 1
    ) else null end,
    'admin_actions', coalesce((
      select jsonb_agg(jsonb_build_object('action', x.action, 'at', x.created_at, 'by', u.name, 'details', x.details - 'tenant_id') order by x.created_at desc)
      from (
        select a.action, a.created_at, a.user_id, a.details
        from public.audit_logs a
        where a.tenant_id is null and a.action like 'admin\_%' and a.details->>'tenant_id' = p_tenant_id::text
        order by a.created_at desc
        limit 20
      ) x
      left join public.users u on u.id = x.user_id
    ), '[]'::jsonb)
  );
end;
$function$;

-- Os avisos por e-mail que falharam (esgotaram as tentativas, ou o Resend recusou) nos ultimos 30 dias, com o motivo, para o
-- Proprietario perceber uma chave do Resend vencida ou um dominio sem verificacao antes de o cliente reclamar (ticket 08). `failed` e
-- terminal e nada o apaga: sem a janela o cartao nunca voltaria a "nenhum aviso falhou" depois de a chave ser trocada.
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
  where n.status = 'failed' and n.created_at > now() - interval '30 days'
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
