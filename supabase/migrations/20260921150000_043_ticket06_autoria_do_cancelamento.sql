-- Spec 043, ticket 06: autoria do cancelamento.
--
-- Diante de um horario vago, a pergunta operacional e "o cliente desmarcou ou fomos nos?". Hoje isso
-- e irrecuperavel: nao ha coluna de autoria, e o unico indicio era o texto padrao que o Canal do
-- Cliente grava quando o cliente nao escreve motivo, indicio que some quando ele escreve um.
--
-- A coluna guarda quem cancelou, com dominio fechado: shop (a barbearia, gerente ou barbeiro pela
-- mesma RPC do gestor, e o cancelamento pela Comanda) ou customer (o cliente, pelo Canal do Cliente).
-- Nao distingue gerente de barbeiro: as duas telas chamam a mesma RPC e o banco nao identifica o
-- autor individual ali. Sem backfill: cancelamento anterior fica com autoria nula, porque inferir por
-- texto produziria historico falso para quem escreveu motivo proprio.
--
-- Sao quatro os caminhos que gravam status canceled em Agendamento. As tres RPCs previstas no ticket
-- mais public.cancel_comanda_appointment, que a tela de Comandas usa para cancelar a Comanda e o
-- Agendamento juntos e que nao gravava nem motivo nem autoria.
--
-- Cada corpo abaixo e o vigente no banco com uma unica linha acrescentada. As permissoes de execucao
-- nao mudam: CREATE OR REPLACE as preserva.

alter table public.appointments
  add column if not exists canceled_by text;

alter table public.appointments
  drop constraint if exists appointments_canceled_by_check;

alter table public.appointments
  add constraint appointments_canceled_by_check
  check (canceled_by is null or canceled_by in ('shop', 'customer'));

comment on column public.appointments.canceled_by is
  'Quem cancelou o Agendamento: shop (barbearia) ou customer (cliente pelo Canal do Cliente). Nulo quando nao cancelado ou cancelado antes da spec 043. Escrito so pelas RPCs de cancelamento.';

