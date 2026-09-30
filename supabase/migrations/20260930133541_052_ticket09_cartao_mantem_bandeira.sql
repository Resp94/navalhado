-- Spec 052, ticket 09 (revisao de codigo): trocar cartao sem bandeira nova.
--
-- record_card_change gravava card_brand = NULL quando o provedor nao devolvia a bandeira. So que
-- card_brand e o que marca, em teste, a assinatura como "cartao autorizado": apply_subscription_payment
-- so abre o prazo de 5 dias de uma cobranca recusada em teste se ha bandeira, e a tela Assinatura decide
-- entre "Assinar" e "Trocar cartao" por ela. Sem bandeira nova, a que estava continua, como ja faz
-- record_subscription_authorization. O final segue sendo o que o provedor devolveu (ou vazio): o final
-- do cartao antigo nao fica ao lado de um cartao que pode ser outro.

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
  set card_brand = coalesce(p_card_brand, card_brand),
      card_last4 = p_card_last4,
      updated_at = now()
  where tenant_id = p_tenant_id;

  return found;
end;
$function$;

revoke all on function public.record_card_change(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_card_change(uuid, text, text) to service_role;
