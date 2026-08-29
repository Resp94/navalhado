-- Corrige a elegibilidade de retorno para comparar datas no fuso do tenant.
-- A regra de agenda continua inalterada: último atendimento concluído,
-- período do serviço e supressão por atendimento futuro confirmado/pendente.

CREATE OR REPLACE FUNCTION public.get_pending_return_reminders(p_tenant_id uuid)
RETURNS TABLE (
  appointment_id uuid,
  tenant_id uuid,
  customer_id uuid,
  customer_name text,
  customer_phone text,
  customer_token uuid,
  service_id uuid,
  service_name text,
  return_period_days integer,
  whatsapp_reminder_template text,
  tenant_name text,
  diff_days integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  WITH latest_completed AS (
    SELECT DISTINCT ON (a.customer_id)
      a.id AS app_id,
      a.tenant_id AS t_id,
      a.customer_id AS c_id,
      a.start_time,
      c.name AS c_name,
      c.phone AS c_phone,
      c.token_acesso AS c_token,
      s.id AS s_id,
      s.name AS s_name,
      s.return_period_days AS s_return_days,
      s.custom_reminder_template AS s_template,
      t.name AS t_name,
      (
        (now() AT TIME ZONE COALESCE(NULLIF(t.timezone, ''), 'America/Sao_Paulo'))::date
        - (a.start_time AT TIME ZONE COALESCE(NULLIF(t.timezone, ''), 'America/Sao_Paulo'))::date
      )::integer AS days_passed
    FROM public.appointments AS a
    JOIN public.customers AS c ON c.id = a.customer_id AND c.tenant_id = a.tenant_id
    JOIN public.services AS s ON s.id = a.service_id AND s.tenant_id = a.tenant_id
    JOIN public.tenants AS t ON t.id = a.tenant_id
    WHERE a.tenant_id = p_tenant_id
      AND a.status = 'completed'
      AND c.phone IS NOT NULL
      AND btrim(c.phone) <> ''
    ORDER BY a.customer_id, a.start_time DESC
  )
  SELECT
    lc.app_id,
    lc.t_id,
    lc.c_id,
    lc.c_name,
    lc.c_phone,
    lc.c_token,
    lc.s_id,
    lc.s_name,
    COALESCE(lc.s_return_days, 20),
    lc.s_template,
    lc.t_name,
    lc.days_passed
  FROM latest_completed AS lc
  WHERE lc.days_passed >= COALESCE(lc.s_return_days, 20)
    AND NOT EXISTS (
      SELECT 1
      FROM public.appointments AS future_app
      WHERE future_app.tenant_id = p_tenant_id
        AND future_app.customer_id = lc.c_id
        AND future_app.start_time > lc.start_time
        AND future_app.status IN ('confirmed', 'pending')
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_pending_return_reminders(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_return_reminders(uuid) TO service_role;
