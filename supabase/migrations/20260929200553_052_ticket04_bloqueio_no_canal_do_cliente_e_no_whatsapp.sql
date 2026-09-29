-- Spec 052, ticket 04: bloqueio no Canal do Cliente e no WhatsApp.
--
-- Canal do Cliente: com a barbearia bloqueada, criar e reagendar sao recusados no servidor
-- (ONLINE_BOOKING_UNAVAILABLE, SQLSTATE 55000). Cancelar continua permitido, para o cliente
-- liberar o horario, e ver os proprios agendamentos tambem. A guarda e uma so,
-- private.assert_online_booking_allowed, e le o mesmo Estado de Acesso do painel.
-- A tela do cliente pergunta a disponibilidade por get_public_booking_availability, para
-- avisar antes de o cliente preencher o fluxo inteiro.
--
-- WhatsApp: a Edge Function le o Estado de Acesso por get_tenant_access_state (so o
-- service_role executa). O envio que nao sai por bloqueio fica como discarded, com o motivo,
-- no livro de idempotencia e na fila, e nao volta para a fila.

-- 1. Estado de Acesso para as funcoes do servidor.
create or replace function public.get_tenant_access_state(p_tenant_id uuid)
returns table (access text, reason text, relevant_date timestamptz)
language sql
stable
security definer
set search_path to ''
as $function$
  select e.access, e.reason, e.relevant_date from private.tenant_access_state(p_tenant_id) e;
$function$;

revoke all on function public.get_tenant_access_state(uuid) from public, anon, authenticated;
grant execute on function public.get_tenant_access_state(uuid) to service_role;

-- 2. Guarda do Canal do Cliente.
create or replace function private.assert_online_booking_allowed(p_tenant_id uuid)
returns void
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if exists (
    select 1 from private.tenant_access_state(p_tenant_id) e where e.access = 'blocked'
  ) then
    raise exception 'ONLINE_BOOKING_UNAVAILABLE: Agendamento online indisponível no momento. Entre em contato diretamente com o estabelecimento.'
      using errcode = '55000';
  end if;
end;
$function$;

revoke all on function private.assert_online_booking_allowed(uuid) from public, anon, authenticated;

-- 3. Disponibilidade publica do agendamento online. Nulo: a barbearia nao existe (ou nao
-- terminou o onboarding), e o fluxo normal responde com o erro que ja responde hoje.
create or replace function public.get_public_booking_availability(p_slug text)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_tenant_id uuid;
begin
  select t.id into v_tenant_id
  from public.tenants t
  where lower(t.slug) = lower(btrim(p_slug))
    and t.onboarding_completed is true;

  if v_tenant_id is null then
    return null;
  end if;

  return not exists (
    select 1 from private.tenant_access_state(v_tenant_id) e where e.access = 'blocked'
  );
end;
$function$;

revoke all on function public.get_public_booking_availability(text) from public;
grant execute on function public.get_public_booking_availability(text) to anon, authenticated, service_role;

