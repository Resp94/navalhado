-- Spec 052, ticket 16 (revisao de codigo): o aceite dos Termos de Uso fica atras de uma regra so.
--
-- A migration do ticket (20261002193345) escreveu a regra "o que e uma versao" (AAAA-MM-DD) tres vezes, no CHECK da tabela,
-- em accept_terms e em handle_new_user, e ela aceitava o que nao e data (2026-02-30, 0000-00-00) e a data que ainda nao chegou:
-- quem chamava accept_terms('2999-12-31') "aceitava" de antemao uma versao que o produto publicasse com essa data, e o porteiro
-- a dava como aceita sem o Gerente ver o texto. Agora:
--
-- public.terms_version_valida(texto): o formato AAAA-MM-DD e uma data que existe. Imutavel; o CHECK da tabela a usa.
-- private.terms_version_aceitavel(texto): valida e ja publicada (nao e posterior a hoje, no fuso de Sao Paulo). Estavel (usa
--   now()); accept_terms e handle_new_user a usam. Quem escreve o aceite recusa a versao futura; o CHECK so confere a forma.
-- accept_terms: recusa tambem o usuario desativado (private.get_auth_role() so devolve o papel de quem tem is_active), como o
--   resto do banco ("desativado recusado em toda escrita"), e a versao que nao e aceitavel (INVALID_VERSION).
-- handle_new_user: a do ticket 03, mais o aceite do cadastro no fim, agora pela mesma regra. Quem reescrever esta funcao precisa
--   manter o bloco do aceite (o pgTAP 79, secao D, fica vermelho se ele sumir).

-- 1. A regra da versao ------------------------------------------------------------------------------------------------------------
create or replace function public.terms_version_valida(p_version text)
returns boolean
language plpgsql
immutable
set search_path to ''
as $function$
begin
  if p_version is null or p_version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return false;
  end if;

  -- make_date recusa o dia que nao existe (2026-02-30), o mes 13 e o ano 0000.
  perform make_date(substr(p_version, 1, 4)::int, substr(p_version, 6, 2)::int, substr(p_version, 9, 2)::int);
  return true;
exception when others then
  return false;
end;
$function$;

revoke all on function public.terms_version_valida(text) from public, anon, authenticated;

create or replace function private.terms_version_aceitavel(p_version text)
returns boolean
language sql
stable
set search_path to ''
as $function$
  select case
    when public.terms_version_valida(p_version)
      then p_version::date <= (now() at time zone 'America/Sao_Paulo')::date
    else false
  end;
$function$;

revoke all on function private.terms_version_aceitavel(text) from public, anon, authenticated;

alter table public.terms_acceptances drop constraint terms_acceptances_version_check;
alter table public.terms_acceptances
  add constraint terms_acceptances_version_check check (public.terms_version_valida(version));

-- 2. Aceitar -------------------------------------------------------------------------------------------------------------------
create or replace function public.accept_terms(p_version text)
returns timestamptz
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_accepted_at timestamptz;
begin
  -- Sem usuario na sessao, ou sem linha ativa em public.users (o login anonimo nao tem; o desativado nao escreve), nao ha quem aceite.
  if v_user_id is null or (select private.get_auth_role()) is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not private.terms_version_aceitavel(p_version) then
    raise exception 'INVALID_VERSION' using errcode = '22023';
  end if;

  insert into public.terms_acceptances (user_id, version)
  values (v_user_id, p_version)
  on conflict (user_id, version) do nothing;

  select a.accepted_at into v_accepted_at
  from public.terms_acceptances a
  where a.user_id = v_user_id and a.version = p_version;

  return v_accepted_at;
end;
$function$;

-- 3. Cadastro: o aceite da tela de cadastro --------------------------------------------------------------------------------------
-- Igual a do ticket 03, mais o aceite no fim. A versao que nao e aceitavel (ausente, mal formada, impossivel ou futura) nao
-- grava nada e nao derruba a criacao da conta: o Gerente aceita na primeira entrada, pela tela de aceite.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_signup jsonb := new.raw_user_meta_data -> 'tenant_signup';
  v_terms_version text := new.raw_user_meta_data ->> 'terms_version';
  v_tenant_id uuid;
  v_plan_id uuid;
  v_tenant_name text;
  v_tenant_email text;
  v_tenant_phone text;
  v_plan_text text;
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;

  if jsonb_typeof(v_signup) = 'object' then
    v_tenant_name := btrim(v_signup ->> 'name');
    v_tenant_email := lower(btrim(v_signup ->> 'email'));
    v_tenant_phone := regexp_replace(coalesce(v_signup ->> 'phone', ''), '[^0-9]', '', 'g');
    v_plan_text := lower(btrim(coalesce(v_signup ->> 'plan_id', '')));

    -- Compatibilidade transitoria com o front anterior ao ticket 01, que manda o
    -- nome do plano em tenant_signup.plan. Os UUIDs nao mudaram: bronze, prata e
    -- ouro apontam para Tesoura, Maquina e Bancada. Remover quando o front novo
    -- estiver em todos os ambientes.
    if v_plan_text = '' then
      v_plan_text := case lower(btrim(coalesce(v_signup ->> 'plan', '')))
        when 'bronze' then 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11'
        when 'prata' then 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22'
        when 'ouro' then 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c33'
        else ''
      end;
    end if;

    if length(v_tenant_name) < 2 then
      raise exception 'INVALID_TENANT_NAME' using errcode = '22023';
    end if;
    if not public.email_valido(v_tenant_email) then
      raise exception 'INVALID_TENANT_EMAIL' using errcode = '22023';
    end if;
    if length(v_tenant_phone) not between 10 and 11 then
      raise exception 'INVALID_TENANT_PHONE' using errcode = '22023';
    end if;

    -- Compara como texto para que um id mal formado caia em INVALID_PLAN
    -- em vez de estourar um erro de conversao de uuid.
    select id into v_plan_id
    from public.plans
    where id::text = v_plan_text;

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

    insert into public.tenant_subscriptions (tenant_id, plan_id, status, trial_ends_at)
    values (v_tenant_id, v_plan_id, 'trialing', now() + interval '15 days');
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

  -- Aceite dos Termos de Uso marcado na tela de cadastro (ticket 16). Quem reescrever esta funcao precisa manter este bloco.
  if private.terms_version_aceitavel(v_terms_version) then
    insert into public.terms_acceptances (user_id, version)
    values (new.id, v_terms_version);
  end if;

  return new;
end;
$function$;
