-- Spec 052, ticket 12 (revisao): cancelar a assinatura da barbearia bloqueada.
--
-- A bloqueada por estorno, contestacao, bloqueio do Proprietario ou pagamento recusado ha mais de 5 dias costuma ter a
-- assinatura ainda viva no Mercado Pago, e ela cobra no mes seguinte (a mensalidade aprovada reativa a barbearia). O Gerente que
-- so quer sair nao tinha como cancelar: a tela de bloqueio so oferecia "Pagar".
--
-- Cancelar a assinatura da bloqueada tira a cobranca que viria; o acesso segue bloqueado, agora com o motivo "canceled": a tela
-- de bloqueio manda assinar de novo, em vez de mandar trocar o cartao de uma assinatura que nao existe mais. Cancelar nunca
-- desbloqueia. A bloqueada por teste ou cortesia vencidos nao tem assinatura paga para cancelar.

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

  if v_sub.status = 'canceled' then
    -- Sem a data do cancelamento e com assinatura no Mercado Pago, ela ja assinou de novo (record_mp_subscription tira a data):
    -- cancelar e cancelar a assinatura nova, e a barbearia volta a ter a data e a nao ter cartao. Com a data, ou a de antes
    -- sem assinatura no Mercado Pago: nada muda (clique repetido, ou o aviso que volta depois do cancelamento do Navalhado).
    if v_sub.canceled_at is null and v_sub.mp_subscription_id is not null then
      update public.tenant_subscriptions
      set canceled_at = now(),
          card_brand = null,
          card_last4 = null,
          updated_at = now()
      where tenant_id = p_tenant_id;
      return 'canceled';
    end if;
    return 'already_canceled';
  end if;

  -- Ha cobranca recorrente para parar. O acesso vai ate o fim do periodo pago, que o Estado de Acesso calcula; com o
  -- pagamento recusado o periodo ja acabou e o acesso fecha na hora. O cartao sai: nada o cobra mais.
  if v_sub.status in ('active', 'past_due') then
    update public.tenant_subscriptions
    set status = 'canceled',
        canceled_at = now(),
        card_brand = null,
        card_last4 = null,
        updated_at = now()
    where tenant_id = p_tenant_id;
    return 'canceled';
  end if;

  -- Bloqueada com assinatura no Mercado Pago: o acesso segue bloqueado e o motivo passa a ser canceled (quem foi bloqueado por
  -- teste ou cortesia vencidos nao tem assinatura paga para cancelar). Se o motivo ja e canceled (a rotina diaria bloqueou a
  -- cancelada), so a que assinou de novo, sem a data do cancelamento, tem o que cancelar.
  if v_sub.status = 'blocked' and v_sub.mp_subscription_id is not null then
    if v_sub.blocked_reason = 'canceled' and v_sub.canceled_at is not null then
      return 'already_canceled';
    end if;
    if v_sub.blocked_reason is null or v_sub.blocked_reason in ('payment_failed', 'refunded', 'charged_back', 'canceled') then
      update public.tenant_subscriptions
      set blocked_reason = 'canceled',
          canceled_at = now(),
          card_brand = null,
          card_last4 = null,
          updated_at = now()
      where tenant_id = p_tenant_id;
      return 'canceled';
    end if;
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
