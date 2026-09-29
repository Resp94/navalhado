-- Spec 052, ticket 01: catalogo Tesoura, Maquina e Bancada.
--
-- 1. Os tres planos sao renomeados pelo UUID, com o preco e o limite novos.
--    As assinaturas existentes continuam apontando para o mesmo plano:
--    Bronze vira Tesoura, Prata vira Maquina, Ouro vira Bancada.
-- 2. A coluna features sai: todos os planos tem todos os recursos e nenhuma
--    funcao, view ou tela a le (conferido antes da migration).
-- 3. O cadastro de barbearia liga o plano pelo id (tenant_signup.plan_id) e nao
--    mais pelo nome em minusculas. Renomear um plano deixa de quebrar o cadastro.
--    Enquanto o front anterior ainda estiver no ar, o campo antigo
--    tenant_signup.plan (bronze, prata, ouro) continua aceito.
--
-- Os tres UPDATE filtram por UUID. Se algum ambiente tiver planos com outros
-- UUIDs, a migration falha inteira (nada e renomeado e features nao e removida)
-- em vez de passar sem mudar o catalogo.

do $$
declare
  v_linhas integer;
  v_atualizados integer := 0;
begin
  update public.plans
  set name = 'Tesoura', price = 59.90, max_professionals = 1, updated_at = now()
  where id = 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11';
  get diagnostics v_linhas = row_count;
  v_atualizados := v_atualizados + v_linhas;

  update public.plans
  set name = 'Máquina', price = 89.90, max_professionals = 5, updated_at = now()
  where id = 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22';
  get diagnostics v_linhas = row_count;
  v_atualizados := v_atualizados + v_linhas;

  update public.plans
  set name = 'Bancada', price = 159.90, max_professionals = 10, updated_at = now()
  where id = 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c33';
  get diagnostics v_linhas = row_count;
  v_atualizados := v_atualizados + v_linhas;

  if v_atualizados <> 3 then
    raise exception 'CATALOGO_DE_PLANOS_INESPERADO: % de 3 planos encontrados pelo UUID', v_atualizados;
  end if;
end;
$$;

alter table public.plans drop column features;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_signup jsonb := new.raw_user_meta_data -> 'tenant_signup';
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
$function$;
