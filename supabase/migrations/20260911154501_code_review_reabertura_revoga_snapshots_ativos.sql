-- Reabertura deve revogar qualquer snapshot ainda ativo, inclusive estimado
-- ou indisponivel. Registros ja revertidos permanecem imutaveis.
do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.reopen_comanda(uuid,uuid)'::regprocedure
  ) into v_definition;

  v_definition := replace(v_definition,
    $$where comanda_id = v_comanda.id and snapshot_status = 'confirmed';$$,
    $$where comanda_id = v_comanda.id and snapshot_status is distinct from 'reverted';$$);

  if v_definition = pg_get_functiondef('public.reopen_comanda(uuid,uuid)'::regprocedure) then
    raise exception 'Nao foi possivel localizar a revogacao de snapshots da reabertura.';
  end if;

  execute v_definition;
end;
$migration$;
