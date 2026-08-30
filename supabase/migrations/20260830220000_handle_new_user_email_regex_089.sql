-- Migration 089: reconcilia a expressão regular de e-mail do trigger de Auth.
--
-- O comportamento de usuários anônimos permanece inalterado: eles não são
-- projetados em public.users. Esta migration apenas garante que a validação
-- de e-mail tenha uma única barra de escape antes do ponto literal, evitando
-- aceitar formatos inválidos por divergência entre ambientes.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_signup jsonb := new.raw_user_meta_data -> 'tenant_signup';
  v_tenant_id uuid;
  v_plan_id uuid;
  v_tenant_name text;
  v_tenant_email text;
  v_tenant_phone text;
  v_plan text;
BEGIN
  IF COALESCE(new.is_anonymous, false) THEN
    RETURN new;
  END IF;

  IF jsonb_typeof(v_signup) = 'object' THEN
    v_tenant_name := btrim(v_signup ->> 'name');
    v_tenant_email := lower(btrim(v_signup ->> 'email'));
    v_tenant_phone := regexp_replace(coalesce(v_signup ->> 'phone', ''), '[^0-9]', '', 'g');
    v_plan := lower(btrim(v_signup ->> 'plan'));

    IF length(v_tenant_name) < 2 THEN
      RAISE EXCEPTION 'INVALID_TENANT_NAME' USING errcode = '22023';
    END IF;
    IF v_tenant_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
      RAISE EXCEPTION 'INVALID_TENANT_EMAIL' USING errcode = '22023';
    END IF;
    IF length(v_tenant_phone) NOT BETWEEN 10 AND 11 THEN
      RAISE EXCEPTION 'INVALID_TENANT_PHONE' USING errcode = '22023';
    END IF;

    SELECT id INTO v_plan_id
    FROM public.plans
    WHERE lower(name) = v_plan;

    IF v_plan_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_PLAN' USING errcode = '22023';
    END IF;

    INSERT INTO public.tenants (name, email, phone)
    VALUES (v_tenant_name, v_tenant_email, v_tenant_phone)
    RETURNING id INTO v_tenant_id;

    INSERT INTO public.users (id, email, name, role, tenant_id, is_active)
    VALUES (
      new.id,
      new.email,
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), 'Gestor'),
      'gerente',
      v_tenant_id,
      true
    );

    INSERT INTO public.tenant_subscriptions (
      tenant_id, plan_id, status, start_date, end_date, billing_cycle
    ) VALUES (
      v_tenant_id, v_plan_id, 'active', now(), now() + interval '1 month', 'monthly'
    );
  ELSE
    INSERT INTO public.users (id, email, name, role, tenant_id, is_active)
    VALUES (
      new.id,
      new.email,
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), 'Profissional Novo'),
      'barbeiro',
      null,
      true
    );
  END IF;

  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
