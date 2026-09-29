import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createHandler } from "./index.ts";
import { FakePaymentProvider } from "../_shared/fake_payment_provider.ts";
import { PaymentProviderError } from "../_shared/payment_provider.ts";

Deno.env.set("SUPABASE_URL", "https://mock-supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
Deno.env.set("APP_URL", "https://mock-app.com");

// Spec 052, ticket 05: acao "assinar" da Edge Function de cobranca. O provedor e o falso; o
// Supabase e simulado no nivel do fetch, como nos testes da whatsapp-integration.

type Call = { url: string; method: string; body: unknown };
type Mock = { status: number; body: unknown };

const trialContext = {
  user_id: "user-1",
  tenant_id: "tenant-1",
  email: "gerente@barbearia.test",
  tenant_name: "Barbearia Estilo",
  plan_id: "plan-maquina",
  plan_name: "Máquina",
  plan_price: 89.9,
  status: "trialing",
  mp_subscription_id: null,
  first_charge_at: "2026-10-14T15:00:00+00:00",
};

const setupSupabase = (overrides: Record<string, Mock> = {}) => {
  const original = globalThis.fetch;
  const calls: Call[] = [];
  const mocks: Record<string, Mock> = {
    "auth/v1/user": { status: 200, body: { id: "user-1", email: "gerente@barbearia.test" } },
    "rest/v1/rpc/get_billing_context": { status: 200, body: [trialContext] },
    "rest/v1/rpc/record_mp_subscription": { status: 200, body: null },
    ...overrides,
  };

  globalThis.fetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, method: init?.method ?? "GET", body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined });
    for (const [key, mock] of Object.entries(mocks)) {
      if (url.includes(key)) {
        return Promise.resolve(new Response(JSON.stringify(mock.body), {
          status: mock.status,
          headers: { "Content-Type": "application/json" },
        }));
      }
    }
    return Promise.resolve(new Response(JSON.stringify({ error: `Mock not configured for ${url}` }), { status: 404 }));
  };

  return {
    calls,
    rpcCalls: (name: string) => calls.filter((c) => c.url.includes(`rest/v1/rpc/${name}`)).map((c) => c.body),
    restore: () => {
      globalThis.fetch = original;
    },
  };
};

const request = (body: unknown = { action: "assinar" }, headers: Record<string, string> = { Authorization: "Bearer user-jwt" }) =>
  new Request("https://mock-supabase.co/functions/v1/billing", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

Deno.test("assinar during the trial: the first charge is the end of the trial and the id is recorded", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase();
  try {
    const res = await createHandler({ provider })(request());

    assertEquals(res.status, 200);
    assertEquals(await res.json(), {
      paymentLink: "https://provider.test/checkout/fake-sub-1",
      subscriptionId: "fake-sub-1",
      firstChargeAt: "2026-10-14T15:00:00.000Z",
    });
    assertEquals(provider.createdSubscriptions.length, 1);
    const created = provider.createdSubscriptions[0];
    assertEquals(created.amount, 89.9);
    assertEquals(created.payerEmail, "gerente@barbearia.test");
    assertEquals(created.externalReference, "tenant-1");
    assertEquals(created.startDate?.toISOString(), "2026-10-14T15:00:00.000Z");
    assertEquals(created.backUrl, "https://mock-app.com/configuracoes?assinatura=retorno");
    assertEquals(created.reason, "Navalhado - plano Máquina");
    // A chave de idempotencia e estavel: o mesmo pedido no mesmo dia volta com a mesma assinatura.
    assertEquals(/^assinar:tenant-1:89\.9:2026-10-14T15:00:00\.000Z:\d{4}-\d{2}-\d{2}$/.test(created.idempotencyKey ?? ""), true);
    assertEquals(supabase.rpcCalls("get_billing_context"), [{ p_user_id: "user-1" }]);
    assertEquals(supabase.rpcCalls("record_mp_subscription"), [{ p_tenant_id: "tenant-1", p_mp_subscription_id: "fake-sub-1" }]);
  } finally {
    supabase.restore();
  }
});

