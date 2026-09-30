-- Spec 052, ticket 10: subir de plano com diferenca proporcional.
--
-- A Edge Function de cobranca calcula a diferenca proporcional aos dias que faltam no periodo pago e a
-- cobra no provedor, no cartao que o Gerente digita nos campos seguros. Estas duas funcoes sao o que
-- ela usa no banco. Toda escrita vem do service_role: nem o Gerente troca o plano por fora.
--
-- get_plan_change_context: o que a funcao precisa para cotar e cobrar (situacao, plano atual e o de
--   destino, periodo pago e profissionais ativos). Sem linha se a barbearia nao tem assinatura ou o
--   plano nao existe.
--
-- apply_plan_change: troca o plano na hora. O gatilho do limite de profissionais (ticket 02) le o plano
--   da assinatura, entao o limite novo vale junto. Com o id do pagamento, grava a cobranca da diferenca
--   no historico (como upgrade); sem ele (em teste, ou diferenca abaixo do minimo do provedor) so troca.
--   A funcao nao sabe se devia haver cobranca: quem chama decide, e so chama depois de o pagamento ser
--   aprovado. Ela garante o que o banco garante: so assinatura em teste ou ativa troca; a ativa so sobe;
--   o plano de destino tem de comportar os profissionais ativos; e o mesmo pagamento aplicado de novo
--   (aviso repetido, duplo clique) nao troca nem grava nada outra vez.
--   O cartao da assinatura nao muda: o cartao do pagamento e o que o Gerente digitou so para a diferenca.
--   Uma descida agendada (ticket 11) some: o que o Gerente pediu por ultimo vale.

-- 1. Contexto da troca ----------------------------------------------------------------------------------------------
create or replace function public.get_plan_change_context(p_tenant_id uuid, p_plan_id uuid)
returns table (
  status text,
  mp_subscription_id text,
  current_plan_id uuid,
  current_plan_price numeric,
  target_plan_id uuid,
  target_plan_name text,
  target_plan_price numeric,
  target_max_professionals integer,
  current_period_start timestamptz,
  current_period_end timestamptz,
  active_professionals integer
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    s.status,
    s.mp_subscription_id,
    s.plan_id,
    cp.price,
    tp.id,
    tp.name,
    tp.price,
    tp.max_professionals,
    s.current_period_start,
    s.current_period_end,
    (
      select count(*)::integer
      from public.professionals pr
      where pr.tenant_id = s.tenant_id
        and pr.deleted_at is null
    )
  from public.tenant_subscriptions s
  join public.plans cp on cp.id = s.plan_id
  join public.plans tp on tp.id = p_plan_id
  where s.tenant_id = p_tenant_id;
$function$;

revoke all on function public.get_plan_change_context(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_plan_change_context(uuid, uuid) to service_role;

-- 2. Troca do plano -------------------------------------------------------------------------------------------------
create or replace function public.apply_plan_change(
  p_tenant_id uuid,
  p_plan_id uuid,
  p_mp_payment_id text,
  p_amount numeric,
  p_charged_at timestamptz,
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
  v_target public.plans%rowtype;
  v_current_price numeric;
  v_active integer;
  v_previous text;
begin
  if p_card_last4 is not null and p_card_last4 !~ '^[0-9]{4}$' then
    raise exception 'Final do cartao invalido' using errcode = '22023';
  end if;
  if p_card_brand is not null and p_card_brand !~ '^[A-Za-z0-9_]{1,40}$' then
    raise exception 'Bandeira do cartao invalida' using errcode = '22023';
  end if;

  select * into v_target from public.plans where id = p_plan_id;
  if not found then
    raise exception 'PLAN_NOT_FOUND: o plano nao existe.' using errcode = '22023';
  end if;

  -- O mesmo lock do gatilho do limite de profissionais: um cadastro em andamento termina antes da
  -- contagem abaixo, e o cadastro seguinte ja enxerga o plano novo.
  perform 1 from public.tenants where id = p_tenant_id for no key update;

  select * into v_sub from public.tenant_subscriptions where tenant_id = p_tenant_id for update;
  if not found or v_sub.status not in ('trialing', 'active') then
    raise exception 'SUBSCRIPTION_NOT_UPDATABLE: a assinatura do tenant nao aceita trocar de plano.'
      using errcode = '55000';
  end if;

  if v_sub.plan_id = p_plan_id then
    -- O pagamento ja foi aplicado (aviso repetido, duplo clique): nada a fazer.
    if p_mp_payment_id is not null then
      select c.status into v_previous from public.billing_charges c where c.mp_payment_id = p_mp_payment_id;
      if v_previous = 'approved' then
        return 'duplicate';
      end if;
    end if;
    raise exception 'PLAN_UNCHANGED: a barbearia ja esta neste plano.' using errcode = '22023';
  end if;

  -- Na assinatura ativa so se sobe: descer vale so na proxima cobranca (ticket 11).
  if v_sub.status = 'active' then
    select p.price into v_current_price from public.plans p where p.id = v_sub.plan_id;
    if v_target.price <= v_current_price then
      raise exception 'PLAN_NOT_HIGHER: na assinatura ativa so se troca para um plano mais caro.'
        using errcode = '22023';
    end if;
  end if;

  select count(*)::integer into v_active
  from public.professionals
  where tenant_id = p_tenant_id
    and deleted_at is null;
  if v_active > v_target.max_professionals then
    raise exception 'PLAN_BELOW_ACTIVE_PROFESSIONALS'
      using errcode = '53400', detail = format('profissionais_ativos=%s limite=%s', v_active, v_target.max_professionals);
  end if;

  update public.tenant_subscriptions
  set plan_id = p_plan_id,
      scheduled_plan_id = null,
      updated_at = now()
  where tenant_id = p_tenant_id;

  -- A cobranca da diferenca entra no historico como upgrade. Se o webhook ja a gravou, nada muda.
  if p_mp_payment_id is not null then
    perform public.apply_subscription_payment(
      p_tenant_id, p_mp_payment_id, null, 'approved', p_amount, p_charged_at, 'upgrade', p_card_brand, p_card_last4
    );
  end if;

  return 'changed';
end;
$function$;

revoke all on function public.apply_plan_change(uuid, uuid, text, numeric, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.apply_plan_change(uuid, uuid, text, numeric, timestamptz, text, text) to service_role;
