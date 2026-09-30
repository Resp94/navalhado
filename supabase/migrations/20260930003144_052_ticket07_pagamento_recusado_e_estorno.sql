-- Spec 052, ticket 07: pagamento recusado, bloqueio no 5o dia, estorno e contestacao.
--
-- apply_subscription_payment (ticket 05) so tratava o pagamento aprovado; o resto entrava no
-- historico e nada mais. Agora ele traduz tambem:
--
--   - mensalidade recusada: ativa (ou em teste, no caso da primeira cobranca) vira "pagamento
--     recusado" e grava a data da primeira recusa, se ainda nao houver. O Estado de Acesso ja
--     libera com aviso ate o quinto dia dessa data e bloqueia depois; a rotina diaria grava o
--     bloqueio (ticket 03). A retentativa recusada nao mexe na data. Um pagamento aprovado depois
--     reativa (ja era assim) e limpa a data.
--   - recusa em bloqueada, cancelada ou cortesia so entra no historico: bloqueada nao ganha 5
--     dias de folga por causa de um "Pagar" recusado.
--   - recusa de upgrade so entra no historico: a barbearia continua no plano anterior.
--   - recusa de antes do inicio do periodo pago atual (aviso atrasado) so entra no historico.
--   - estorno ou contestacao: bloqueada na hora, com o motivo (refunded ou charged_back). A
--     cortesia, que e decisao do Proprietario, nao e bloqueada. O aviso repetido do mesmo tipo e
--     ignorado, para um estorno antigo nao bloquear de novo quem ja pagou outra vez.
--
-- blocked_reason ganha os dois motivos novos; a tela de bloqueio os explica.

alter table public.tenant_subscriptions
  drop constraint tenant_subscriptions_blocked_reason_check;

alter table public.tenant_subscriptions
  add constraint tenant_subscriptions_blocked_reason_check
    check (blocked_reason is null
           or blocked_reason in ('trial_expired', 'payment_failed', 'canceled', 'courtesy_expired', 'refunded', 'charged_back'));

create or replace function public.apply_subscription_payment(
  p_tenant_id uuid,
  p_mp_payment_id text,
  p_mp_subscription_id text,
  p_status text,
  p_amount numeric,
  p_charged_at timestamptz,
  p_kind text,
  p_card_brand text,
  p_card_last4 text
)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_sub public.tenant_subscriptions%rowtype;
  v_previous text;
  v_start timestamptz;
begin
  select * into v_sub from public.tenant_subscriptions where tenant_id = p_tenant_id for update;
  if not found then
    return 'ignored_no_subscription';
  end if;

  if p_mp_subscription_id is not null and v_sub.mp_subscription_id is distinct from p_mp_subscription_id then
    return 'ignored_other_subscription';
  end if;

  select c.status into v_previous from public.billing_charges c where c.mp_payment_id = p_mp_payment_id;

  -- Depois de aprovado (ou estornado), o pagamento so anda para frente: aprovado -> estornado ou
  -- contestado. Qualquer outro estado que chegue depois e repeticao.
  if v_previous in ('approved', 'refunded', 'charged_back')
     and p_status not in ('refunded', 'charged_back') then
    return 'duplicate';
  end if;

  -- Estorno ou contestacao ja registrado: o Mercado Pago avisa mais de uma vez, e um aviso
  -- repetido nao pode bloquear de novo quem ja pagou depois.
  if v_previous in ('refunded', 'charged_back') and p_status in ('refunded', 'charged_back') then
    return 'duplicate';
  end if;

  insert into public.billing_charges(
    tenant_id, mp_payment_id, mp_subscription_id, kind, status, amount, charged_at, card_brand, card_last4
  ) values (
    p_tenant_id, p_mp_payment_id, p_mp_subscription_id, p_kind, p_status, p_amount, p_charged_at, p_card_brand, p_card_last4
  )
  on conflict (mp_payment_id) do update
  set status = excluded.status,
      amount = excluded.amount,
      charged_at = excluded.charged_at,
      card_brand = coalesce(excluded.card_brand, public.billing_charges.card_brand),
      card_last4 = coalesce(excluded.card_last4, public.billing_charges.card_last4),
      updated_at = now();

  -- Mensalidade recusada.
  if p_status = 'rejected' then
    if p_kind <> 'recurring' then
      return 'recorded';
    end if;
    if v_sub.status not in ('active', 'trialing', 'past_due') then
      return 'recorded';
    end if;
    if v_sub.status = 'active'
       and v_sub.current_period_start is not null
       and p_charged_at < v_sub.current_period_start then
      return 'recorded';
    end if;

    update public.tenant_subscriptions
    set status = 'past_due',
        first_failed_at = coalesce(first_failed_at, p_charged_at),
        updated_at = now()
    where tenant_id = p_tenant_id;

    return case when v_sub.status = 'past_due' then 'recorded' else 'payment_failed' end;
  end if;

  -- Estorno ou contestacao: bloqueada na hora.
  if p_status in ('refunded', 'charged_back') then
    if v_sub.status not in ('trialing', 'active', 'past_due', 'canceled') then
      return 'recorded';
    end if;

    update public.tenant_subscriptions
    set status = 'blocked',
        blocked_at = now(),
        blocked_reason = p_status,
        updated_at = now()
    where tenant_id = p_tenant_id;

    return 'blocked';
  end if;

  if p_status <> 'approved' then
    return 'recorded';
  end if;
  if p_kind <> 'recurring' then
    return 'recorded';
  end if;

  if v_sub.status = 'active'
     and v_sub.current_period_end is not null
     and p_charged_at >= v_sub.current_period_end - interval '3 days'
     and p_charged_at < v_sub.current_period_end + interval '7 days' then
    v_start := v_sub.current_period_end;
  else
    v_start := p_charged_at;
  end if;

  update public.tenant_subscriptions
  set status = 'active',
      current_period_start = v_start,
      current_period_end = v_start + interval '1 month',
      first_failed_at = null,
      blocked_at = null,
      blocked_reason = null,
      canceled_at = null,
      courtesy_ends_at = null,
      card_brand = coalesce(p_card_brand, card_brand),
      card_last4 = coalesce(p_card_last4, card_last4),
      updated_at = now()
  where tenant_id = p_tenant_id;

  return case when v_sub.status = 'active' then 'renewed' else 'activated' end;
end;
$function$;

revoke all on function public.apply_subscription_payment(uuid, text, text, text, numeric, timestamptz, text, text, text) from public, anon, authenticated;
grant execute on function public.apply_subscription_payment(uuid, text, text, text, numeric, timestamptz, text, text, text) to service_role;
