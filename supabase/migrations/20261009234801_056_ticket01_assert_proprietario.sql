-- Spec 056, ticket 01: guarda das rotas de Contatos do Site. O Worker do app chama esta RPC com o JWT do usuario antes de ler ou
-- marcar no D1 do site, para a regra de quem e Proprietario (private.assert_saas_admin: role 'proprietario' e is_active) continuar
-- so no Postgres. Recusa com ADMIN_ONLY (42501); o anonimo nao tem EXECUTE.
create or replace function public.assert_proprietario()
returns void
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  perform private.assert_saas_admin();
end;
$function$;

revoke all on function public.assert_proprietario() from public, anon, authenticated;
grant execute on function public.assert_proprietario() to authenticated;
