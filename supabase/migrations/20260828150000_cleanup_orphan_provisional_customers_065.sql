-- Limpeza única e idempotente de clientes provisórios sem referências protegidas.
-- A rotina fica no schema privado para não fazer parte do canal público.
create or replace function private.cleanup_orphan_provisional_customers()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.customers as c
  where c.cadastro_completo is false
    and not exists (
      select 1
      from public.appointments as a
      where a.customer_id = c.id
    )
    and not exists (
      select 1
      from public.comandas as co
      where co.customer_id = c.id
    )
    and not exists (
      select 1
      from public.waiting_list as wl
      where wl.customer_id = c.id
    )
    and not exists (
      select 1
      from public.audit_logs as al
      where al.tenant_id = c.tenant_id
        and al.details::text like '%' || c.id::text || '%'
    );

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function private.cleanup_orphan_provisional_customers() from public, anon, authenticated;
grant execute on function private.cleanup_orphan_provisional_customers() to service_role;

select private.cleanup_orphan_provisional_customers();
