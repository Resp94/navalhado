-- Spec 043, ticket 07: o Agendamento criado a partir da Lista de Espera fica marcado no banco.
--
-- Hoje a unica marca e o texto [Fila de Espera] no inicio da nota do Agendamento: dado estruturado
-- disfarcado de texto livre, que a recepcao pode apagar no modal antes de confirmar e que nenhuma
-- consulta enxerga. A marca passa a ser uma coluna propria.
--
-- Nao reaproveita origin: ela descreve o canal por onde o Agendamento entrou (painel, link publico,
-- Canal do Cliente, WhatsApp) e alimenta o relatorio Agendamentos por origem, e vir da fila e um
-- fluxo interno. Misturar tiraria os encaixes da fila da linha Painel do relatorio, com uma queda
-- aparente nos numeros entre periodos. Tambem nao usa chave estrangeira para a entrada: o gerente
-- pode apagar a entrada da propria gaveta, e o Agendamento perderia a marca justamente quando mais
-- interessa.
--
-- Nao e nulavel: ou veio da fila ou nao veio. Agendamento anterior a esta migration fica falso, e o
-- que trazia o texto [Fila de Espera] na nota continua trazendo, sem reescrita.
--
-- A RPC ja baixa a entrada da fila dentro da mesma funcao, depois do insert. Se a entrada nao estiver
-- mais aguardando, o raise desfaz o insert inteiro, entao gravar a marca no proprio insert nunca deixa
-- um Agendamento marcado sem entrada consumida. O corpo abaixo e o vigente no banco com uma unica
-- alteracao, nas colunas e nos valores do insert em public.appointments. As permissoes de execucao nao
-- mudam: CREATE OR REPLACE as preserva.

alter table public.appointments
  add column if not exists from_waiting_list boolean not null default false;

comment on column public.appointments.from_waiting_list is
  'Verdadeiro quando o Agendamento foi criado consumindo uma entrada da Lista de Espera. Gravado so pela RPC create_appointment_by_manager, na mesma transacao que baixa a entrada.';