-- 4. Criar: a guarda entra logo depois de o token resolver a barbearia.
create or replace function public.create_appointment_by_token(p_token uuid, p_service_id uuid, p_professional_id uuid, p_date date, p_slot text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
DECLARE
  v_customer_id UUID;
  v_tenant_id UUID;
  v_timezone TEXT;
  v_min_booking_lead_time INTEGER;
  v_duration INTEGER;
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_final_professional_id UUID;
  v_appointment_id UUID;
BEGIN
  SELECT c.id, c.tenant_id
  INTO v_customer_id, v_tenant_id
  FROM public.customers c
  WHERE c.token_acesso = p_token
    AND (c.token_expirado_em IS NULL OR c.token_expirado_em >= now());

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado ou token inválido.';
  END IF;

  PERFORM private.assert_online_booking_allowed(v_tenant_id);

  SELECT COALESCE(t.timezone, 'America/Sao_Paulo'), COALESCE(t.min_booking_lead_time_minutes, 15)
  INTO v_timezone, v_min_booking_lead_time
  FROM public.tenants t
  WHERE t.id = v_tenant_id;

  v_start_time := ((p_date::TEXT || ' ' || p_slot || ':00')::TIMESTAMP) AT TIME ZONE v_timezone;
  IF v_start_time < now() + (v_min_booking_lead_time || ' minutes')::INTERVAL THEN
    RAISE EXCEPTION 'Este horário não está mais disponível com a antecedência mínima necessária (% minutos).', v_min_booking_lead_time USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(s.duration_minutes, 40)
  INTO v_duration
  FROM public.services s
  WHERE s.id = p_service_id
    AND s.tenant_id = v_tenant_id
    AND s.is_active = true
    AND s.deleted_at IS NULL;

  IF v_duration IS NULL THEN
    RAISE EXCEPTION 'Serviço indisponível ou inexistente.';
  END IF;

  IF p_professional_id IS NULL THEN
    SELECT candidate.professional_id
    INTO v_final_professional_id
    FROM (
      SELECT prof.id AS professional_id
      FROM public.professionals prof
      JOIN public.professional_services ps
        ON ps.tenant_id = v_tenant_id
       AND ps.professional_id = prof.id
       AND ps.service_id = p_service_id
       AND ps.is_enabled = true
      WHERE prof.tenant_id = v_tenant_id
        AND prof.is_active = true
        AND prof.deleted_at IS NULL
      ORDER BY prof.name, prof.id
    ) candidate
    WHERE EXISTS (
      SELECT 1
      FROM public.get_available_slots(v_tenant_id, candidate.professional_id, p_service_id, p_date, NULL) available
      WHERE available.slot_time = p_slot
    )
    LIMIT 1;

    IF v_final_professional_id IS NULL THEN
      RAISE EXCEPTION 'Não há profissionais disponíveis para este horário. Por favor, escolha outro.';
    END IF;
  ELSE
    v_final_professional_id := p_professional_id;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_final_professional_id::TEXT || ':' || v_start_time::TEXT, 0));

  IF NOT EXISTS (
    SELECT 1
    FROM public.get_available_slots(v_tenant_id, v_final_professional_id, p_service_id, p_date, NULL) available
    WHERE available.slot_time = p_slot
  ) THEN
    RAISE EXCEPTION 'O horário selecionado acabou de ser reservado ou não está disponível.' USING ERRCODE = '23P01';
  END IF;

  SELECT COALESCE(ps.custom_duration_minutes, s.duration_minutes, 40)
  INTO v_duration
  FROM public.services s
  JOIN public.professional_services ps
    ON ps.tenant_id = v_tenant_id
   AND ps.professional_id = v_final_professional_id
   AND ps.service_id = s.id
   AND ps.is_enabled = true
  WHERE s.id = p_service_id
    AND s.tenant_id = v_tenant_id
    AND s.is_active = true
    AND s.deleted_at IS NULL;

  v_end_time := v_start_time + (v_duration || ' minutes')::INTERVAL;

  INSERT INTO public.appointments(
    tenant_id, customer_id, professional_id, service_id, start_time, end_time,
    status, payment_status, origin, notes
  ) VALUES (
    v_tenant_id, v_customer_id, v_final_professional_id, p_service_id, v_start_time, v_end_time,
    'confirmed', 'pending', 'online', 'Agendamento realizado pelo canal do cliente'
  )
  RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$function$;

-- 5. Confirmar agendamento pelo slug: a guarda entra antes de cadastrar o cliente.
create or replace function public.confirm_public_booking(p_slug text, p_service_id uuid, p_professional_id uuid, p_date date, p_slot text, p_name text, p_phone text, p_token uuid)
returns table (appointment_id uuid, customer_id uuid, token_acesso uuid, customer_name text, customer_phone text)
language plpgsql
security definer
set search_path to ''
as $function$
DECLARE
  v_tenant_id UUID;
  v_customer public.customers%ROWTYPE;
  v_phone TEXT;
  v_name TEXT := btrim(p_name);
  v_appointment_id UUID;
