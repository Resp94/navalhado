-- Spec 052, ticket 12: cancelar a assinatura.
--
-- O Gerente cancela pela tela (a funcao de cobranca cancela no Mercado Pago e grava aqui) ou cancela por fora, no
-- proprio Mercado Pago (o webhook grava aqui). A cobranca recorrente para; o acesso continua, com aviso, ate o fim do
-- periodo ja pago; a rotina diaria (ticket 03, block_expired_subscriptions) grava o bloqueio depois.
--
-- 1. Estado de Acesso: a cancelada com periodo pago pela frente passa de "liberada" para "liberada com aviso", para a
--    faixa do painel dizer "Assinatura cancelada. Acesso ate DD/MM." (spec: avisos ao Gerente). O bloqueio nao muda.
-- 2. private.apply_subscription_cancellation: o que cancelar muda conforme a situacao.
--    - ativa ou com pagamento recusado: vira "canceled" com a data do cancelamento (o periodo pago fica como esta; com o
--      pagamento recusado ele ja acabou, entao o acesso fecha na hora);
--    - em teste com a assinatura autorizada no Mercado Pago: ela so guarda o cartao e a primeira cobranca, no fim do
--      teste, entao cancelar tira o cartao e o teste segue ate o fim, sem situacao nova;
--    - ja cancelada: nada muda; bloqueada, cortesia, em teste sem assinatura e sem barbearia: nao ha o que cancelar.
--    A descida de plano agendada some junto (o gatilho do ticket 11 a tira de quem sai de ativa).
-- 3. public.cancel_subscription (a funcao de cobranca) e public.record_subscription_cancellation (o webhook): so o
--    service_role executa.

-- 1. Estado de Acesso -----------------------------------------------------------------------------------------------
create or replace function private.subscription_access_state(
  sub public.tenant_subscriptions,
  p_now timestamptz
)
returns table (access text, reason text, relevant_date timestamptz)
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
      reason := 'canceled';
      relevant_date := sub.current_period_end;
      if sub.current_period_end is null or p_now >= sub.current_period_end then
        access := 'blocked';
      else
        -- Cancelou, mas o periodo ja pago vale ate o fim: liberada, com a faixa "Assinatura cancelada. Acesso ate DD/MM.".
        access := 'warning';
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

revoke all on function private.subscription_access_state(public.tenant_subscriptions, timestamptz)
  from public, anon, authenticated;

-- 2. Cancelar --------------------------------------------------------------------------------------------------------
create or replace function private.apply_subscription_cancellation(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_sub public.tenant_subscriptions%rowtype;
begin
  select * into v_sub from public.tenant_subscriptions where tenant_id = p_tenant_id for update;
  if not found then
    return 'no_subscription';
  end if;

  -- Cancelar de novo, ou o aviso do Mercado Pago que volta depois do cancelamento feito pelo Navalhado: nada muda.
  if v_sub.status = 'canceled' then
    return 'already_canceled';
  end if;

  -- Ha cobranca recorrente para parar. O acesso vai ate o fim do periodo pago, que o Estado de Acesso calcula; com o
  -- pagamento recusado o periodo ja acabou e o acesso fecha na hora.
  if v_sub.status in ('active', 'past_due') then
    update public.tenant_subscriptions
    set status = 'canceled',
        canceled_at = now(),
        updated_at = now()
    where tenant_id = p_tenant_id;
    return 'canceled';
  end if;

  -- Em teste a assinatura no Mercado Pago so guarda o cartao e a primeira cobranca, no fim do teste: cancelar tira o
  -- cartao (a tela volta a oferecer "Assinar") e o teste segue ate o fim.
  if v_sub.status = 'trialing' and v_sub.mp_subscription_id is not null then
    update public.tenant_subscriptions
    set card_brand = null,
        card_last4 = null,
        updated_at = now()
    where tenant_id = p_tenant_id;
    return 'trial_canceled';
  end if;

  return 'not_cancelable';
end;
$function$;

revoke all on function private.apply_subscription_cancellation(uuid) from public, anon, authenticated;

-- A funcao de cobranca: o Gerente cancelou pela tela e o Mercado Pago ja cancelou.
create or replace function public.cancel_subscription(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_result text;
begin
  v_result := private.apply_subscription_cancellation(p_tenant_id);

  if v_result in ('no_subscription', 'not_cancelable') then
    raise exception 'SUBSCRIPTION_NOT_CANCELABLE: a assinatura do tenant nao tem o que cancelar.'
      using errcode = '55000';
  end if;

  return v_result;
end;
$function$;

revoke all on function public.cancel_subscription(uuid) from public, anon, authenticated;
grant execute on function public.cancel_subscription(uuid) to service_role;

-- O webhook: o Mercado Pago avisa que a assinatura foi cancelada (por fora do Navalhado, ou pelo proprio Navalhado). So
-- vale a assinatura que a barbearia tem agora: o aviso da antiga, depois de assinar de novo, nao cancela a nova.
create or replace function public.record_subscription_cancellation(p_mp_subscription_id text)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_tenant_id uuid;
begin
  select s.tenant_id into v_tenant_id
  from public.tenant_subscriptions s
  where s.mp_subscription_id = p_mp_subscription_id;

  if not found then
    return 'unknown_subscription';
  end if;

  return private.apply_subscription_cancellation(v_tenant_id);
end;
$function$;

revoke all on function public.record_subscription_cancellation(text) from public, anon, authenticated;
grant execute on function public.record_subscription_cancellation(text) to service_role;
