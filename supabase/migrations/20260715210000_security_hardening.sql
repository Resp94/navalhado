create extension if not exists btree_gist with schema extensions;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_signup jsonb := new.raw_user_meta_data -> 'tenant_signup';
  v_tenant_id uuid;
  v_plan_id uuid;
  v_tenant_name text;
  v_tenant_email text;
  v_tenant_phone text;
  v_plan text;
begin
  if jsonb_typeof(v_signup) = 'object' then
    v_tenant_name := btrim(v_signup ->> 'name');
    v_tenant_email := lower(btrim(v_signup ->> 'email'));
    v_tenant_phone := regexp_replace(coalesce(v_signup ->> 'phone', ''), '[^0-9]', '', 'g');
    v_plan := lower(btrim(v_signup ->> 'plan'));

    if length(v_tenant_name) < 2 then
      raise exception 'INVALID_TENANT_NAME' using errcode = '22023';
    end if;
    if v_tenant_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'INVALID_TENANT_EMAIL' using errcode = '22023';
    end if;
    if length(v_tenant_phone) not between 10 and 11 then
      raise exception 'INVALID_TENANT_PHONE' using errcode = '22023';
    end if;

    select id into v_plan_id
    from public.plans
    where lower(name) = v_plan;

    if v_plan_id is null then
      raise exception 'INVALID_PLAN' using errcode = '22023';
    end if;

    insert into public.tenants (name, email, phone)
    values (v_tenant_name, v_tenant_email, v_tenant_phone)
    returning id into v_tenant_id;

    insert into public.users (id, email, name, role, tenant_id, is_active)
    values (
      new.id,
      new.email,
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), 'Gestor'),
      'gerente',
      v_tenant_id,
      true
    );

    insert into public.tenant_subscriptions (
      tenant_id, plan_id, status, start_date, end_date, billing_cycle
    ) values (
      v_tenant_id, v_plan_id, 'active', now(), now() + interval '1 month', 'monthly'
    );
  else
    insert into public.users (id, email, name, role, tenant_id, is_active)
    values (
      new.id,
      new.email,
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), 'Profissional Novo'),
      'barbeiro',
      null,
      true
    );
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function private.protect_user_authority_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_auth_admin')
    and (
      new.role is distinct from old.role
      or new.tenant_id is distinct from old.tenant_id
      or new.is_active is distinct from old.is_active
    ) then
    raise exception 'USER_AUTHORITY_FIELDS_ARE_SERVER_MANAGED' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_user_authority_fields() from public, anon, authenticated;
drop trigger if exists protect_user_authority_fields on public.users;
create trigger protect_user_authority_fields
before update on public.users
for each row execute function private.protect_user_authority_fields();

drop policy if exists tenants_insert_policy on public.tenants;
revoke all on table public.tenants from anon;
revoke all on table public.users from anon;
revoke insert, delete, truncate, references, trigger on table public.users from authenticated;

alter view public.view_tenants_management set (security_invoker = true);
revoke all on table public.view_tenants_management from anon;
revoke all on table public.view_tenants_management from authenticated;
grant select on table public.view_tenants_management to authenticated;

drop policy if exists instances_select_policy on public.evolution_api_instances;
create policy instances_select_policy on public.evolution_api_instances
for select to authenticated
using (
  (select private.is_saas_admin())
  or (
    tenant_id = (select private.get_auth_tenant_id())
    and (select private.get_auth_role()) = 'gerente'
  )
);

revoke all on table public.evolution_api_instances from anon;
revoke all on table public.evolution_api_instances from authenticated;
grant select (
  id, tenant_id, instance_name, qr_code, status, created_at, updated_at,
  send_confirmation, send_reminders, send_cancellation, reminder_hours
) on public.evolution_api_instances to authenticated;
grant insert (
  tenant_id, instance_name, api_key, qr_code, status,
  send_confirmation, send_reminders, send_cancellation, reminder_hours
) on public.evolution_api_instances to authenticated;
grant update (
  qr_code, status, send_confirmation, send_reminders, send_cancellation,
  reminder_hours, updated_at
) on public.evolution_api_instances to authenticated;

