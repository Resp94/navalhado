import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { isValidEmailFormat, verifyEmailDomain } from "./email.ts";

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

Deno.serve(async (request: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(request);
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(request, { error: "Method not allowed" }, 405);

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[create-barber-access] configuração do Supabase ausente");
    return jsonResponse(request, { error: "Serviço temporariamente indisponível." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const authHeader = request.headers.get("Authorization") || "";
  const bearerMatch = authHeader.match(/^Bearer\s+([^\s]+)$/i);
  if (!bearerMatch) {
    return jsonResponse(request, { error: "Não autenticado." }, 401);
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(bearerMatch[1]);
  if (authError || !authData.user) {
    return jsonResponse(request, { error: "Não autenticado." }, 401);
  }

  const { data: callerProfile, error: callerProfileError } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", authData.user.id)
    .single();

  if (callerProfileError || !callerProfile?.tenant_id || callerProfile.role !== "gerente") {
    return jsonResponse(request, { error: "Apenas gerentes podem criar acesso para profissionais." }, 403);
  }

  const tenantId = String(callerProfile.tenant_id);

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(request, { error: "Requisição inválida." }, 400);
  }

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const professionalId = typeof payload.professionalId === "string" ? payload.professionalId.trim() : "";

  if (!isNonEmptyString(email, 255) || !isValidEmailFormat(email)) {
    return jsonResponse(request, { error: "Informe um e-mail válido." }, 400);
  }
  const resultadoDominio = await verifyEmailDomain(email.split("@")[1] || "");
  if (resultadoDominio === "sem_mx") {
    return jsonResponse(request, { error: "Este domínio não recebe e-mails." }, 400);
  }
  if (password.length < 8) {
    return jsonResponse(request, { error: "A senha deve ter pelo menos 8 caracteres." }, 400);
  }
  if (!isNonEmptyString(professionalId, 64)) {
    return jsonResponse(request, { error: "Selecione um profissional." }, 400);
  }

  const { data: professional, error: professionalError } = await supabase
    .from("professionals")
    .select("id, name, user_id, is_active, tenant_id")
    .eq("id", professionalId)
    .eq("tenant_id", tenantId)
    .single();

  if (professionalError || !professional) {
    return jsonResponse(request, { error: "Profissional não encontrado." }, 404);
  }
  if (!professional.is_active) {
    return jsonResponse(request, { error: "Profissional está inativo." }, 400);
  }
  if (professional.user_id) {
    return jsonResponse(request, { error: "Este profissional já possui acesso configurado." }, 409);
  }

  const finalName = isNonEmptyString(name, 160) ? name : professional.name;

  const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: finalName },
  });

  if (createUserError || !createdUser.user) {
    console.error("[create-barber-access] falha ao criar usuário", createUserError?.message);
    const message = createUserError?.message?.includes("already been registered")
      ? "Este e-mail já está em uso."
      : "Não foi possível criar o acesso.";
    return jsonResponse(request, { error: message }, 400);
  }

  const newUserId = createdUser.user.id;

  // O trigger handle_new_user cria a linha em public.users com tenant_id nulo
  // (caminho padrão, sem tenant_signup). Precisa vincular ao tenant do gerente aqui.
  const { error: linkUserError } = await supabase
    .from("users")
    .update({ tenant_id: tenantId, name: finalName })
    .eq("id", newUserId);

  if (linkUserError) {
    console.error("[create-barber-access] falha ao vincular tenant ao usuário", linkUserError.message);
    await supabase.auth.admin.deleteUser(newUserId);
    return jsonResponse(request, { error: "Não foi possível concluir a criação do acesso." }, 500);
  }

  const { error: linkProfessionalError } = await supabase
    .from("professionals")
    .update({ user_id: newUserId })
    .eq("id", professionalId)
    .eq("tenant_id", tenantId);

  if (linkProfessionalError) {
    console.error("[create-barber-access] falha ao vincular profissional", linkProfessionalError.message);
    await supabase.auth.admin.deleteUser(newUserId);
    return jsonResponse(request, { error: "Não foi possível concluir a criação do acesso." }, 500);
  }

  return jsonResponse(request, { success: true, userId: newUserId });
});