-- ---------------------------------------------------------------------------
-- Gestor: usada pela Agenda do gerente e pela Minha Agenda do barbeiro
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_appointment_by_manager(p_appointment_id uuid, p_tenant_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_appointment public.appointments%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  v_appointment := private.lock_appointment_for_transition(p_appointment_id, p_tenant_id, true);

  if v_appointment.status not in ('pending', 'confirmed', 'in_progress') then
    raise exception 'Somente atendimentos pendentes, confirmados ou em andamento podem ser cancelados.' using errcode = 'P0001';
  end if;

  if v_reason is null then
    raise exception 'Informe o motivo do cancelamento.' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = 'canceled',
      cancellation_reason = v_reason,
      canceled_by = 'shop',
      updated_at = timezone('utc'::text, now())
  where id = v_appointment.id
    and tenant_id = p_tenant_id;

  return jsonb_build_object(
    'appointment_id', v_appointment.id,
    'tenant_id', p_tenant_id,
    'status', 'canceled'
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- Canal do Cliente, por token
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_appointment_by_token(p_token uuid, p_appointment_id uuid, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_customer_id uuid;
  v_tenant_id uuid;
  v_token_expirado_em timestamptz;
  v_min_cancellation_lead_time integer;
  v_start_time timestamptz;
BEGIN
  SELECT id, tenant_id, token_expirado_em
  INTO v_customer_id, v_tenant_id, v_token_expirado_em
  FROM public.customers
  WHERE token_acesso = p_token;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado ou token inválido.';
  END IF;

  IF v_token_expirado_em IS NOT NULL AND v_token_expirado_em < now() THEN
    RAISE EXCEPTION 'Seu acesso expirou. Por favor, solicite um novo link.';
  END IF;

  SELECT start_time INTO v_start_time
  FROM public.appointments
  WHERE id = p_appointment_id
    AND customer_id = v_customer_id
    AND tenant_id = v_tenant_id;

  IF v_start_time IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado ou não pertence a este cliente.';
  END IF;

  IF v_start_time <= now() THEN
    RAISE EXCEPTION 'Não é possível cancelar um agendamento que já ocorreu ou está em andamento.'
      USING errcode = '22023';
  END IF;

  SELECT COALESCE(min_cancellation_lead_time_minutes, 120)
  INTO v_min_cancellation_lead_time
  FROM public.tenants
  WHERE id = v_tenant_id;

  IF v_start_time < (now() + (v_min_cancellation_lead_time || ' minutes')::interval) THEN
    RAISE EXCEPTION 'APPOINTMENT_CANCELLATION_DEADLINE_EXPIRED: O prazo para cancelamento online expirou (% minutos de antecedência mínima). Entre em contato diretamente com o profissional.', v_min_cancellation_lead_time
      USING errcode = '22023';
  END IF;

  UPDATE public.appointments
  SET
    status = 'canceled',
    cancellation_reason = p_reason,
    canceled_by = 'customer',
    updated_at = now()
  WHERE id = p_appointment_id;

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Canal do Cliente, por sessao publica
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_appointment_by_public_session(p_appointment_id uuid, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_auth_user_id UUID := (SELECT auth.uid());
  v_customer_id UUID;
  v_tenant_id UUID;
  v_start_time TIMESTAMPTZ;
  v_min_cancellation_lead_time INTEGER;
BEGIN
  SELECT s.customer_id, s.tenant_id INTO v_customer_id, v_tenant_id
  FROM public.public_customer_sessions s
  WHERE s.auth_user_id = v_auth_user_id AND s.expires_at > now();

  IF v_customer_id IS NULL OR COALESCE(((SELECT auth.jwt())->>'is_anonymous')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'Sessão pública inválida ou expirada.' USING ERRCODE = 'P0002';
  END IF;

  SELECT a.start_time INTO v_start_time FROM public.appointments a
  WHERE a.id = p_appointment_id AND a.customer_id = v_customer_id AND a.tenant_id = v_tenant_id;

  IF v_start_time IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado ou não pertence a este cliente.';
  END IF;
  IF v_start_time <= now() THEN
    RAISE EXCEPTION 'Não é possível cancelar um agendamento que já ocorreu ou está em andamento.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(t.min_cancellation_lead_time_minutes, 120) INTO v_min_cancellation_lead_time
  FROM public.tenants t WHERE t.id = v_tenant_id;
  IF v_start_time < now() + (v_min_cancellation_lead_time || ' minutes')::INTERVAL THEN
    RAISE EXCEPTION 'APPOINTMENT_CANCELLATION_DEADLINE_EXPIRED: O prazo para cancelamento online expirou (% minutos de antecedência mínima). Entre em contato diretamente com o profissional.', v_min_cancellation_lead_time USING ERRCODE = '22023';
  END IF;

  UPDATE public.appointments SET status = 'canceled', cancellation_reason = p_reason, canceled_by = 'customer', updated_at = now()
  WHERE id = p_appointment_id AND customer_id = v_customer_id AND tenant_id = v_tenant_id;
  UPDATE public.public_customer_sessions SET last_seen_at = now() WHERE auth_user_id = v_auth_user_id;
  RETURN TRUE;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Cancelamento pela Comanda: cancela a Comanda aberta e o Agendamento juntos
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_comanda_appointment(p_comanda_id uuid DEFAULT NULL::uuid, p_appointment_id uuid DEFAULT NULL::uuid, p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := (select auth.uid());
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_comanda public.comandas%rowtype;
  v_appointment public.appointments%rowtype;
begin
  if v_user_id is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  select u.role, u.tenant_id
    into v_user_role, v_user_tenant
  from public.users u
  where u.id = v_user_id
    and u.is_active = true;

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado para cancelar atendimento.' using errcode = '42501';
  end if;

  v_target_tenant := coalesce(p_tenant_id, v_user_tenant);
  if v_target_tenant is null then
    raise exception 'Unidade nao informada.' using errcode = '22023';
  end if;
  if v_user_role <> 'proprietario' and v_user_tenant is distinct from v_target_tenant then
    raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
  end if;
  if p_comanda_id is null and p_appointment_id is null then
    raise exception 'Comanda ou agendamento deve ser informado.' using errcode = '22023';
  end if;

  if p_comanda_id is not null then
    select * into v_comanda
    from public.comandas
    where id = p_comanda_id
      and tenant_id = v_target_tenant
    for update;

    if not found or v_comanda.status not in ('aberta', 'open') then
      raise exception 'A comanda nao existe ou nao esta aberta.' using errcode = 'P0001';
    end if;
    if p_appointment_id is not null
       and v_comanda.appointment_id is distinct from p_appointment_id then
      raise exception 'Comanda e agendamento nao pertencem ao mesmo atendimento.' using errcode = '22023';
    end if;
  end if;

  if p_appointment_id is not null then
    select * into v_appointment
    from public.appointments
    where id = p_appointment_id
      and tenant_id = v_target_tenant
    for update;

    if not found then
      raise exception 'Agendamento nao encontrado.' using errcode = 'P0001';
    end if;
  end if;

  if p_comanda_id is not null then
    update public.comandas
    set status = 'cancelada',
        closed_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    where id = p_comanda_id
      and tenant_id = v_target_tenant;
  end if;

  if p_appointment_id is not null then
    update public.appointments
    set status = 'canceled',
        canceled_by = 'shop',
        updated_at = timezone('utc'::text, now())
    where id = p_appointment_id
      and tenant_id = v_target_tenant;
  end if;

  return jsonb_build_object(
    'tenant_id', v_target_tenant,
    'comanda_id', p_comanda_id,
    'appointment_id', p_appointment_id,
    'status', 'canceled'
  );
end;
$function$;
