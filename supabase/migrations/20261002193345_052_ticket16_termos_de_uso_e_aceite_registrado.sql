-- Spec 052, ticket 16: Termos de Uso e aceite registrado.
--
-- O aceite dos Termos de Uso e da Politica de Privacidade e gravado por usuario, com a versao do texto (a data de
-- publicacao dele, AAAA-MM-DD) e a data do aceite, que e a do relogio do banco. Quem decide qual e a versao atual e o front
-- (os textos moram no codigo, versionados por data): o banco so guarda o que cada usuario aceitou, e o Gerente sem aceite da
-- versao atual ve a tela de aceite antes do painel.
--
-- terms_acceptances: uma linha por usuario e versao. O navegador so le a propria linha e grava pela funcao accept_terms:
--   nenhuma politica deixa escrever. Apagar o usuario apaga os aceites dele.
-- accept_terms(p_version): grava o aceite de quem chama (auth.uid()) e devolve a data do aceite. Aceitar a mesma versao de novo
--   devolve a data do primeiro aceite e nao muda nada. So aceita quem tem linha em public.users (o login anonimo nao tem).
-- handle_new_user: o cadastro grava o aceite da versao que a tela de cadastro manda em raw_user_meta_data.terms_version. Versao
--   ausente ou mal formada nao derruba a criacao da conta: o Gerente aceita na primeira entrada, pela tela de aceite. Quem ja
--   existia antes desta migration nao ganha aceite: ve a tela de aceite no proximo acesso.

-- 1. Aceites ----------------------------------------------------------------------------------------------------------------
create table public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  -- A data de publicacao do texto. A mesma expressao vale em accept_terms e em handle_new_user: mude as tres juntas.
  version text not null check (version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  accepted_at timestamptz not null default now(),
  unique (user_id, version)
);

alter table public.terms_acceptances enable row level security;
revoke all on public.terms_acceptances from public, anon, authenticated;
grant select on public.terms_acceptances to authenticated;

create policy terms_acceptances_select_policy on public.terms_acceptances
  for select to authenticated
  using (user_id = (select auth.uid()));

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
  -- Sem usuario na sessao, ou sem linha em public.users (o login anonimo nao tem), nao ha quem aceite.
  if v_user_id is null or not exists (select 1 from public.users u where u.id = v_user_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_version is null or p_version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
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

revoke all on function public.accept_terms(text) from public, anon;
grant execute on function public.accept_terms(text) to authenticated;

-- 3. Cadastro: o aceite da tela de cadastro --------------------------------------------------------------------------------------
-- Igual a do ticket 03, mais o aceite no fim.
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

  -- Aceite dos Termos de Uso marcado na tela de cadastro. A versao e a data de publicacao do texto; ausente ou fora do
  -- formato, nao grava nada e nao derruba a criacao da conta (o Gerente aceita na primeira entrada).
  if v_terms_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    insert into public.terms_acceptances (user_id, version)
    values (new.id, v_terms_version);
  end if;

  return new;
end;
$function$;
