-- Ticket 08 da spec 034: extrato cronologico da Conta do Profissional.
--
-- Contrato de leitura unico para gestor e profissional: vale, gorjeta e
-- quitacao numa sequencia cronologica (mais recente primeiro), cada linha
-- com tipo, valor, direcao, motivo e estado -- incluindo lancamentos
-- estornados, que aparecem como estornados (com autor e razao) em vez de
-- desaparecerem do historico. O saldo corrente reaproveita o mesmo calculo
-- ja testado de get_professional_commission_balance, em vez de duplicar a
-- logica de saldo aqui.
create or replace function public.get_professional_account_statement(
  p_professional_id uuid,
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_entries jsonb;
  v_balance jsonb;
begin
  select role, tenant_id into v_user_role, v_user_tenant
  from public.users where id = v_user_id and is_active = true;
  if v_user_role is null then
    raise exception 'Acesso negado para consultar o extrato.' using errcode = '42501';
  end if;

  if v_user_role = 'barbeiro' then
    select p.tenant_id into v_target_tenant
    from public.professionals p
    where p.id = p_professional_id
      and p.user_id = v_user_id
      and p.is_active = true
      and p.deleted_at is null;
    if not found or (p_tenant_id is not null and v_target_tenant <> p_tenant_id) then
      raise exception 'Acesso negado para este extrato.' using errcode = '42501';
    end if;
  elsif v_user_role in ('gerente', 'proprietario') then
    if p_tenant_id is not null then
      if v_user_role <> 'proprietario' and v_user_tenant <> p_tenant_id then
        raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
      end if;
      v_target_tenant := p_tenant_id;
    else
      v_target_tenant := v_user_tenant;
    end if;
  else
    raise exception 'Acesso negado para consultar o extrato.' using errcode = '42501';
  end if;

  if v_target_tenant is null then
    raise exception 'Unidade nao informada.' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(entry order by entry_created_at desc, entry_id desc), '[]'::jsonb)
    into v_entries
  from (
    select
      e.id as entry_id,
      e.created_at as entry_created_at,
      jsonb_build_object(
        'kind', e.entry_type,
        'id', e.id,
        'amount', e.amount,
        'settled_amount', e.settled_amount,
        'direction', e.direction,
        'reason', e.reason,
        'status', e.status,
        'comanda_id', e.comanda_id,
        'created_at', e.created_at,
        'created_by', e.created_by,
        'reversed_at', e.reversed_at,
        'reversed_by', e.reversed_by,
        'reversal_reason', e.reversal_reason
      ) as entry
    from public.professional_account_entries e
    where e.tenant_id = v_target_tenant
      and e.professional_id = p_professional_id

    union all

    select
      p.id as entry_id,
      p.paid_at as entry_created_at,
      jsonb_build_object(
        'kind', 'quitacao',
        'id', p.id,
        'amount', p.amount,
        'advance_amount', p.advance_amount,
        'credit_amount', p.credit_amount,
        'direction', 'debit',
        'reason', p.notes,
        'status', case when p.reversed_at is not null then 'reversed' else 'paid' end,
        'payment_method', p.payment_method,
        'created_at', p.paid_at,
        'created_by', p.created_by,
        'reversed_at', p.reversed_at,
        'reversed_by', p.reversed_by,
        'reversal_reason', p.reversal_reason
      ) as entry
    from public.commission_payouts p
    where p.tenant_id = v_target_tenant
      and p.professional_id = p_professional_id
  ) unified;

  v_balance := public.get_professional_commission_balance(p_professional_id, null, null, v_target_tenant);

  return jsonb_build_object(
    'entries', v_entries,
    'current_balance', v_balance
  );
end;
$function$;

revoke all on function public.get_professional_account_statement(uuid, uuid) from public, anon;
grant execute on function public.get_professional_account_statement(uuid, uuid) to authenticated;
