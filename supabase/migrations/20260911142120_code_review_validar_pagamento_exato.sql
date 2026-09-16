-- Rejeita diferenças de centavos antes de uma comanda assumir o estado fechado.
create or replace function public.validate_closed_comanda_payment_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_total numeric;
begin
  if new.status = 'fechada' and old.status is distinct from new.status then
    select coalesce(sum(cp.amount), 0)
      into v_payment_total
    from public.comanda_pagamentos cp
    where cp.comanda_id = new.id
      and cp.tenant_id = new.tenant_id;

    if round(v_payment_total, 2) <> round(new.total_amount, 2) then
      raise exception 'A soma dos pagamentos deve ser igual ao total da comanda.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_closed_comanda_payment_total on public.comandas;
create trigger trg_validate_closed_comanda_payment_total
after update of status on public.comandas
for each row
when (new.status = 'fechada' and old.status is distinct from new.status)
execute function public.validate_closed_comanda_payment_total();

revoke all on function public.validate_closed_comanda_payment_total() from public, anon, authenticated;
