// Spec 049: handler do Send Email Hook. Verifica a assinatura Standard
// Webhooks, monta o e-mail e envia pelo Resend (injetado via deps, para
// teste). Um seam so -- esta funcao e testada de ponta a ponta (assinatura,
// montagem do e-mail e envio); montarEmail e detalhe interno, sem teste
// separado.
//
// Codigos de resposta seguem a doc de Auth Hooks: 200 = sucesso; 503 com
// retry-after = falha passageira (Supabase tenta de novo ate 3x em 5s);
// qualquer outro erro (400) = falha definitiva, sem retry. Nenhum log
// contem token, hash ou link de verificacao.
import { Webhook } from "standardwebhooks";
import { montarEmail, type SendEmailHookPayload } from "./email.tsx";

export interface EnvioResultado {
  ok: boolean;
  status: number;
}

export interface EnviarEmailDeps {
  enviar: (params: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    idempotencyKey: string;
  }) => Promise<EnvioResultado>;
}

export interface HandlerEnv {
  hookSecret: string;
  resendFrom: string;
  hasResendApiKey: boolean;
  supabaseUrl: string;
}

function respostaJson(body: Record<string, unknown>, status: number, retryAfter?: string): Response {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (retryAfter) headers["retry-after"] = retryAfter;
  return new Response(JSON.stringify(body), { status, headers });
}

export async function handleSendEmailHook(request: Request, deps: EnviarEmailDeps, env: HandlerEnv): Promise<Response> {
  if (request.method !== "POST") {
    return respostaJson({ error: { message: "Method not allowed" } }, 400);
  }

  if (!env.hookSecret || !env.resendFrom || !env.hasResendApiKey) {
    console.error("[send-auth-email] configuracao ausente (secret, remetente ou chave do Resend)");
    return respostaJson({ error: { message: "Serviço temporariamente indisponível." } }, 400);
  }

  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers);

  let payload: SendEmailHookPayload;
  try {
    const wh = new Webhook(env.hookSecret);
    payload = wh.verify(rawBody, headers) as SendEmailHookPayload;
  } catch {
    return respostaJson({ error: { message: "Assinatura inválida." } }, 400);
  }

  const resultado = await montarEmail(payload, env.supabaseUrl);
  if (!resultado.ok) {
    console.error(`[send-auth-email] ${resultado.erro}`);
    return respostaJson({ error: { message: resultado.erro } }, 400);
  }

  const webhookId = headers["webhook-id"] ?? crypto.randomUUID();
  const envio = await deps.enviar({
    from: env.resendFrom,
    to: payload.user.email,
    subject: resultado.email.assunto,
    html: resultado.email.html,
    text: resultado.email.texto,
    idempotencyKey: webhookId,
  });

  if (!envio.ok) {
    console.error(`[send-auth-email] falha no envio (Resend ${envio.status}, tipo ${payload.email_data.email_action_type})`);
    if (envio.status === 429 || envio.status >= 500) {
      return respostaJson({ error: { message: "Falha temporária ao enviar e-mail." } }, 503, "true");
    }
    return respostaJson({ error: { message: "Falha ao enviar e-mail." } }, 400);
  }

  console.log(`[send-auth-email] enviado (${payload.email_data.email_action_type})`);
  return respostaJson({}, 200);
}
