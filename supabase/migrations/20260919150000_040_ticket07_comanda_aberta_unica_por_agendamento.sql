-- Spec 040, ticket 07: uma Comanda aberta por Agendamento.
--
-- fn_auto_create_comanda_for_appointment (migration 024) ja cria a Comanda e o Item
-- de Comanda do servico quando o Agendamento nasce. Faltava a garantia no banco: dois
-- caminhos criando ao mesmo tempo (a tela antes tambem criava) podiam gerar duas
-- Comandas abertas. O indice unico parcial fecha isso. Comanda cancelada ou fechada
-- do mesmo agendamento e a venda de balcao (sem agendamento) nao entram na regra.
--
-- Se ja existir duplicata, a migration para com a lista, sem apagar nada: quem decide
-- qual Comanda vale e uma pessoa.

do $$
declare
  v_duplicates text;
begin
  select string_agg(appointment_id::text || ' (' || total || ' abertas)', ', ')
    into v_duplicates
  from (
    select appointment_id, count(*) as total
    from public.comandas
    where appointment_id is not null
      and status = 'aberta'
    group by appointment_id
    having count(*) > 1
  ) d;

  if v_duplicates is not null then
    raise exception 'Existem agendamentos com mais de uma comanda aberta: %. Resolva antes de aplicar.', v_duplicates
      using errcode = 'P0001';
  end if;
end;
$$;

create unique index if not exists uq_comandas_open_per_appointment
  on public.comandas (appointment_id)
  where appointment_id is not null and status = 'aberta';
