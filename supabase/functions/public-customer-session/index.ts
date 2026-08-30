import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";

const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://dev.navalhado.com.br",
  "https://app.navalhado.com.br",
  "https://navalhado.com.br",
]);

const getCorsHeaders = (request: Request): Record<string, string> => {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://dev.navalhado.com.br",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};

const jsonResponse = (request: Request, body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(request), "Content-Type": "application/json" },
  });

const isNonEmptyString = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;

const verifyTurnstile = async (token: string, secret: string, request: Request): Promise<boolean> => {
  const form = new URLSearchParams({ secret, response: token });
  const remoteIp = request.headers.get("cf-connecting-ip");
  if (remoteIp) form.set("remoteip", remoteIp);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });

  if (!response.ok) return false;
  const result = await response.json() as { success?: boolean };
  return result.success === true;
};

Deno.serve(async (request: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(request);
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(request, { error: "Method not allowed" }, 405);

  const turnstileSecret = (Deno.env.get("TURNSTILE_SECRET_KEY") || "").trim();
  if (!turnstileSecret) {
    console.error("[public-customer-session] TURNSTILE_SECRET_KEY não configurada");
    return jsonResponse(request, { error: "Verificação de segurança indisponível." }, 500);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(request, { error: "Requisição inválida." }, 400);
  }

  const slug = typeof payload.slug === "string" ? payload.slug.trim() : "";
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
  const captchaToken = typeof payload.captchaToken === "string" ? payload.captchaToken.trim() : "";

  if (!isNonEmptyString(slug, 120) || !isNonEmptyString(name, 160) || !isNonEmptyString(phone, 30)) {
    return jsonResponse(request, { error: "Informe os dados do cliente." }, 400);
  }
  if (!isNonEmptyString(captchaToken, 4096)) {
    return jsonResponse(request, { error: "Conclua a verificação de segurança para continuar." }, 400);
  }

  try {
    if (!(await verifyTurnstile(captchaToken, turnstileSecret, request))) {
      return jsonResponse(request, { error: "Não foi possível validar a verificação de segurança." }, 403);
    }

    const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
    const supabaseKey = (Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "").trim();
    if (!supabaseUrl || !supabaseKey) {
      console.error("[public-customer-session] configuração do Supabase ausente");
      return jsonResponse(request, { error: "Serviço temporariamente indisponível." }, 500);
    }

    const authClient = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await authClient.auth.signInAnonymously();
    if (authError || !authData.session) {
      console.error("[public-customer-session] falha ao criar sessão anônima");
      return jsonResponse(request, { error: "Não foi possível iniciar a sessão pública." }, 502);
    }

    const sessionClient = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } },
    });
    const { data: profile, error: profileError } = await sessionClient.rpc("start_public_customer_session", {
      p_slug: slug,
      p_name: name,
      p_phone: phone,
    });
    if (profileError) {
      console.error("[public-customer-session] falha ao vincular sessão pública");
      return jsonResponse(request, { error: profileError.message }, 400);
    }

    return jsonResponse(request, { session: authData.session, profile });
  } catch {
    console.error("[public-customer-session] erro interno");
    return jsonResponse(request, { error: "Não foi possível iniciar a sessão pública." }, 500);
  }
});
