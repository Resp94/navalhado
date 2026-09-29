-- Spec 052, ticket 05 (roteiro manual no DEV): autorizacao da assinatura no Mercado Pago.
--
-- Dois fatos vistos no Mercado Pago real:
--
-- 1. A assinatura autorizada traz so a bandeira do cartao (payment_method_id) e um card_id; o
--    final do cartao so vem no pagamento. A bandeira passa a ser gravada sozinha, e o final
--    fica nulo ate a primeira cobranca aprovada preencher.
--
-- 2. O Mercado Pago converte o start_date em "N dias gratis" contados da hora da autorizacao,
--    e a primeira cobranca cai em next_payment_date, que pode ser ate quase 1 dia depois do fim
--    do teste. Nessa folga a barbearia apareceria bloqueada com o cartao ja autorizado. O
--    acesso passa a valer ate a primeira cobranca (mais 1 hora para o Mercado Pago processar):
--    em teste, o fim do teste avanca; cancelada que assina de novo, o fim do periodo pago avanca.
--    So avanca, nunca encurta.
--
-- Substitui record_subscription_card, que exigia o final do cartao.

create or replace function public.record_subscription_authorization(
  p_mp_subscription_id text,
  p_card_brand text,
  p_card_last4 text,
  p_next_payment_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
begin
  update public.tenant_subscriptions s
  set card_brand = coalesce(p_card_brand, s.card_brand),
      card_last4 = coalesce(p_card_last4, s.card_last4),
      trial_ends_at = case
        when s.status = 'trialing'
             and p_next_payment_at is not null
             and p_next_payment_at + interval '1 hour' > s.trial_ends_at
          then p_next_payment_at + interval '1 hour'
        else s.trial_ends_at
      end,
      current_period_end = case
        when s.status = 'canceled'
             and p_next_payment_at is not null
             and p_next_payment_at + interval '1 hour' > s.current_period_end
          then p_next_payment_at + interval '1 hour'
        else s.current_period_end
      end,
      updated_at = now()
  where s.mp_subscription_id = p_mp_subscription_id;

  return found;
end;
$function$;

revoke all on function public.record_subscription_authorization(text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.record_subscription_authorization(text, text, text, timestamptz) to service_role;

drop function public.record_subscription_card(text, text, text);
