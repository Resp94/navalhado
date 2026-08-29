-- Migration 064: remove contratos públicos legados sem consumidor ativo

DROP FUNCTION IF EXISTS public.confirm_public_booking(TEXT, UUID, UUID, DATE, TEXT, TEXT, TEXT);

REVOKE ALL ON FUNCTION public.get_available_slots(UUID, UUID, UUID, DATE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, UUID, DATE, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_appointment_by_token(UUID, UUID, UUID, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_appointment_by_token(UUID, UUID, UUID, DATE, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_or_create_provisional_customer_by_slug(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_provisional_customer_by_slug(TEXT, UUID) TO service_role;
