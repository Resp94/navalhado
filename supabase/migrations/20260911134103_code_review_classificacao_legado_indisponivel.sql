-- Registros fechados que não puderam ser reconstruídos permanecem explícitos.
-- O UPDATE é idempotente e não altera snapshots confirmados ou estimados.
update public.comanda_itens ci
set snapshot_status = 'unavailable',
    snapshot_data_quality = 'unavailable'
from public.comandas c
where c.id = ci.comanda_id
  and c.status in ('fechada', 'closed')
  and ci.snapshot_status is null;
