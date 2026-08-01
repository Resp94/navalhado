-- Mantém a view administrativa sujeita às permissões e RLS do usuário que a consulta.

alter view public.view_tenants_management
set (security_invoker = true);