BEGIN
  IF v_name IS NULL OR array_length(regexp_split_to_array(v_name,'\s+'),1)<2 THEN
    RAISE EXCEPTION 'Informe nome e sobrenome completos.' USING ERRCODE='22023';
  END IF;
  v_phone := private.normalize_br_phone(p_phone);
  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Informe um WhatsApp válido com DDD.' USING ERRCODE='22023';
  END IF;
  SELECT t.id INTO v_tenant_id FROM public.tenants t
  WHERE lower(t.slug)=lower(btrim(p_slug)) AND t.onboarding_completed IS TRUE;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Estabelecimento não encontrado.' USING ERRCODE='P0002';
  END IF;
  PERFORM private.assert_online_booking_allowed(v_tenant_id);
  IF p_token IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.token_acesso=p_token AND c.tenant_id=v_tenant_id
      AND (c.token_expirado_em IS NULL OR c.token_expirado_em>=now())
  ) THEN
    RAISE EXCEPTION 'Token inválido para este estabelecimento.' USING ERRCODE='P0002';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::TEXT||':'||v_phone,0));
  SELECT c.* INTO v_customer FROM public.customers c
  WHERE c.tenant_id=v_tenant_id AND c.telefone_normalizado=v_phone;
  IF FOUND THEN
    IF v_customer.cadastro_completo IS FALSE THEN
      UPDATE public.customers
      SET name=left(v_name,100),phone=v_phone,cadastro_completo=true,
          registration_origin='canal_cliente',updated_at=timezone('utc'::TEXT,now())
      WHERE id=v_customer.id RETURNING * INTO v_customer;
    END IF;
  ELSE
    INSERT INTO public.customers(tenant_id,name,phone,cadastro_completo,registration_origin)
    VALUES(v_tenant_id,left(v_name,100),v_phone,true,'canal_cliente')
    RETURNING * INTO v_customer;
  END IF;
  v_appointment_id := public.create_appointment_by_token(v_customer.token_acesso,p_service_id,p_professional_id,p_date,p_slot);
  RETURN QUERY SELECT v_appointment_id,v_customer.id,v_customer.token_acesso,v_customer.name,v_customer.phone;
END;
$function$;

