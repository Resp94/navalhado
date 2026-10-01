-- Spec 052, ticket 13, da revisao de codigo.
--
-- - O relogio dos 7 dias parte do instante em que o acesso acabou. Para a cancelada cujo periodo pago ja tinha acabado (o
--   Gerente cancelou depois do fim do periodo, ainda no prazo da recusa, ou o Proprietario cancelou uma barbearia de periodo
--   antigo), o estado de acesso dizia que o acesso acabou no fim do periodo antigo e a rotina que grava o bloqueio (03:05)
--   escrevia essa data em blocked_at: a instancia ficava devida na mesma noite, ou com menos de 7 dias de carencia.
--   Agora a data do bloqueio da cancelada e a maior entre o fim do periodo pago e o cancelamento.
-- - O veredito da exclusao tem 'due' como unico caso positivo: sem horario de referencia (NULL) ele nao libera nada. E espera
--   enquanto ha pagamento em andamento (cobranca em analise nos ultimos 5 dias) ou a assinatura mudou ha menos de 3 dias (a
--   pessoa esta tentando pagar, por exemplo a assinatura nova autorizada que ainda nao cobrou).
-- - O ambiente do banco so vale se for exatamente dev ou prod (o resto e como se faltasse), e a rotina diaria falha, em vez de
--   rodar calada, quando o banco nao sabe o proprio ambiente ou faltam os segredos do Vault, haja instancia devida ou nao.

-- 1. O ambiente do banco: so dev ou prod.
create or replace function private.runtime_environment()
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select btrim(s.decrypted_secret)
  from vault.decrypted_secrets s
  where s.name = 'app_environment'
    and btrim(s.decrypted_secret) in ('dev', 'prod')
  limit 1
$function$;

revoke all on function private.runtime_environment() from public, anon, authenticated;

-- 2. O estado de acesso da cancelada: o bloqueio vale desde o cancelamento, quando ele veio depois do fim do periodo pago.
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

  return next;
end;
$function$;

-- 3. O veredito: so devido quando nada manda esperar.
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
  v_updated_at timestamptz;
  v_runtime_environment text := private.runtime_environment();
begin
  select i.tenant_id, i.environment, s.status, s.blocked_at, s.updated_at
  into v_tenant_id, v_instance_environment, v_status, v_blocked_at, v_updated_at
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

-- 4. A rotina diaria: falha, em vez de rodar calada, quando falta o que ela precisa.
create or replace function private.delete_blocked_whatsapp_instances(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_project_url text;
  v_secret text;
  v_instance_id uuid;
  v_total integer := 0;
begin
  if private.runtime_environment() is null then
    raise exception 'Vault secret app_environment is required (dev or prod)';
  end if;

  select s.decrypted_secret into v_project_url from vault.decrypted_secrets s where s.name = 'project_url' limit 1;
  select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.name = 'whatsapp_db_trigger_secret' limit 1;
  if v_project_url is null or v_secret is null then
    raise exception 'Vault secrets project_url and whatsapp_db_trigger_secret are required to delete WhatsApp instances';
  end if;

  for v_instance_id in select d from private.whatsapp_instances_due_for_deletion(p_now) d loop
    perform net.http_post(
      url := v_project_url || '/functions/v1/whatsapp-integration/delete-instance',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-db-trigger-secret', v_secret),
      body := jsonb_build_object('instance_id', v_instance_id),
      timeout_milliseconds := 30000
    );
    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$function$;

revoke all on function private.delete_blocked_whatsapp_instances(timestamptz) from public, anon, authenticated;
