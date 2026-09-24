// Spec 049: entrypoint fino. Le as secrets do ambiente e delega ao handler
// testavel em handler.tsx. Sem verificacao de JWT -- o hook nao manda um; a
// assinatura Standard Webhooks (verificada dentro do handler) cumpre esse
// papel.
import { handleSendEmailHook, type EnviarEmailDeps } from "./handler.tsx";

function enviarPeloResend(apiKey: string): EnviarEmailDeps["enviar"] {
  return async ({ from, to, subject, html, text, idempotencyKey }) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    return { ok: response.ok, status: response.status };
  };
}

Deno.serve((request) => {
  const apiKey = (Deno.env.get("RESEND_API_KEY") || "").trim();
  const hookSecret = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") || "").replace("v1,whsec_", "").trim();
  const resendFrom = (Deno.env.get("AUTH_EMAIL_FROM") || "").trim();
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();

  return handleSendEmailHook(
    request,
    { enviar: enviarPeloResend(apiKey) },
    { hookSecret, resendFrom, hasResendApiKey: apiKey.length > 0, supabaseUrl }
  );
});
