-- Ticket 14: backfill conservador; estimativas nunca sao tratadas como confirmadas.
alter table public.comanda_itens add column if not exists snapshot_data_quality text;

alter table public.comanda_itens drop constraint if exists comanda_itens_snapshot_status_check;
alter table public.comanda_itens add constraint comanda_itens_snapshot_status_check
  check (snapshot_status is null or snapshot_status in ('confirmed', 'estimated', 'unavailable', 'reverted'));
alter table public.comanda_itens drop constraint if exists comanda_itens_snapshot_data_quality_check;
alter table public.comanda_itens add constraint comanda_itens_snapshot_data_quality_check
  check (snapshot_data_quality is null or snapshot_data_quality in ('confirmed', 'estimated', 'unavailable'));

create index if not exists idx_comanda_itens_snapshot_quality
  on public.comanda_itens (tenant_id, snapshot_data_quality);

create or replace function public.backfill_financial_history(
  p_tenant_id uuid default null,
  p_batch_size integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_updated integer := 0;
  v_unavailable integer := 0;
  v_limit integer := greatest(1, least(coalesce(p_batch_size, 500), 5000));
begin
  select role, tenant_id into v_role, v_user_tenant
  from public.users where id = v_user_id and is_active = true;
  if v_role is null or v_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado para backfill financeiro.' using errcode = '42501';
  end if;
  if p_tenant_id is not null then
    if v_role <> 'proprietario' and v_user_tenant <> p_tenant_id then
      raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
    end if;
    v_target_tenant := p_tenant_id;
  else
    v_target_tenant := v_user_tenant;
  end if;

  with candidates as (
    select ci.id
    from public.comanda_itens ci
    join public.comandas c on c.id = ci.comanda_id
    where c.status = 'fechada'
      and ci.snapshot_status is null
      and (v_target_tenant is null or ci.tenant_id = v_target_tenant)
      and ci.quantity is not null and ci.quantity > 0
      and ci.unit_price is not null and ci.unit_price >= 0
      and ci.total_price is not null and ci.total_price >= 0
      and c.discount_amount = 0
      and (ci.item_type in ('servico', 'service', 'produto', 'product'))
      and (ci.service_id is not null or ci.product_id is not null)
    order by ci.created_at, ci.id
    limit v_limit
  ), updated_rows as (
    update public.comanda_itens ci
    set snapshot_quantity = ci.quantity,
        snapshot_unit_price = ci.unit_price,
        snapshot_gross_amount = ci.total_price,
        snapshot_discount_amount = 0,
        snapshot_net_amount = ci.total_price,
        snapshot_unit_cost = case when ci.product_id is not null then coalesce((select p.cost_price from public.products p where p.id = ci.product_id and p.tenant_id = ci.tenant_id), 0) else null end,
        snapshot_commission_percentage = case
          when ci.service_id is not null then coalesce(
            (select ps.custom_commission_percentage from public.professional_services ps where ps.service_id = ci.service_id and ps.professional_id = ci.professional_id and ps.tenant_id = ci.tenant_id),
            (select s.commission_percentage from public.services s where s.id = ci.service_id and s.tenant_id = ci.tenant_id),
            (select p.commission_percentage from public.professionals p where p.id = ci.professional_id and p.tenant_id = ci.tenant_id), 0)
          when ci.product_id is not null then coalesce((select p.commission_percentage from public.products p where p.id = ci.product_id and p.tenant_id = ci.tenant_id), 0)
          else 0
        end,
        snapshot_commission_amount = round(ci.total_price * case
          when ci.service_id is not null then coalesce(
            (select ps.custom_commission_percentage from public.professional_services ps where ps.service_id = ci.service_id and ps.professional_id = ci.professional_id and ps.tenant_id = ci.tenant_id),
            (select s.commission_percentage from public.services s where s.id = ci.service_id and s.tenant_id = ci.tenant_id),
            (select p.commission_percentage from public.professionals p where p.id = ci.professional_id and p.tenant_id = ci.tenant_id), 0)
          when ci.product_id is not null then coalesce((select p.commission_percentage from public.products p where p.id = ci.product_id and p.tenant_id = ci.tenant_id), 0)
          else 0
        end / 100, 2),
        snapshot_commission_rule = case
          when ci.service_id is not null and ci.professional_id is not null then 'service'
          when ci.product_id is not null and ci.professional_id is not null then 'product'
          else 'none'
        end,
        snapshot_status = 'estimated',
        snapshot_data_quality = 'estimated'
    where ci.id in (select id from candidates)
    returning ci.id
  )
  select count(*) into v_updated from updated_rows;

  select count(*) into v_unavailable
  from public.comanda_itens ci
  join public.comandas c on c.id = ci.comanda_id
  where c.status = 'fechada'
    and ci.snapshot_status is null
    and (v_target_tenant is null or ci.tenant_id = v_target_tenant);

  return jsonb_build_object(
    'tenant_id', v_target_tenant,
    'batch_size', v_limit,
    'estimated_updated', v_updated,
    'unavailable_remaining', v_unavailable
  );
end;
$$;

revoke all on function public.backfill_financial_history(uuid, integer) from public, anon;
grant execute on function public.backfill_financial_history(uuid, integer) to authenticated;

