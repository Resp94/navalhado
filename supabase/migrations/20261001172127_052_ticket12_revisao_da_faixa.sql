-- Spec 052, ticket 12 (revisao, roteiro como pessoa real): a faixa "Assinatura cancelada" nao some quando a pessoa assina de novo.
--
-- A cancelada com periodo pago pela frente tem a faixa "Assinatura cancelada. Acesso ate DD/MM." (Estado de Acesso "warning").
-- Quem assina de novo e tem a assinatura nova autorizada no Mercado Pago continua "cancelada" no banco ate a primeira cobranca
-- (no fim do periodo pago), entao o topo seguia dizendo "cancelada" enquanto a tela Assinatura ja dizia "assinatura nova
-- autorizada". Com a assinatura nova autorizada (cancelada, sem a data do cancelamento, com assinatura e com a bandeira do
-- cartao dela, que chega na autorizacao) o Estado de Acesso passa a "allowed": a cobranca recomeca no fim do periodo pago e a
-- faixa de cancelada nao se aplica. No fim do periodo, sem o pagamento da assinatura nova, bloqueia como qualquer cancelada.
-- A que assinou de novo e ainda nao autorizou, e a cancelada de antes, seguem com a faixa.

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
      relevant_date := sub.current_period_end;
      if sub.current_period_end is null or p_now >= sub.current_period_end then
        access := 'blocked';
        reason := 'canceled';
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

revoke all on function private.subscription_access_state(public.tenant_subscriptions, timestamptz)
  from public, anon, authenticated;
