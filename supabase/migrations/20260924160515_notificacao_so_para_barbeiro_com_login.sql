-- Notificacao de Agendamento so vai para o barbeiro que tem login.
--
-- handle_appointment_notification criava a notificacao do barbeiro em todo
-- Agendamento, mesmo quando o profissional ainda nao tinha login. As
-- notificacoes se acumulavam sem ninguem ler e, quando o gerente criava o
-- acesso, o barbeiro recem-criado "herdava" tudo de uma vez.
--
-- 1. A notificacao do barbeiro so nasce quando o profissional esta vinculado
--    a um usuario barbeiro ativo. Profissional sem login, vinculado ao gerente
--    (que ja recebe a notificacao geral) ou com login inativo nao recebe.
--    A notificacao do gerente (professional_id nulo) nao muda.
-- 2. Notificacoes de barbeiro que ninguem poderia ter lido ficam como lidas:
--    as de profissional sem login de barbeiro ativo e as criadas antes do
--    login do barbeiro existir. O historico fica guardado.

CREATE OR REPLACE FUNCTION public.handle_appointment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_customer_name text;
  v_service_name text;
  v_professional_name text;
  v_formatted_time text;
  v_title text;
  v_message text;
  v_type text;
  v_timezone text;
  v_notify_professional boolean;
BEGIN
  -- Buscar nomes relacionados usando qualificadores de schema explícitos
  IF new.customer_id IS NOT NULL THEN
    SELECT name INTO v_customer_name FROM public.customers WHERE id = new.customer_id;
  END IF;
  v_customer_name := COALESCE(v_customer_name, 'Cliente Balcão');

  SELECT name INTO v_service_name FROM public.services WHERE id = new.service_id;
  SELECT name INTO v_professional_name FROM public.professionals WHERE id = new.professional_id;

  -- Buscar o fuso horário do tenant
  SELECT COALESCE(timezone, 'America/Sao_Paulo') INTO v_timezone FROM public.tenants WHERE id = new.tenant_id;

  -- Formatar data/hora no padrão do fuso do tenant
  v_formatted_time := to_char(new.start_time AT TIME ZONE v_timezone, 'DD/MM/YYYY "às" HH24:MI');

  -- O barbeiro só é notificado se tem login de barbeiro ativo
  v_notify_professional := EXISTS (
    SELECT 1
    FROM public.professionals p
    JOIN public.users u ON u.id = p.user_id
    WHERE p.id = new.professional_id
      AND u.role = 'barbeiro'
      AND u.is_active
  );

  -- Caso 1: Novo Agendamento (INSERT)
  IF tg_op = 'INSERT' THEN
    v_type := 'appointment_created';
    v_title := 'Novo Agendamento';
    v_message := v_customer_name || ' agendou ' || COALESCE(v_service_name, 'Serviço') || ' com ' || COALESCE(v_professional_name, 'Profissional') || ' para ' || v_formatted_time || '.';

    -- Notificação para o Gerente
    INSERT INTO public.notifications (tenant_id, professional_id, type, title, message)
    VALUES (new.tenant_id, null, v_type, v_title, v_message);

    -- Notificação para o Barbeiro
    IF v_notify_professional THEN
      INSERT INTO public.notifications (tenant_id, professional_id, type, title, message)
      VALUES (new.tenant_id, new.professional_id, v_type, v_title, v_message);
    END IF;

  -- Caso 2: Atualização (UPDATE)
  ELSIF tg_op = 'UPDATE' THEN
    -- Subcaso A: Cancelamento
    IF new.status = 'canceled' AND old.status <> 'canceled' THEN
      v_type := 'appointment_canceled';
      v_title := 'Agendamento Cancelado';
      v_message := 'O agendamento de ' || v_customer_name || ' (' || COALESCE(v_service_name, 'Serviço') || ') em ' || v_formatted_time || ' foi cancelado.';

      -- Notificação para o Gerente
      INSERT INTO public.notifications (tenant_id, professional_id, type, title, message)
      VALUES (new.tenant_id, null, v_type, v_title, v_message);

      -- Notificação para o Barbeiro
      IF v_notify_professional THEN
        INSERT INTO public.notifications (tenant_id, professional_id, type, title, message)
        VALUES (new.tenant_id, new.professional_id, v_type, v_title, v_message);
      END IF;
    END IF;
  END IF;

  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_appointment_notification() FROM PUBLIC, anon, authenticated;

UPDATE public.notifications n
SET read = true
WHERE n.read = false
  AND n.professional_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.professionals p
    JOIN public.users u ON u.id = p.user_id
    WHERE p.id = n.professional_id
      AND u.role = 'barbeiro'
      AND u.is_active
      AND u.created_at <= n.created_at
  );