Deno.test("assinar when blocked: the first charge is immediate (no start date)", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase({
    "rest/v1/rpc/get_billing_context": {
      status: 200,
      body: [{ ...trialContext, status: "blocked", first_charge_at: null }],
    },
  });
  try {
    const res = await createHandler({ provider })(request());

    assertEquals(res.status, 200);
    assertEquals((await res.json()).firstChargeAt, null);
    assertEquals(provider.createdSubscriptions[0].startDate, undefined);
  } finally {
    supabase.restore();
  }
});

Deno.test("assinar twice with the same data sends the same idempotency key, so a double click does not create two subscriptions", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase({
    "rest/v1/rpc/get_billing_context": { status: 200, body: [{ ...trialContext, status: "blocked", first_charge_at: null }] },
  });
  try {
    const handler = createHandler({ provider });
    await handler(request());
    await handler(request());

    assertEquals(provider.createdSubscriptions.length, 2);
    assertEquals(provider.createdSubscriptions[0].idempotencyKey, provider.createdSubscriptions[1].idempotencyKey);
    assertEquals(/^assinar:tenant-1:89\.9:agora:\d{4}-\d{2}-\d{2}$/.test(provider.createdSubscriptions[0].idempotencyKey ?? ""), true);
  } finally {
    supabase.restore();
  }
});

Deno.test("assinar again after a cancellation creates a new subscription and records the new id", async () => {
  const provider = new FakePaymentProvider();
  provider.nextSubscriptionId = "fake-sub-2";
  provider.subscriptions.set("fake-sub-1", { id: "fake-sub-1", status: "cancelled" });
  const supabase = setupSupabase({
    "rest/v1/rpc/get_billing_context": {
      status: 200,
      body: [{ ...trialContext, status: "canceled", mp_subscription_id: "fake-sub-1", first_charge_at: null }],
    },
  });
  try {
    const res = await createHandler({ provider })(request());

    assertEquals(res.status, 200);
    assertEquals(provider.createdSubscriptions.length, 1);
    assertEquals(supabase.rpcCalls("record_mp_subscription"), [{ p_tenant_id: "tenant-1", p_mp_subscription_id: "fake-sub-2" }]);
  } finally {
    supabase.restore();
  }
});

