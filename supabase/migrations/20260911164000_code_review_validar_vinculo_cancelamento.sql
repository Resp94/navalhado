-- Impede que uma comanda sem agendamento seja cancelada junto com um
-- agendamento arbitrario do mesmo tenant.
do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.cancel_comanda_appointment(uuid,uuid,uuid)'::regprocedure
  ) into v_definition;

  v_definition := replace(v_definition,
    $$       and v_comanda.appointment_id is not null
       and v_comanda.appointment_id <> p_appointment_id then$$,
    $$       and v_comanda.appointment_id is distinct from p_appointment_id then$$);

  if v_definition = pg_get_functiondef('public.cancel_comanda_appointment(uuid,uuid,uuid)'::regprocedure) then
    raise exception 'Nao foi possivel localizar a validacao de vinculo do cancelamento.';
  end if;

  execute v_definition;
end;
$migration$;
