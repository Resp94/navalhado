// Spec 052, ticket 08: entrypoint fino da funcao send-billing-email. Le os secrets do ambiente e
// delega ao handler testavel em handler.tsx. Sem verificacao de JWT: quem chama e o cron do banco,
// que prova quem e com o segredo do Vault (billing_notices_secret) no cabecalho x-db-trigger-secret,
// e o banco confere. O remetente e a chave do Resend sao os mesmos dos e-mails de autenticacao.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";
import { type BillingEmailDeps, handleSendBillingEmail, limparAppUrl } from "./handler.tsx";

const enviarPeloResend = (apiKey: string): BillingEmailDeps["enviar"] => async (params) => {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": params.idempotencyKey,
      },
      body: JSON.stringify({ from: params.from, to: params.to, subject: params.subject, html: params.html, text: params.text }),
    });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  }
};

Deno.serve((request) => {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  const apiKey = (Deno.env.get("RESEND_API_KEY") || "").trim();
  const from = (Deno.env.get("BILLING_EMAIL_FROM") || Deno.env.get("AUTH_EMAIL_FROM") || "").trim();
  const appUrl = limparAppUrl(Deno.env.get("APP_URL") || "");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[send-billing-email] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao configurada");
    return new Response(JSON.stringify({ error: "Envio indisponivel." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  return handleSendBillingEmail(
    request,
    {
      rpc: (fn, args) => supabase.rpc(fn, args),
      enviar: enviarPeloResend(apiKey),
    },
    { appUrl, from, hasResendApiKey: apiKey.length > 0 },
  );
});
