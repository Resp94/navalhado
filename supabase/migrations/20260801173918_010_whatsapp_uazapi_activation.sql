-- Ticket 03: retain the provider identifier returned by Uazapi.
-- The value is backend metadata and is intentionally excluded from browser grants.
alter table public.whatsapp_instances
  add column if not exists provider_instance_id text;

create unique index if not exists whatsapp_instances_provider_instance_id_uidx
on public.whatsapp_instances (provider_instance_id)
where provider_instance_id is not null;

alter table public.whatsapp_instances replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'whatsapp_instances'
  ) then
    execute 'alter publication supabase_realtime add table public.whatsapp_instances';
  end if;
end
$$;
