-- Spec 052, ticket 13: exclusao da Instancia WhatsApp no setimo dia de bloqueio.
--
-- - whatsapp_instances.environment guarda o ambiente em que a instancia nasceu. O banco sabe o seu pelo Vault
--   (app_environment: 'dev' ou 'prod', criado a mao em cada ambiente antes desta migration, como o project_url): um
--   gatilho marca a instancia nova e esta migration marca as que ja existem. A marca e uma coluna, e nao parte do nome da
--   instancia, porque o nome e a chave que a Uazapi devolve no webhook e existe la: renomear so no banco quebraria o vinculo.
-- - private.whatsapp_instance_deletion_verdict e a regra unica da exclusao: 'due' so para a instancia deste ambiente cuja
--   barbearia esta bloqueada ha 7 dias ou mais (tenant_subscriptions.blocked_at). Instancia sem marca, ou de outro
--   ambiente, nunca e devida: o dev usa um servidor Uazapi compartilhado com a prod.
-- - A rotina diaria (03:15 UTC, depois da que grava o bloqueio, 03:05) chama a funcao do WhatsApp para cada instancia
--   devida, com o segredo interno que as outras rotinas do WhatsApp usam. O banco nao exclui nada: a funcao consulta o
--   mesmo veredito (RPC, so service_role), exclui no provedor e so entao remove a linha local. O historico de envios
--   (whatsapp_message_idempotency) fica, com a referencia nula.

-- 1. O ambiente do banco vem do Vault. Sem ele nao ha o que marcar: a migration para.
do $migration$
declare
  v_environment text;
begin
  select nullif(btrim(s.decrypted_secret), '') into v_environment
  from vault.decrypted_secrets s
  where s.name = 'app_environment'
  limit 1;

  if v_environment is null then
    raise exception 'Vault secret app_environment is required (dev or prod)';
  end if;

  if v_environment not in ('dev', 'prod') then
    raise exception 'Vault secret app_environment must be dev or prod, not %', v_environment;
  end if;
end
$migration$;

create or replace function private.runtime_environment()
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select nullif(btrim(s.decrypted_secret), '')
  from vault.decrypted_secrets s
  where s.name = 'app_environment'
  limit 1
$function$;

revoke all on function private.runtime_environment() from public, anon, authenticated;

-- 2. A marca: toda instancia que ja existe e deste banco; a nova e marcada pelo gatilho (quem informa o ambiente, como uma
-- restauracao de outro banco, mantem o que informou).
alter table public.whatsapp_instances add column environment text;

comment on column public.whatsapp_instances.environment is
  'Ambiente em que a instancia nasceu (dev ou prod). Sem ele, ou diferente do ambiente do banco, a rotina de exclusao nunca a exclui.';

update public.whatsapp_instances
set environment = private.runtime_environment()
where environment is null;

create or replace function private.set_whatsapp_instance_environment()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  new.environment := coalesce(new.environment, private.runtime_environment());
  return new;
end;
$function$;

revoke all on function private.set_whatsapp_instance_environment() from public, anon, authenticated;

drop trigger if exists whatsapp_instances_set_environment on public.whatsapp_instances;
create trigger whatsapp_instances_set_environment
  before insert on public.whatsapp_instances
  for each row execute function private.set_whatsapp_instance_environment();

-- 3. O veredito. A ordem dos testes e a da seguranca: sem marca ou de outro ambiente nunca, e so entao o bloqueio.
create or replace function private.whatsapp_instance_deletion_verdict(p_instance_id uuid, p_now timestamptz default now())
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_instance_environment text;
  v_status text;
  v_blocked_at timestamptz;
  v_runtime_environment text := private.runtime_environment();
begin
  select i.environment, s.status, s.blocked_at
  into v_instance_environment, v_status, v_blocked_at
  from public.whatsapp_instances i
  left join public.tenant_subscriptions s on s.tenant_id = i.tenant_id
  where i.id = p_instance_id;

  if not found then
    return 'not_found';
  end if;
  if v_instance_environment is null then
    return 'unidentified';
  end if;
  if v_runtime_environment is null then
    return 'runtime_unidentified';
  end if;
  if v_instance_environment <> v_runtime_environment then
    return 'other_environment';
  end if;
  if v_status is distinct from 'blocked' or v_blocked_at is null then
    return 'not_blocked';
  end if;
  if v_blocked_at > p_now - interval '7 days' then
    return 'too_recent';
  end if;
  return 'due';
end;
$function$;

revoke all on function private.whatsapp_instance_deletion_verdict(uuid, timestamptz) from public, anon, authenticated;

create or replace function private.whatsapp_instances_due_for_deletion(p_now timestamptz default now())
returns setof uuid
language sql
stable
security definer
set search_path to ''
as $function$
  select i.id
  from public.whatsapp_instances i
  where private.whatsapp_instance_deletion_verdict(i.id, p_now) = 'due'
$function$;

revoke all on function private.whatsapp_instances_due_for_deletion(timestamptz) from public, anon, authenticated;

-- A funcao do WhatsApp consulta o veredito antes de excluir (a barbearia pode ter pago entre a rotina e a exclusao).
create or replace function public.whatsapp_instance_deletion_verdict(p_instance_id uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select private.whatsapp_instance_deletion_verdict(p_instance_id, now())
$function$;

revoke all on function public.whatsapp_instance_deletion_verdict(uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_instance_deletion_verdict(uuid) to service_role;

-- 4. A rotina diaria: uma chamada para cada instancia devida. A chamada e assincrona (pg_net) e o banco nao espera a
-- resposta: a instancia que nao saiu (provedor fora do ar) segue devida e entra de novo na rodada do dia seguinte.
create or replace function private.delete_blocked_whatsapp_instances(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_project_url text;
  v_secret text;
  v_instance_id uuid;
  v_total integer := 0;
begin
  select s.decrypted_secret into v_project_url from vault.decrypted_secrets s where s.name = 'project_url' limit 1;
  select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.name = 'whatsapp_db_trigger_secret' limit 1;

  for v_instance_id in select d from private.whatsapp_instances_due_for_deletion(p_now) d loop
    if v_project_url is null or v_secret is null then
      raise exception 'Vault secrets project_url and whatsapp_db_trigger_secret are required to delete WhatsApp instances';
    end if;

    perform net.http_post(
      url := v_project_url || '/functions/v1/whatsapp-integration/delete-instance',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-db-trigger-secret', v_secret),
      body := jsonb_build_object('instance_id', v_instance_id),
      timeout_milliseconds := 30000
    );
    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$function$;

revoke all on function private.delete_blocked_whatsapp_instances(timestamptz) from public, anon, authenticated;

do $migration$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'delete-blocked-whatsapp-instances';
  perform cron.schedule(
    'delete-blocked-whatsapp-instances',
    '15 3 * * *',
    $job$select private.delete_blocked_whatsapp_instances();$job$
  );
end
$migration$;
