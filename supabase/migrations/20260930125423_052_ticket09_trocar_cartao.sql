-- Spec 052, ticket 09: trocar cartao.
--
-- A Edge Function de cobranca troca o cartao da assinatura no Mercado Pago (so com o token gerado
-- no navegador, o numero do cartao nunca passa por aqui) e chama esta funcao para gravar a bandeira
-- e o final do cartao novo, que a tela Assinatura mostra. Grava o que o provedor devolveu e nada
-- mais: nao mexe na situacao, no periodo pago nem na assinatura do Mercado Pago. Se o provedor
-- nao devolve o final, ele fica vazio, em vez de deixar o final do cartao antigo ao lado da
-- bandeira nova. Com pagamento recusado, quem limpa a recusa e o pagamento aprovado depois.

create or replace function public.record_card_change(
  p_tenant_id uuid,
  p_card_brand text,
  p_card_last4 text
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if p_card_last4 is not null and p_card_last4 !~ '^[0-9]{4}$' then
    raise exception 'Final do cartao invalido' using errcode = '22023';
  end if;
  if p_card_brand is not null and p_card_brand !~ '^[A-Za-z0-9_]{1,40}$' then
    raise exception 'Bandeira do cartao invalida' using errcode = '22023';
  end if;

  update public.tenant_subscriptions
  set card_brand = p_card_brand,
      card_last4 = p_card_last4,
      updated_at = now()
  where tenant_id = p_tenant_id;

  return found;
end;
$function$;

revoke all on function public.record_card_change(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_card_change(uuid, text, text) to service_role;
