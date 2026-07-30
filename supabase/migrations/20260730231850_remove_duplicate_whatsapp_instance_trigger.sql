-- The gerente UI invokes whatsapp-integration/manage-instance directly so it
-- can receive the generated QR code. Keeping this trigger causes the same
-- create/connect/disconnect action to run a second time through pg_net.
drop trigger if exists trg_evolution_api_instance
on public.evolution_api_instances;

drop function if exists public.fn_evolution_api_instance_trigger();