-- 6. Reagendar: a guarda entra logo depois de validar o token.
create or replace function public.reschedule_appointment_by_token(p_token uuid, p_appointment_id uuid, p_new_service_id uuid, p_new_professional_id uuid, p_new_date date, p_new_slot text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
DECLARE
  v_customer_id uuid;
  v_tenant_id uuid;
  v_token_expirado_em timestamptz;
  v_min_cancellation_lead_time integer;
  v_min_booking_lead_time integer;
  v_timezone text;
  v_old_start_time timestamptz;
  v_old_status text;
  v_new_start_time timestamptz;
  v_new_end_time timestamptz;
  v_duration integer;
  v_day_of_week text;
  v_final_professional_id uuid;
BEGIN
  -- 1. Validar cliente por token
  SELECT c.id, c.tenant_id, c.token_expirado_em
  INTO v_customer_id, v_tenant_id, v_token_expirado_em
  FROM public.customers c
  WHERE c.token_acesso = p_token;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado ou token inválido.' USING errcode = 'P0002';
  END IF;

  IF v_token_expirado_em IS NOT NULL AND v_token_expirado_em < now() THEN
    RAISE EXCEPTION 'Seu acesso expirou. Por favor, solicite um novo link.' USING errcode = '22023';
  END IF;

  PERFORM private.assert_online_booking_allowed(v_tenant_id);

  -- 2. Validar agendamento original
  SELECT a.start_time, a.status
  INTO v_old_start_time, v_old_status
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.customer_id = v_customer_id
    AND a.tenant_id = v_tenant_id;

  IF v_old_start_time IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado.' USING errcode = 'P0002';
  END IF;

  IF v_old_status = 'canceled' THEN
    RAISE EXCEPTION 'Agendamento cancelado não pode ser reagendado.' USING errcode = '22023';
  END IF;

  -- 3. Obter configurações do tenant
  SELECT
    COALESCE(timezone, 'America/Sao_Paulo'),
    COALESCE(min_cancellation_lead_time_minutes, 120),
    COALESCE(min_booking_lead_time_minutes, 30)
  INTO
    v_timezone,
    v_min_cancellation_lead_time,
    v_min_booking_lead_time
  FROM public.tenants
  WHERE id = v_tenant_id;

  -- Validar janela de cancelamento/reagendamento no agendamento antigo
  IF v_old_start_time < (now() + (v_min_cancellation_lead_time || ' minutes')::interval) THEN
    RAISE EXCEPTION 'O prazo limite para reagendar este agendamento expirou (% minutos antes). Entre em contato diretamente com o estabelecimento.', v_min_cancellation_lead_time
      USING errcode = '22023';
  END IF;

  -- 4. Calcular e validar novo horário
  v_new_start_time := ((p_new_date::text || ' ' || p_new_slot || ':00')::timestamp) AT TIME ZONE v_timezone;

  IF v_new_start_time < (now() + (v_min_booking_lead_time || ' minutes')::interval) THEN
    RAISE EXCEPTION 'Este horário não está mais disponível com a antecedência mínima necessária (% minutos).', v_min_booking_lead_time
      USING errcode = '22023';
  END IF;

  -- 5. Obter duração do serviço
  SELECT COALESCE(duration_minutes, 40)
  INTO v_duration
  FROM public.services
  WHERE id = p_new_service_id
    AND tenant_id = v_tenant_id
    AND is_active = true
    AND deleted_at IS NULL;

  IF v_duration IS NULL THEN
    RAISE EXCEPTION 'Serviço indisponível ou inexistente.' USING errcode = 'P0002';
  END IF;

  v_new_end_time := v_new_start_time + (v_duration || ' minutes')::interval;

  -- Determinar dia da semana
  SELECT CASE extract(dow from v_new_start_time AT TIME ZONE v_timezone)
    WHEN 0 THEN 'sunday'
    WHEN 1 THEN 'monday'
    WHEN 2 THEN 'tuesday'
    WHEN 3 THEN 'wednesday'
    WHEN 4 THEN 'thursday'
    WHEN 5 THEN 'friday'
    WHEN 6 THEN 'saturday'
  END INTO v_day_of_week;

  -- 6. Selecionar ou validar profissional
  IF p_new_professional_id IS NULL THEN
    SELECT prof.id INTO v_final_professional_id
    FROM public.professionals prof
    LEFT JOIN public.professional_services ps
      ON ps.professional_id = prof.id
      AND ps.service_id = p_new_service_id
      AND ps.tenant_id = v_tenant_id
    WHERE prof.tenant_id = v_tenant_id
      AND prof.is_active = true
      AND prof.deleted_at IS NULL
      AND (ps.is_enabled IS NULL OR ps.is_enabled = true)
      AND prof.weekly_schedule->v_day_of_week->>'start' IS NOT NULL
      AND prof.weekly_schedule->v_day_of_week->>'end' IS NOT NULL
      AND v_new_start_time >= ((p_new_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'start') || ':00')::timestamp) AT TIME ZONE v_timezone
      AND v_new_start_time < ((p_new_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'end') || ':00')::timestamp) AT TIME ZONE v_timezone
      AND (
        prof.weekly_schedule->v_day_of_week->>'break_start' IS NULL
        OR prof.weekly_schedule->v_day_of_week->>'break_end' IS NULL
        OR NOT (
          v_new_start_time < ((p_new_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'break_end') || ':00')::timestamp) AT TIME ZONE v_timezone
          AND v_new_end_time > ((p_new_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'break_start') || ':00')::timestamp) AT TIME ZONE v_timezone
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.professional_id = prof.id
          AND a.id <> p_appointment_id
          AND a.status != 'canceled'
          AND a.start_time < v_new_end_time
          AND a.end_time > v_new_start_time
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.blocked_slots b
        WHERE (b.tenant_id = v_tenant_id AND (b.professional_id = prof.id OR b.professional_id IS NULL))
          AND b.start_time < v_new_end_time
          AND b.end_time > v_new_start_time
      )
    ORDER BY prof.name ASC
    LIMIT 1;

    IF v_final_professional_id IS NULL THEN
      RAISE EXCEPTION 'Não há profissionais disponíveis para este horário.' USING errcode = '22023';
    END IF;
  ELSE
    v_final_professional_id := p_new_professional_id;

    IF NOT EXISTS (
      SELECT 1 FROM public.professionals prof
      LEFT JOIN public.professional_services ps
        ON ps.professional_id = prof.id
        AND ps.service_id = p_new_service_id
        AND ps.tenant_id = v_tenant_id
      WHERE prof.id = v_final_professional_id
        AND prof.tenant_id = v_tenant_id
        AND prof.is_active = true
        AND prof.deleted_at IS NULL
        AND (ps.is_enabled IS NULL OR ps.is_enabled = true)
        AND prof.weekly_schedule->v_day_of_week->>'start' IS NOT NULL
        AND prof.weekly_schedule->v_day_of_week->>'end' IS NOT NULL
        AND v_new_start_time >= ((p_new_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'start') || ':00')::timestamp) AT TIME ZONE v_timezone
        AND v_new_start_time < ((p_new_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'end') || ':00')::timestamp) AT TIME ZONE v_timezone
        AND (
          prof.weekly_schedule->v_day_of_week->>'break_start' IS NULL
          OR prof.weekly_schedule->v_day_of_week->>'break_end' IS NULL
          OR NOT (
            v_new_start_time < ((p_new_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'break_end') || ':00')::timestamp) AT TIME ZONE v_timezone
            AND v_new_end_time > ((p_new_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'break_start') || ':00')::timestamp) AT TIME ZONE v_timezone
          )
        )
    ) THEN
      RAISE EXCEPTION 'O profissional selecionado não atende neste horário ou não executa o serviço.' USING errcode = '22023';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.professional_id = v_final_professional_id
        AND a.id <> p_appointment_id
        AND a.status != 'canceled'
        AND a.start_time < v_new_end_time
        AND a.end_time > v_new_start_time
    ) THEN
      RAISE EXCEPTION 'O horário selecionado já está ocupado.' USING errcode = '22023';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.blocked_slots b
      WHERE (b.tenant_id = v_tenant_id AND (b.professional_id = v_final_professional_id OR b.professional_id IS NULL))
        AND b.start_time < v_new_end_time
        AND b.end_time > v_new_start_time
      ) THEN
      RAISE EXCEPTION 'O horário selecionado está bloqueado na agenda.' USING errcode = '22023';
    END IF;
  END IF;

  -- 7. Executar UPDATE direto no agendamento
  UPDATE public.appointments
  SET
    service_id = p_new_service_id,
    professional_id = v_final_professional_id,
    start_time = v_new_start_time,
    end_time = v_new_end_time,
    reminder_sent = false,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_appointment_id
    AND tenant_id = v_tenant_id;

  RETURN p_appointment_id;
