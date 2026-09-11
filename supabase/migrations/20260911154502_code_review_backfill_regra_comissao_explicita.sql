-- O backfill preserva a origem efetiva da regra usada no calculo estimado.
do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.backfill_financial_history(uuid,integer)'::regprocedure
  ) into v_definition;

  v_definition := replace(v_definition,
    $$        snapshot_commission_rule = case
          when ci.service_id is not null and ci.professional_id is not null then 'service'
          when ci.product_id is not null and ci.professional_id is not null then 'product'
          else 'none'
        end,$$,
    $$        snapshot_commission_rule = case
          when ci.service_id is not null
           and ci.professional_id is not null
           and (select ps.custom_commission_percentage
                from public.professional_services ps
                where ps.service_id = ci.service_id
                  and ps.professional_id = ci.professional_id
                  and ps.tenant_id = ci.tenant_id) is not null
            then 'professional_service'
          when ci.service_id is not null
           and (select s.commission_percentage
                from public.services s
                where s.id = ci.service_id
                  and s.tenant_id = ci.tenant_id) is not null
            then 'service'
          when ci.service_id is not null
           and ci.professional_id is not null
           and (select p.commission_percentage
                from public.professionals p
                where p.id = ci.professional_id
                  and p.tenant_id = ci.tenant_id) is not null
            then 'professional'
          when ci.product_id is not null then 'product'
          else 'none'
        end,$$);

  if v_definition = pg_get_functiondef('public.backfill_financial_history(uuid,integer)'::regprocedure) then
    raise exception 'Nao foi possivel localizar a regra de comissao do backfill.';
  end if;

  execute v_definition;
end;
$migration$;
