-- Spec 052, ticket 02: limite de profissionais no banco.
--
-- Um gatilho em public.professionals recusa incluir um profissional ativo (sem
-- deleted_at), reativar um profissional excluido ou mover um profissional ativo
-- para uma barbearia que ja esta no limite do plano da sua assinatura. Vale para
-- qualquer caminho de escrita: tela, onboarding, API direta ou SQL.
--
-- - Ativo e quem nao tem deleted_at. is_active = false nao libera vaga: so excluir.
-- - O Gerente conta so quando existe um profissional vinculado a ele; a propria
--   contagem de profissionais ja resolve isso, sem regra especial.
-- - O plano vem da assinatura mais recente da barbearia. Sem assinatura nao ha
--   plano e, portanto, nao ha limite.
-- - Erro: SQLSTATE 53400 (configuration_limit_exceeded), mensagem
--   PROFESSIONAL_LIMIT_REACHED, detalhe com o plano e o limite.
-- - O SELECT ... FOR NO KEY UPDATE na barbearia serializa cadastros simultaneos,
--   para dois deles nao passarem juntos do limite. Nao usa FOR UPDATE porque ele
--   conflita com o FOR KEY SHARE que todo INSERT em tabela filha (agendamento,
--   cliente, comanda) toma na barbearia, e travaria o agendamento dela.

create or replace function private.enforce_professional_plan_limit()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_max integer;
  v_plano text;
  v_ativos integer;
begin
  -- Profissional excluido nao ocupa vaga.
  if new.deleted_at is not null then
    return new;
  end if;

  -- Alterar um profissional que ja estava ativo na mesma barbearia nao muda a contagem.
  if tg_op = 'UPDATE' and old.deleted_at is null and old.tenant_id = new.tenant_id then
    return new;
  end if;

  perform 1 from public.tenants where id = new.tenant_id for no key update;

  select pl.max_professionals, pl.name
  into v_max, v_plano
  from public.tenant_subscriptions s
  join public.plans pl on pl.id = s.plan_id
  where s.tenant_id = new.tenant_id
  order by s.created_at desc
  limit 1;

  if v_max is null then
    return new;
  end if;

  select count(*) into v_ativos
  from public.professionals
  where tenant_id = new.tenant_id
    and deleted_at is null
    and id <> new.id;

  if v_ativos >= v_max then
    raise exception 'PROFESSIONAL_LIMIT_REACHED'
      using errcode = '53400', detail = format('plano=%s limite=%s', v_plano, v_max);
  end if;

  return new;
end;
$function$;

revoke all on function private.enforce_professional_plan_limit() from public, anon, authenticated;

drop trigger if exists trg_enforce_professional_plan_limit on public.professionals;
create trigger trg_enforce_professional_plan_limit
  before insert or update of deleted_at, tenant_id on public.professionals
  for each row execute function private.enforce_professional_plan_limit();
