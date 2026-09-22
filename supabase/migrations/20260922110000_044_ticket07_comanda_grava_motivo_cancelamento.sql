-- Spec 044, ticket 07: cancelamento pela tela de Comandas grava o Motivo de Cancelamento.
--
-- public.cancel_comanda_appointment cancela a Comanda e o Agendamento juntos. O ticket 06 da spec
-- 043 deu autoria a essa via (sempre 'shop'), mas deixou de fora o motivo: quem cancela um
-- Agendamento por essa RPC nunca grava por que cancelou, e o Painel de Cancelados do Dia mostra
-- esses casos como "Sem motivo informado", ao lado de cancelamentos idênticos feitos pela Agenda
-- (public.cancel_appointment_by_manager) que já exigem e gravam o motivo.
--
-- p_reason entra como quarto parâmetro, com default nulo para não quebrar quem chama só com os três
-- primeiros (a comanda de balcão, sem agendamento, continua sem exigir motivo). Só é exigido quando
-- há Agendamento para cancelar (p_appointment_id informado); nesse caso, em branco ou só espaço é
-- recusado com a mesma mensagem da RPC do gestor. Sem backfill: cancelamento anterior por essa via
-- fica com motivo nulo, como já ficava com autoria nula antes do ticket 06/043.
--
-- O corpo é o vigente no banco, com a validação de motivo e a gravação de cancellation_reason
-- acrescentadas ao bloco que já atualiza o Agendamento. Permissões de execução preservadas
-- (authenticated, postgres, service_role; sem anon).
--
-- CREATE OR REPLACE não troca função por assinatura de parâmetros diferente: casa só pelos tipos
-- dos parâmetros. Como p_reason é parâmetro novo, um CREATE OR REPLACE direto criaria um SEGUNDO
-- overload (uuid,uuid,uuid,text) ao lado do antigo (uuid,uuid,uuid), deixando toda chamada de 3
-- argumentos ambígua ("is not unique"). O DROP abaixo remove o overload antigo antes de criar o
-- novo, que cobre os mesmos três parâmetros mais p_reason (DEFAULT NULL).
drop function if exists public.cancel_comanda_appointment(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.cancel_comanda_appointment(p_comanda_id uuid DEFAULT NULL::uuid, p_appointment_id uuid DEFAULT NULL::uuid, p_tenant_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text)
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
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
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

  if p_appointment_id is not null and v_reason is null then
    raise exception 'Informe o motivo do cancelamento.' using errcode = 'P0001';
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
        cancellation_reason = v_reason,
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

-- O DROP acima apaga tambem o ACL da funcao antiga. public tem default privilege que concede
-- EXECUTE em toda funcao nova a anon/authenticated/service_role (padrao do Supabase, como grant
-- explicito em cada role, nao via PUBLIC); sem as duas linhas abaixo, o CREATE reabriria a RPC
-- SECURITY DEFINER para anon. Resultado final igual ao de antes do ticket: authenticated,
-- postgres e service_role podem executar; anon nao.
revoke all on function public.cancel_comanda_appointment(uuid, uuid, uuid, text) from public;
revoke execute on function public.cancel_comanda_appointment(uuid, uuid, uuid, text) from anon;
grant execute on function public.cancel_comanda_appointment(uuid, uuid, uuid, text) to authenticated;
