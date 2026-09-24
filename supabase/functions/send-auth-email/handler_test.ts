import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { handleSendEmailHook, type EnviarEmailDeps, type EnvioResultado, type HandlerEnv } from "./handler.tsx";

// Spec 049: o handler e o unico seam testado (assinatura, montagem do
// e-mail e envio). montarEmail e detalhe interno, coberto por aqui.

const TEST_SECRET = "MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";

const BASE_ENV: HandlerEnv = {
  hookSecret: TEST_SECRET,
  resendFrom: "Navalhado <noreply@dev.navalhado.com.br>",
  hasResendApiKey: true,
  supabaseUrl: "https://selvxobcjbkligxighlp.supabase.co",
};

function payloadRecovery() {
  return {
    user: { email: "usuario@example.com" },
    email_data: {
      token_hash: "hash-abc",
      redirect_to: "https://dev.navalhado.com.br/reset-password",
      email_action_type: "recovery",
      site_url: "https://dev.navalhado.com.br",
    },
  };
}

function assinar(body: string, webhookId = "msg_1"): Record<string, string> {
  const wh = new Webhook(TEST_SECRET);
  const timestamp = new Date();
  const signature = wh.sign(webhookId, timestamp, body);
  return {
    "webhook-id": webhookId,
    "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "webhook-signature": signature,
    "content-type": "application/json",
  };
}

function requisicao(payload: unknown, headers?: Record<string, string>): Request {
  const body = JSON.stringify(payload);
  return new Request("http://localhost/send-auth-email", {
    method: "POST",
    headers: headers ?? assinar(body),
    body,
  });
}

function depsQueSempreEnviam(): { deps: EnviarEmailDeps; chamadas: unknown[] } {
  const chamadas: unknown[] = [];
  return {
    chamadas,
    deps: {
      enviar: (params) => {
        chamadas.push(params);
        return Promise.resolve({ ok: true, status: 200 } satisfies EnvioResultado);
      },
    },
  };
}

Deno.test("recovery assinado: envia pelo Resend e responde 200", async () => {
  const { deps, chamadas } = depsQueSempreEnviam();

  const response = await handleSendEmailHook(requisicao(payloadRecovery()), deps, BASE_ENV);
  const corpo = await response.json();

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Content-Type"), "application/json");
  assertEquals(corpo, {});
  assertEquals(chamadas.length, 1);

  const chamada = chamadas[0] as Record<string, unknown>;
  assertEquals(chamada.from, BASE_ENV.resendFrom);
  assertEquals(chamada.to, "usuario@example.com");
  assertEquals(chamada.subject, "Redefina sua senha do Navalhado");
  assertEquals(chamada.idempotencyKey, "msg_1");

  const html = chamada.html as string;
  const texto = chamada.text as string;
  assertEquals(html.includes("type=recovery"), true);
  assertEquals(html.includes("redirect_to=https%3A%2F%2Fdev.navalhado.com.br%2Freset-password"), true);
  assertEquals(html.includes("https://dev.navalhado.com.br/email/logo.png"), true);
  assertEquals(texto.includes("type=recovery"), true);
});

Deno.test("tipo nao suportado: erro sem chamar o Resend", async () => {
  const { deps, chamadas } = depsQueSempreEnviam();
  const payload = payloadRecovery();
  payload.email_data.email_action_type = "signup";

  const response = await handleSendEmailHook(requisicao(payload), deps, BASE_ENV);

  assertEquals(response.status, 400);
  assertEquals(response.headers.get("Content-Type"), "application/json");
  assertEquals(chamadas.length, 0);
});

Deno.test("assinatura invalida: erro sem chamar o Resend", async () => {
  const { deps, chamadas } = depsQueSempreEnviam();
  const body = JSON.stringify(payloadRecovery());
  const request = new Request("http://localhost/send-auth-email", {
    method: "POST",
    headers: {
      "webhook-id": "msg_1",
      "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
      "webhook-signature": "v1,assinatura-errada",
    },
    body,
  });

  const response = await handleSendEmailHook(request, deps, BASE_ENV);

  assertEquals(response.status, 400);
  assertEquals(chamadas.length, 0);
});

Deno.test("secret ausente: erro sem ler assinatura nem chamar o Resend", async () => {
  const { deps, chamadas } = depsQueSempreEnviam();
  const env: HandlerEnv = { ...BASE_ENV, hasResendApiKey: false };

  const response = await handleSendEmailHook(requisicao(payloadRecovery()), deps, env);

  assertEquals(response.status, 400);
  assertEquals(chamadas.length, 0);
});

Deno.test("metodo diferente de POST: erro sem chamar o Resend", async () => {
  const { deps, chamadas } = depsQueSempreEnviam();
  const request = new Request("http://localhost/send-auth-email", { method: "GET" });

  const response = await handleSendEmailHook(request, deps, BASE_ENV);

  assertEquals(response.status, 400);
  assertEquals(chamadas.length, 0);
});

Deno.test("Resend 500: responde 503 com retry-after", async () => {
  const deps: EnviarEmailDeps = { enviar: () => Promise.resolve({ ok: false, status: 500 }) };

  const response = await handleSendEmailHook(requisicao(payloadRecovery()), deps, BASE_ENV);

  assertEquals(response.status, 503);
  assertEquals(response.headers.get("retry-after"), "true");
});

Deno.test("Resend 429: responde 503 com retry-after", async () => {
  const deps: EnviarEmailDeps = { enviar: () => Promise.resolve({ ok: false, status: 429 }) };

  const response = await handleSendEmailHook(requisicao(payloadRecovery()), deps, BASE_ENV);

  assertEquals(response.status, 503);
  assertEquals(response.headers.get("retry-after"), "true");
});

Deno.test("Resend 422: erro sem retry-after", async () => {
  const deps: EnviarEmailDeps = { enviar: () => Promise.resolve({ ok: false, status: 422 }) };

  const response = await handleSendEmailHook(requisicao(payloadRecovery()), deps, BASE_ENV);

  assertEquals(response.status, 400);
  assertEquals(response.headers.has("retry-after"), false);
});

Deno.test("idempotency key enviado ao Resend e o webhook-id da requisicao", async () => {
  let idempotencyKey = "";
  const deps: EnviarEmailDeps = {
    enviar: (params) => {
      idempotencyKey = params.idempotencyKey;
      return Promise.resolve({ ok: true, status: 200 });
    },
  };
  const body = JSON.stringify(payloadRecovery());

  await handleSendEmailHook(requisicao(payloadRecovery(), assinar(body, "webhook-xyz")), deps, BASE_ENV);

  assertEquals(idempotencyKey, "webhook-xyz");
});

Deno.test("logs nao contem token, hash nem link de verificacao", async () => {
  const mensagens: string[] = [];
  const originalError = console.error;
  const originalLog = console.log;
  console.error = (...args: unknown[]) => mensagens.push(args.map(String).join(" "));
  console.log = (...args: unknown[]) => mensagens.push(args.map(String).join(" "));

  try {
    const { deps } = depsQueSempreEnviam();
    await handleSendEmailHook(requisicao(payloadRecovery()), deps, BASE_ENV);
  } finally {
    console.error = originalError;
    console.log = originalLog;
  }

  const juntas = mensagens.join("\n");
  assertEquals(juntas.includes("hash-abc"), false);
  assertEquals(juntas.includes("/auth/v1/verify"), false);
});
