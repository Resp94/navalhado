-- Mantem os valores historicos disponiveis de itens legados sem consultar
-- precos, custos ou comissoes atuais do catalogo.
do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.get_tenant_financial_metrics(timestamptz,timestamptz,uuid)'::regprocedure
  ) into v_definition;

  v_definition := replace(v_definition,
    $$      case
        when ci.snapshot_status in ('confirmed', 'estimated') and ci.snapshot_net_amount is not null
          then ci.snapshot_net_amount
        else 0.00
      end as recognized_revenue,$$,
    $$      case
        when ci.snapshot_status in ('confirmed', 'estimated') and ci.snapshot_net_amount is not null
          then ci.snapshot_net_amount
        when ci.snapshot_status = 'unavailable' and ci.total_price is not null
          then ci.total_price
        else 0.00
      end as recognized_revenue,$$);

  v_definition := replace(v_definition,
    $$      case
        when ci.snapshot_status in ('confirmed', 'estimated') and ci.snapshot_gross_amount is not null
          then ci.snapshot_gross_amount
        else 0.00
      end as recognized_gross,$$,
    $$      case
        when ci.snapshot_status in ('confirmed', 'estimated') and ci.snapshot_gross_amount is not null
          then ci.snapshot_gross_amount
        when ci.snapshot_status = 'unavailable' and ci.total_price is not null
          then ci.total_price
        else 0.00
      end as recognized_gross,$$);

  v_definition := replace(v_definition,
    $$      case
        when ci.snapshot_status in ('confirmed', 'estimated') then coalesce(ci.snapshot_quantity, ci.quantity)
        else 0
      end as recognized_quantity,$$,
    $$      case
        when ci.snapshot_status in ('confirmed', 'estimated') then coalesce(ci.snapshot_quantity, ci.quantity)
        when ci.snapshot_status = 'unavailable' then coalesce(ci.quantity, 0)
        else 0
      end as recognized_quantity,$$);

  if v_definition = pg_get_functiondef(
    'public.get_tenant_financial_metrics(timestamptz,timestamptz,uuid)'::regprocedure
  ) then
    raise exception 'Nao foi possivel localizar os trechos esperados da metrica historica.';
  end if;

  execute v_definition;
end;
$migration$;