END;
$function$;

-- 7. Livro de idempotencia e fila aceitam o envio descartado por bloqueio.
alter table public.whatsapp_message_idempotency
  drop constraint whatsapp_message_idempotency_status_check,
  add constraint whatsapp_message_idempotency_status_check
    check (status in ('processing', 'succeeded', 'failed', 'discarded'));

alter table public.whatsapp_message_outbox
  drop constraint whatsapp_message_outbox_status_check,
  add constraint whatsapp_message_outbox_status_check
    check (status in ('queued', 'processing', 'succeeded', 'failed', 'discarded'));

-- Descartar so vale para o item que o worker reservou. Nao mexe em customers: a mensagem
-- de boas-vindas descartada nao foi enviada, entao welcome_sent_at continua vazio.
create or replace function public.discard_whatsapp_message_outbox(p_outbox_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_updated boolean;
begin
  update public.whatsapp_message_outbox
  set status = 'discarded',
      lease_until = null,
      last_error = left(coalesce(p_reason, 'discarded'), 500),
      processed_at = now(),
      updated_at = now()
  where id = p_outbox_id
    and status = 'processing';

  v_updated := found;
  return v_updated;
end;
$function$;

revoke all on function public.discard_whatsapp_message_outbox(uuid, text) from public, anon, authenticated;
grant execute on function public.discard_whatsapp_message_outbox(uuid, text) to service_role;