// Assinar de novo nao pode deixar a assinatura anterior cobrando: se ela ainda esta ativa no
// Mercado Pago (o tenant foi bloqueado por cartao recusado, por exemplo), a barbearia seria
// cobrada duas vezes. A funcao de cancelar so existe no ticket 12; ate la, recusa.
Deno.test("assinar refuses to create another subscription while the previous one is still authorized at the provider", async () => {
  const provider = new FakePaymentProvider();
  provider.subscriptions.set("fake-sub-1", { id: "fake-sub-1", status: "authorized" });
  const supabase = setupSupabase({
    "rest/v1/rpc/get_billing_context": {
      status: 200,
      body: [{ ...trialContext, status: "blocked", mp_subscription_id: "fake-sub-1", first_charge_at: null }],
    },
  });
  try {
    const res = await createHandler({ provider })(request());

    assertEquals(res.status, 409);
    assertEquals(provider.createdSubscriptions.length, 0);
    assertEquals(supabase.rpcCalls("record_mp_subscription").length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("assinar also refuses while the previous subscription is paused at the provider", async () => {
  const provider = new FakePaymentProvider();
  provider.subscriptions.set("fake-sub-1", { id: "fake-sub-1", status: "paused" });
  const supabase = setupSupabase({
    "rest/v1/rpc/get_billing_context": { status: 200, body: [{ ...trialContext, mp_subscription_id: "fake-sub-1" }] },
  });
  try {
    assertEquals((await createHandler({ provider })(request())).status, 409);
    assertEquals(provider.createdSubscriptions.length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("assinar allows a new subscription when the previous one never got authorized (pending) or no longer exists", async () => {
  for (const previous of [{ id: "fake-sub-1", status: "pending" }, undefined]) {
    const provider = new FakePaymentProvider();
    if (previous) provider.subscriptions.set("fake-sub-1", previous);
    const supabase = setupSupabase({
      "rest/v1/rpc/get_billing_context": { status: 200, body: [{ ...trialContext, mp_subscription_id: "fake-sub-1" }] },
    });
    try {
      assertEquals((await createHandler({ provider })(request())).status, 200);
      assertEquals(provider.createdSubscriptions.length, 1);
    } finally {
      supabase.restore();
    }
  }
});

Deno.test("assinar answers 502 when it cannot check the previous subscription at the provider", async () => {
  const provider = new FakePaymentProvider();
  provider.failWith = new PaymentProviderError("Mercado Pago respondeu 500: erro", 500);
  const supabase = setupSupabase({
    "rest/v1/rpc/get_billing_context": { status: 200, body: [{ ...trialContext, mp_subscription_id: "fake-sub-1" }] },
  });
  try {
    assertEquals((await createHandler({ provider })(request())).status, 502);
    assertEquals(provider.createdSubscriptions.length, 0);
  } finally {
    supabase.restore();
  }
});

// O Mercado Pago so aceita back_url https valido; um APP_URL sem esquema (ou http) e erro nosso,
// e a resposta e uma falha de configuracao clara, sem chamar o provedor.
// A whatsapp-integration limpa o APP_URL do mesmo jeito (tira um prefixo "APP_URL=" colado por
// engano no painel e a barra final); a cobranca le o mesmo valor do mesmo jeito, para nao precisar
// mexer no secret que o WhatsApp ja usa.
Deno.test("assinar reads APP_URL like the WhatsApp function: it accepts a pasted APP_URL= prefix and trailing slashes", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase();
  const original = Deno.env.get("APP_URL");
  try {
    for (const valor of ["APP_URL=https://dev.navalhado.com.br/", "  https://dev.navalhado.com.br//  ", "https://dev.navalhado.com.br"]) {
      Deno.env.set("APP_URL", valor);
      provider.createdSubscriptions.length = 0;

      const res = await createHandler({ provider })(request());

      assertEquals(res.status, 200);
      assertEquals(provider.createdSubscriptions[0].backUrl, "https://dev.navalhado.com.br/configuracoes?assinatura=retorno");
    }
  } finally {
    Deno.env.set("APP_URL", original ?? "https://mock-app.com");
    supabase.restore();
  }
});

Deno.test("assinar answers 500 without calling the provider when APP_URL is not an https URL", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase();
  const original = Deno.env.get("APP_URL");
  try {
    for (const invalido of ["dev.navalhado.com.br", "http://dev.navalhado.com.br", "localhost:5173"]) {
      Deno.env.set("APP_URL", invalido);

      const res = await createHandler({ provider })(request());

      assertEquals(res.status, 500);
    }
    assertEquals(provider.createdSubscriptions.length, 0);
    assertEquals(supabase.rpcCalls("record_mp_subscription").length, 0);
  } finally {
    Deno.env.set("APP_URL", original ?? "https://mock-app.com");
    supabase.restore();
  }
});

Deno.test("without the provider token configured, assinar answers 500 and never calls the provider", async () => {
  const supabase = setupSupabase();
  Deno.env.delete("MP_ACCESS_TOKEN");
  try {
    const res = await createHandler()(request());

    assertEquals(res.status, 500);
    assertEquals(supabase.calls.some((call) => call.url.includes("api.mercadopago.com")), false);
    assertEquals(supabase.rpcCalls("record_mp_subscription").length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("assinar refuses a request without a token and never reaches the provider", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase();
  try {
    const res = await createHandler({ provider })(request({ action: "assinar" }, {}));

    assertEquals(res.status, 401);
    assertEquals(provider.createdSubscriptions.length, 0);
    assertEquals(supabase.calls.length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("assinar refuses an invalid token (anonymous caller)", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase({ "auth/v1/user": { status: 401, body: { message: "invalid JWT" } } });
  try {
    const res = await createHandler({ provider })(request());

    assertEquals(res.status, 401);
    assertEquals(provider.createdSubscriptions.length, 0);
    assertEquals(supabase.rpcCalls("get_billing_context").length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("assinar refuses whoever the database does not recognize as the manager of a barbershop (barber, manager without tenant, inactive)", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase({ "rest/v1/rpc/get_billing_context": { status: 200, body: [] } });
  try {
    const res = await createHandler({ provider })(request());

    assertEquals(res.status, 403);
    assertEquals(provider.createdSubscriptions.length, 0);
    assertEquals(supabase.rpcCalls("record_mp_subscription").length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("assinar refuses a tenant that already has an active subscription", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase({
    "rest/v1/rpc/get_billing_context": { status: 200, body: [{ ...trialContext, status: "active", mp_subscription_id: "fake-sub-1" }] },
  });
  try {
    const res = await createHandler({ provider })(request());

    assertEquals(res.status, 409);
    assertEquals(provider.createdSubscriptions.length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("assinar refuses a tenant with a pending payment failure: the card must be changed instead", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase({
    "rest/v1/rpc/get_billing_context": { status: 200, body: [{ ...trialContext, status: "past_due" }] },
  });
  try {
    const res = await createHandler({ provider })(request());

    assertEquals(res.status, 409);
    assertEquals(provider.createdSubscriptions.length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("assinar answers 502 when the provider fails and records nothing", async () => {
  const provider = new FakePaymentProvider();
  provider.failWith = new PaymentProviderError("Mercado Pago respondeu 400: Invalid value for payer_email", 400);
  const supabase = setupSupabase();
  try {
    const res = await createHandler({ provider })(request());

    assertEquals(res.status, 502);
    const text = await res.text();
    assertEquals(text.includes("payer_email"), false);
    assertEquals(supabase.rpcCalls("record_mp_subscription").length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("assinar answers 409 when the database refuses to record the new subscription", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase({
    "rest/v1/rpc/record_mp_subscription": {
      status: 400,
      body: { code: "55000", message: "SUBSCRIPTION_NOT_UPDATABLE: a assinatura do tenant nao aceita uma nova assinatura." },
    },
  });
  try {
    const res = await createHandler({ provider })(request());

    assertEquals(res.status, 409);
  } finally {
    supabase.restore();
  }
});

Deno.test("assinar answers 500 when the subscription cannot be read", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase({ "rest/v1/rpc/get_billing_context": { status: 500, body: { message: "boom" } } });
  try {
    const res = await createHandler({ provider })(request());

    assertEquals(res.status, 500);
    assertEquals(provider.createdSubscriptions.length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("billing rejects unknown actions, invalid bodies and other methods", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase();
  try {
    const handler = createHandler({ provider });

    assertEquals((await handler(request({ action: "explodir" }))).status, 400);
    assertEquals((await handler(request("nao e objeto"))).status, 400);
    assertEquals((await handler(new Request("https://mock-supabase.co/functions/v1/billing", { method: "GET" }))).status, 405);
    const preflight = await handler(new Request("https://mock-supabase.co/functions/v1/billing", {
      method: "OPTIONS",
      headers: { Origin: "https://dev.navalhado.com.br" },
    }));
    assertEquals(preflight.status, 200);
    assertEquals(preflight.headers.get("Access-Control-Allow-Origin"), "https://dev.navalhado.com.br");
    assertEquals(provider.createdSubscriptions.length, 0);
  } finally {
    supabase.restore();
  }
});
