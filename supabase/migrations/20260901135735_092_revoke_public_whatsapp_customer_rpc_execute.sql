-- SEC-001: a RPC de integração WhatsApp não é endpoint público.
-- O backend usa service_role; anon/authenticated não devem conseguir inserir
-- clientes provisórios arbitrários em um tenant informado pelo chamador.
REVOKE EXECUTE ON FUNCTION public.find_or_create_whatsapp_customer(uuid, text, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.find_or_create_whatsapp_customer(uuid, text, text)
TO service_role;