CREATE OR REPLACE FUNCTION public.create_appointment_by_manager(p_tenant_id uuid, p_service_id uuid, p_start_time timestamp with time zone, p_professional_id uuid DEFAULT NULL::uuid, p_customer_id uuid DEFAULT NULL::uuid, p_new_customer_name text DEFAULT NULL::text, p_new_customer_phone text DEFAULT NULL::text, p_is_fitting boolean DEFAULT false, p_notes text DEFAULT NULL::text, p_waiting_list_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_is_fitting boolean := coalesce(p_is_fitting, false);
  v_explicit boolean := p_professional_id is not null;
  v_base_duration integer;
  v_customer_id uuid := p_customer_id;
  v_new_name text := nullif(btrim(coalesce(p_new_customer_name, '')), '');
  v_new_phone text := nullif(btrim(coalesce(p_new_customer_phone, '')), '');
  v_candidates uuid[];
  v_candidate uuid;
  v_custom_duration integer;
  v_service_enabled boolean;
  v_duration integer;
  v_end timestamptz;
  v_appointment_id uuid;
  v_professional_id uuid;
  v_created boolean := false;
  v_role text;
begin
  v_role := private.assert_tenant_access(p_tenant_id, true);

  if v_role = 'barbeiro' then
    if p_professional_id is null or not private.is_own_professional(p_professional_id) then
      raise exception 'Barbeiro só cria agendamento na própria agenda.' using errcode = '42501';
    end if;

    if p_waiting_list_id is not null then
      raise exception 'Barbeiro não consome a Lista de Espera.' using errcode = '42501';
    end if;
  end if;

  if p_start_time is null then
    raise exception 'Informe o horário do agendamento.' using errcode = 'P0001';
  end if;

  select s.duration_minutes
    into v_base_duration
  from public.services s
  where s.id = p_service_id
    and s.tenant_id = p_tenant_id
    and s.is_active = true
    and s.deleted_at is null;

  if not found then
    raise exception 'Serviço não encontrado ou inativo.' using errcode = 'P0001';
  end if;

  if not v_is_fitting and p_start_time < now() then
    raise exception 'Não é possível agendar em um horário que já passou. Horários passados só como encaixe.'
      using errcode = 'P0001';
  end if;

  if v_customer_id is not null then
    perform 1
    from public.customers c
    where c.id = v_customer_id
      and c.tenant_id = p_tenant_id;

    if not found then
      raise exception 'Cliente não encontrado.' using errcode = 'P0001';
    end if;
  elsif v_new_name is not null then
    if length(regexp_replace(coalesce(v_new_phone, ''), '\\D', '', 'g')) < 10 then
      raise exception 'Telefone inválido (mínimo DDD + 8 dígitos).' using errcode = 'P0001';
    end if;

    insert into public.customers (tenant_id, name, phone, registration_origin, cadastro_completo)
    values (p_tenant_id, v_new_name, v_new_phone, 'agenda', true)
    returning id into v_customer_id;
  end if;

  if v_explicit then
    v_candidates := array[p_professional_id];
  else
    select coalesce(array_agg(p.id order by p.name, p.id), '{}'::uuid[])
      into v_candidates
    from public.professionals p
    where p.tenant_id = p_tenant_id
      and p.is_active = true
      and p.deleted_at is null;
  end if;

  foreach v_candidate in array v_candidates loop
    perform 1
    from public.professionals p
    where p.id = v_candidate
      and p.tenant_id = p_tenant_id
      and p.is_active = true
      and p.deleted_at is null;

    if not found then
      if v_explicit then
        raise exception 'Profissional não encontrado ou inativo.' using errcode = 'P0001';
      end if;
      continue;
    end if;

    v_custom_duration := null;
    v_service_enabled := null;
    select ps.custom_duration_minutes, ps.is_enabled
      into v_custom_duration, v_service_enabled
    from public.professional_services ps
    where ps.professional_id = v_candidate
      and ps.service_id = p_service_id
      and ps.tenant_id = p_tenant_id;

    if v_service_enabled is false then
      if v_explicit then
        raise exception 'O profissional selecionado não executa este serviço.' using errcode = 'P0001';
      end if;
      continue;
    end if;

    v_duration := coalesce(nullif(v_custom_duration, 0), v_base_duration, 40);
    v_end := p_start_time + make_interval(mins => v_duration);

    if not v_is_fitting and exists (
      select 1
      from public.blocked_slots b
      where b.tenant_id = p_tenant_id
        and (b.professional_id = v_candidate or b.professional_id is null)
        and b.start_time < v_end
        and b.end_time > p_start_time
    ) then
      if v_explicit then
        raise exception 'O horário escolhido está bloqueado na agenda.' using errcode = 'P0001';
      end if;
      continue;
    end if;

    begin
      insert into public.appointments (
        tenant_id, customer_id, professional_id, service_id, start_time, end_time,
        status, payment_status, is_fitting, notes, origin, from_waiting_list
      ) values (
        p_tenant_id, v_customer_id, v_candidate, p_service_id, p_start_time, v_end,
        'confirmed', 'pending', v_is_fitting, nullif(btrim(coalesce(p_notes, '')), ''), 'manual',
        p_waiting_list_id is not null
      )
      returning id, professional_id into v_appointment_id, v_professional_id;

      v_created := true;
    exception
      when exclusion_violation then
        if v_explicit then
          raise exception 'O horário selecionado já está ocupado.' using errcode = 'P0001';
        end if;
      when unique_violation then
        if v_explicit then
          raise exception 'Limite atingido: já existe 1 encaixe agendado para este profissional neste horário.'
            using errcode = 'P0001', hint = 'fitting_limit_reached';
        end if;
      when sqlstate '22023' then
        if v_explicit then
          raise;
        end if;
    end;

    exit when v_created;
  end loop;

  if not v_created then
    raise exception 'Não há profissionais disponíveis para este horário.' using errcode = 'P0001';
  end if;

  if p_waiting_list_id is not null then
    update public.waiting_list
    set status = 'scheduled'
    where id = p_waiting_list_id
      and tenant_id = p_tenant_id
      and status = 'waiting';

    if not found then
      raise exception 'Esta entrada da Lista de Espera não está mais aguardando.' using errcode = 'P0001';
    end if;
  end if;

  return jsonb_build_object(
    'appointment_id', v_appointment_id,
    'tenant_id', p_tenant_id,
    'customer_id', v_customer_id,
    'professional_id', v_professional_id,
    'start_time', p_start_time,
    'end_time', v_end,
    'status', 'confirmed',
    'is_fitting', v_is_fitting
  );
end;
$function$;
