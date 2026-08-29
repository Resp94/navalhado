-- Restringe explicitamente a execução dos gatilhos privados ao papel de serviço.

REVOKE ALL ON FUNCTION private.fn_customer_welcome_balcao_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.fn_appointment_whatsapp_trigger() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.fn_customer_welcome_balcao_trigger() TO service_role;
GRANT EXECUTE ON FUNCTION private.fn_appointment_whatsapp_trigger() TO service_role;