create unique index if not exists evolution_api_instances_tenant_id_uidx
on public.evolution_api_instances (tenant_id);

create unique index if not exists professionals_user_id_uidx
on public.professionals (user_id)
where user_id is not null;

create or replace function private.is_own_professional(p_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.professionals p
    where p.id = p_professional_id
      and p.user_id = (select auth.uid())
      and p.tenant_id = (select private.get_auth_tenant_id())
  );
$$;

create or replace function private.is_own_appointment(p_appointment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.appointments a
    join public.professionals p on p.id = a.professional_id
    where a.id = p_appointment_id
      and p.user_id = (select auth.uid())
      and a.tenant_id = (select private.get_auth_tenant_id())
  );
$$;

revoke all on function private.is_own_professional(uuid) from public, anon;
revoke all on function private.is_own_appointment(uuid) from public, anon;
grant execute on function private.is_own_professional(uuid) to authenticated;
grant execute on function private.is_own_appointment(uuid) to authenticated;

drop policy if exists appointments_select_policy on public.appointments;
create policy appointments_select_policy on public.appointments
for select to authenticated
using (
  (select private.is_saas_admin())
  or (
    tenant_id = (select private.get_auth_tenant_id())
    and (
      (select private.get_auth_role()) = 'gerente'
      or (
        (select private.get_auth_role()) = 'barbeiro'
        and (select private.is_own_professional(professional_id))
      )
    )
  )
);

drop policy if exists appointments_insert_policy on public.appointments;
create policy appointments_insert_policy on public.appointments
for insert to authenticated
with check (
  (select private.is_saas_admin())
  or (
    tenant_id = (select private.get_auth_tenant_id())
    and (
      (select private.get_auth_role()) = 'gerente'
      or (
        (select private.get_auth_role()) = 'barbeiro'
        and (select private.is_own_professional(professional_id))
      )
    )
  )
);

drop policy if exists appointments_update_policy on public.appointments;
create policy appointments_update_policy on public.appointments
for update to authenticated
using (
  (select private.is_saas_admin())
  or (
    tenant_id = (select private.get_auth_tenant_id())
    and (
      (select private.get_auth_role()) = 'gerente'
      or (
        (select private.get_auth_role()) = 'barbeiro'
        and (select private.is_own_professional(professional_id))
      )
    )
  )
)
with check (
  (select private.is_saas_admin())
  or (
    tenant_id = (select private.get_auth_tenant_id())
    and (
      (select private.get_auth_role()) = 'gerente'
      or (
        (select private.get_auth_role()) = 'barbeiro'
        and (select private.is_own_professional(professional_id))
      )
    )
  )
);

drop policy if exists payments_select_policy on public.payments;
create policy payments_select_policy on public.payments
for select to authenticated
using (
  (select private.is_saas_admin())
  or (
    tenant_id = (select private.get_auth_tenant_id())
    and (
      (select private.get_auth_role()) = 'gerente'
      or (
        (select private.get_auth_role()) = 'barbeiro'
        and (select private.is_own_appointment(appointment_id))
      )
    )
  )
);

drop policy if exists payments_insert_policy on public.payments;
create policy payments_insert_policy on public.payments
for insert to authenticated
with check (
  (select private.is_saas_admin())
  or (
    tenant_id = (select private.get_auth_tenant_id())
    and (
      (select private.get_auth_role()) = 'gerente'
      or (
        (select private.get_auth_role()) = 'barbeiro'
        and (select private.is_own_appointment(appointment_id))
      )
    )
  )
);

set local search_path = public, extensions;
alter table public.appointments
  add constraint appointments_no_professional_overlap
  exclude using gist (
    professional_id with =,
    tstzrange(start_time, end_time, '[)') with &&
  )
  where (status in ('pending', 'confirmed'));
