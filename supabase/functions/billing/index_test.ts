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

// ---------------------------------------------------------------------------
// Spec 052, ticket 09: trocar o cartao. O front gera o token nos campos seguros do Mercado Pago e
// manda so o token; a funcao troca o cartao da assinatura no provedor, sem cobrar nada, e grava a
// bandeira e o final do cartao novo.
// ---------------------------------------------------------------------------

const TOKEN_DO_CARTAO = "e3ed6f098462036dd2cbabe314b9de2a";
const ativa = { ...trialContext, status: "active", mp_subscription_id: "mp-sub-1", first_charge_at: null };
const trocar = (extra: Record<string, unknown> = {}) => request({ action: "trocar_cartao", cardToken: TOKEN_DO_CARTAO, ...extra });

Deno.test("trocar_cartao: manda so o token ao provedor e grava a bandeira e o final do cartao novo", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase({
    "rest/v1/rpc/get_billing_context": { status: 200, body: [ativa] },
    "rest/v1/rpc/record_card_change": { status: 200, body: true },
  });
  try {
    const res = await createHandler({ provider })(trocar());

    assertEquals(res.status, 200);
    assertEquals(await res.json(), { changed: true, cardBrand: "master", cardLast4: "5555" });
    assertEquals(provider.changedCards, [{ subscriptionId: "mp-sub-1", cardToken: TOKEN_DO_CARTAO }]);
    assertEquals(supabase.rpcCalls("record_card_change"), [{ p_tenant_id: "tenant-1", p_card_brand: "master", p_card_last4: "5555" }]);
    // Trocar o cartao nao cria assinatura nem cobra nada.
    assertEquals(provider.createdSubscriptions.length, 0);
  } finally {
    supabase.restore();
  }
});

for (const status of ["trialing", "active", "past_due", "blocked"]) {
  Deno.test(`trocar_cartao: aceita a barbearia ${status} que tem assinatura no Mercado Pago`, async () => {
    const provider = new FakePaymentProvider();
    const supabase = setupSupabase({
      "rest/v1/rpc/get_billing_context": { status: 200, body: [{ ...ativa, status }] },
      "rest/v1/rpc/record_card_change": { status: 200, body: true },
    });
    try {
      const res = await createHandler({ provider })(trocar());

      assertEquals(res.status, 200);
      assertEquals(provider.changedCards.length, 1);
    } finally {
      supabase.restore();
    }
  });
}

for (const status of ["canceled", "courtesy"]) {
  Deno.test(`trocar_cartao: recusa a barbearia ${status}, sem chamar o provedor`, async () => {
    const provider = new FakePaymentProvider();
    const supabase = setupSupabase({ "rest/v1/rpc/get_billing_context": { status: 200, body: [{ ...ativa, status }] } });
    try {
      const res = await createHandler({ provider })(trocar());

      assertEquals(res.status, 409);
      assertEquals(provider.changedCards.length, 0);
      assertEquals(supabase.rpcCalls("record_card_change").length, 0);
    } finally {
      supabase.restore();
    }
  });
}

Deno.test("trocar_cartao: sem assinatura no Mercado Pago ainda, manda assinar primeiro", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase({ "rest/v1/rpc/get_billing_context": { status: 200, body: [{ ...ativa, mp_subscription_id: null }] } });
  try {
    const res = await createHandler({ provider })(trocar());

    assertEquals(res.status, 409);
    assertEquals(provider.changedCards.length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("trocar_cartao: so o Gerente do tenant troca (Barbeiro, Gerente sem tenant e inativo recebem 403)", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase({ "rest/v1/rpc/get_billing_context": { status: 200, body: [] } });
  try {
    const res = await createHandler({ provider })(trocar());

    assertEquals(res.status, 403);
    assertEquals(provider.changedCards.length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("trocar_cartao: sem login responde 401", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase();
  try {
    const res = await createHandler({ provider })(request({ action: "trocar_cartao", cardToken: TOKEN_DO_CARTAO }, {}));

    assertEquals(res.status, 401);
    assertEquals(provider.changedCards.length, 0);
  } finally {
    supabase.restore();
  }
});

for (const cardToken of [undefined, "", "curto", "com espaço no meio 1234567890", "x".repeat(65), 1234567890123456, "../../users/me"]) {
  Deno.test(`trocar_cartao: token invalido (${JSON.stringify(cardToken)}) responde 400 sem chamar o provedor`, async () => {
    const provider = new FakePaymentProvider();
    const supabase = setupSupabase({ "rest/v1/rpc/get_billing_context": { status: 200, body: [ativa] } });
    try {
      const res = await createHandler({ provider })(request({ action: "trocar_cartao", cardToken }));

      assertEquals(res.status, 400);
      assertEquals(provider.changedCards.length, 0);
    } finally {
      supabase.restore();
    }
  });
}

// So 400 e 422 dizem que o cartao (o token) foi recusado: o Gerente confere os dados e tenta de novo.
for (const status of [400, 422]) {
  Deno.test(`trocar_cartao: o Mercado Pago recusa o cartao (${status}): 422 com texto claro, sem o token`, async () => {
    const provider = new FakePaymentProvider();
    provider.failWith = new PaymentProviderError(`Mercado Pago respondeu ${status}: Invalid card_token_id`, status);
    const supabase = setupSupabase({ "rest/v1/rpc/get_billing_context": { status: 200, body: [ativa] } });
    try {
      const res = await createHandler({ provider })(trocar());
      const body = await res.json();

      assertEquals(res.status, 422);
      assertEquals(body.error, "O Mercado Pago não aceitou o cartão. Confira os dados ou use outro cartão.");
      assertEquals(JSON.stringify(body).includes(TOKEN_DO_CARTAO), false);
      assertEquals(supabase.rpcCalls("record_card_change").length, 0);
    } finally {
      supabase.restore();
    }
  });
}

// Qualquer outra falha do provedor (credencial errada, assinatura ou token nao encontrados, limite de
// requisicoes, fora do ar, sem rede) nao e culpa do cartao: mandar o Gerente digita-lo de novo nao
// resolve. Ele recebe um texto neutro, e so o log guarda o status para quem cuida da configuracao.
for (const status of [401, 403, 404, 429, 503, undefined]) {
  Deno.test(`trocar_cartao: falha do provedor que nao e do cartao (${status ?? "sem resposta"}): 502 neutro, sem gravar nada`, async () => {
    const provider = new FakePaymentProvider();
    provider.failWith = new PaymentProviderError(`Mercado Pago respondeu ${status}: falha`, status);
    const supabase = setupSupabase({ "rest/v1/rpc/get_billing_context": { status: 200, body: [ativa] } });
    try {
      const res = await createHandler({ provider })(trocar());
      const body = await res.json();

      assertEquals(res.status, 502);
      assertEquals(body.error, "Não foi possível trocar o cartão agora. Tente de novo em instantes.");
      assertEquals(supabase.rpcCalls("record_card_change").length, 0);
    } finally {
      supabase.restore();
    }
  });
}

// O que o provedor devolve vai para uma funcao do banco que recusa formato inesperado. Se o cartao ja
// foi trocado no Mercado Pago, um final mascarado ou uma bandeira estranha nao pode virar erro 500:
// o valor fora do formato e descartado (a tela mostra so o que veio certo).
Deno.test("trocar_cartao: final ou bandeira fora do formato viram nulos, e a troca ja feita continua valendo", async () => {
  const provider = new FakePaymentProvider();
  provider.nextChangedCard = { cardBrand: "visa.debito", cardLast4: "****5682" };
  const supabase = setupSupabase({
    "rest/v1/rpc/get_billing_context": { status: 200, body: [ativa] },
    "rest/v1/rpc/record_card_change": { status: 200, body: true },
  });
  try {
    const res = await createHandler({ provider })(trocar());

    assertEquals(res.status, 200);
    assertEquals(await res.json(), { changed: true, cardBrand: null, cardLast4: null });
    assertEquals(supabase.rpcCalls("record_card_change"), [{ p_tenant_id: "tenant-1", p_card_brand: null, p_card_last4: null }]);
  } finally {
    supabase.restore();
  }
});

Deno.test("trocar_cartao: so o que veio no formato certo e mantido (bandeira sem final, final sem bandeira)", async () => {
  for (const [changed, esperado] of [
    [{ cardBrand: "debelo", cardLast4: undefined }, { p_card_brand: "debelo", p_card_last4: null }],
    [{ cardBrand: undefined, cardLast4: "0042" }, { p_card_brand: null, p_card_last4: "0042" }],
    [{ cardBrand: "master", cardLast4: "12345" }, { p_card_brand: "master", p_card_last4: null }],
  ] as const) {
    const provider = new FakePaymentProvider();
    provider.nextChangedCard = changed;
    const supabase = setupSupabase({
      "rest/v1/rpc/get_billing_context": { status: 200, body: [ativa] },
      "rest/v1/rpc/record_card_change": { status: 200, body: true },
    });
    try {
      const res = await createHandler({ provider })(trocar());

      assertEquals(res.status, 200);
      assertEquals(supabase.rpcCalls("record_card_change"), [{ p_tenant_id: "tenant-1", ...esperado }]);
    } finally {
      supabase.restore();
    }
  }
});

Deno.test("trocar_cartao: se o banco nao grava o cartao novo, diz que a troca aconteceu mas a tela nao atualizou", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase({
    "rest/v1/rpc/get_billing_context": { status: 200, body: [ativa] },
    "rest/v1/rpc/record_card_change": { status: 500, body: { message: "boom" } },
  });
  try {
    const res = await createHandler({ provider })(trocar());
    const body = await res.json();

    assertEquals(res.status, 500);
    assertEquals(body.error, "O cartão foi trocado no Mercado Pago, mas não conseguimos atualizar a tela. Recarregue a página.");
    assertEquals(provider.changedCards.length, 1);
  } finally {
    supabase.restore();
  }
});

// O Mercado Pago nao devolve o final do cartao na troca (so a bandeira). O navegador tem o final: o SDK o
// devolve junto do token. Ele o manda como dica de exibicao, para o Gerente reconhecer o cartao na tela; a
// funcao so grava valor com 4 digitos, o que o provedor devolver vale mais, e a proxima cobranca aprovada
// traz o final de verdade e o sobrescreve.
Deno.test("trocar_cartao: sem o final do provedor, grava o final que o navegador mandou", async () => {
  const provider = new FakePaymentProvider();
  provider.nextChangedCard = { cardBrand: "master", cardLast4: undefined };
  const supabase = setupSupabase({
    "rest/v1/rpc/get_billing_context": { status: 200, body: [ativa] },
    "rest/v1/rpc/record_card_change": { status: 200, body: true },
  });
  try {
    const res = await createHandler({ provider })(trocar({ cardLast4: "0604" }));

    assertEquals(res.status, 200);
    assertEquals(await res.json(), { changed: true, cardBrand: "master", cardLast4: "0604" });
    assertEquals(supabase.rpcCalls("record_card_change"), [{ p_tenant_id: "tenant-1", p_card_brand: "master", p_card_last4: "0604" }]);
  } finally {
    supabase.restore();
  }
});

Deno.test("trocar_cartao: o final que o provedor devolve vale mais que o que o navegador mandou", async () => {
  const provider = new FakePaymentProvider();
  provider.nextChangedCard = { cardBrand: "master", cardLast4: "9999" };
  const supabase = setupSupabase({
    "rest/v1/rpc/get_billing_context": { status: 200, body: [ativa] },
    "rest/v1/rpc/record_card_change": { status: 200, body: true },
  });
  try {
    const res = await createHandler({ provider })(trocar({ cardLast4: "0604" }));

    assertEquals(res.status, 200);
    assertEquals((await res.json()).cardLast4, "9999");
    assertEquals(supabase.rpcCalls("record_card_change"), [{ p_tenant_id: "tenant-1", p_card_brand: "master", p_card_last4: "9999" }]);
  } finally {
    supabase.restore();
  }
});

for (const dica of [undefined, null, "", "12", "12345", "abcd", "06 04", "0604\n", 604, ["0604"], { final: "0604" }]) {
  Deno.test(`trocar_cartao: final do navegador fora do formato (${JSON.stringify(dica) ?? "ausente"}) e ignorado, sem recusar a troca`, async () => {
    const provider = new FakePaymentProvider();
    provider.nextChangedCard = { cardBrand: "master", cardLast4: undefined };
    const supabase = setupSupabase({
      "rest/v1/rpc/get_billing_context": { status: 200, body: [ativa] },
      "rest/v1/rpc/record_card_change": { status: 200, body: true },
    });
    try {
      const res = await createHandler({ provider })(trocar({ cardLast4: dica }));

      assertEquals(res.status, 200);
      assertEquals((await res.json()).cardLast4, null);
      assertEquals(supabase.rpcCalls("record_card_change"), [{ p_tenant_id: "tenant-1", p_card_brand: "master", p_card_last4: null }]);
    } finally {
      supabase.restore();
    }
  });
}

Deno.test("trocar_cartao: o Mercado Pago recusa o cartao: o final do navegador nao e gravado", async () => {
  const provider = new FakePaymentProvider();
  provider.failWith = new PaymentProviderError("Mercado Pago respondeu 400: Unsupported_credit_card_for_recurring_payment", 400);
  const supabase = setupSupabase({ "rest/v1/rpc/get_billing_context": { status: 200, body: [ativa] } });
  try {
    const res = await createHandler({ provider })(trocar({ cardLast4: "0604" }));

    assertEquals(res.status, 422);
    assertEquals(supabase.rpcCalls("record_card_change").length, 0);
  } finally {
    supabase.restore();
  }
});

// O log da falha guarda o texto de erro do Mercado Pago (e o status) para quem cuida da configuracao ver
// o motivo; se esse texto citar o token do cartao, o token sai antes de o log ser escrito.
Deno.test("trocar_cartao: o log traz o motivo que o Mercado Pago deu, sem o token", async () => {
  const linhas: string[] = [];
  const originais = { log: console.log, info: console.info, error: console.error, warn: console.warn };
  console.log = console.info = console.error = console.warn = (...args: unknown[]) => linhas.push(args.map(String).join(" "));
  const provider = new FakePaymentProvider();
  provider.failWith = new PaymentProviderError(`Mercado Pago respondeu 400: card_token_id ${TOKEN_DO_CARTAO} is invalid`, 400);
  const supabase = setupSupabase({ "rest/v1/rpc/get_billing_context": { status: 200, body: [ativa] } });
  try {
    await createHandler({ provider })(trocar());
  } finally {
    Object.assign(console, originais);
    supabase.restore();
  }

  const log = linhas.join("\n");
  assertEquals(log.includes("status 400"), true, log);
  assertEquals(log.includes("is invalid"), true, log);
  assertEquals(log.includes(TOKEN_DO_CARTAO), false, log);
  assertEquals(log.includes("[token]"), true, log);
});

Deno.test("trocar_cartao: nenhum log leva o token do cartao", async () => {
  const linhas: string[] = [];
  const originais = { log: console.log, info: console.info, error: console.error, warn: console.warn };
  console.log = console.info = console.error = console.warn = (...args: unknown[]) => linhas.push(args.map(String).join(" "));
  const provider = new FakePaymentProvider();
  provider.failWith = new PaymentProviderError("Mercado Pago respondeu 400: Invalid card_token_id", 400);
  const supabase = setupSupabase({ "rest/v1/rpc/get_billing_context": { status: 200, body: [ativa] } });
  try {
    await createHandler({ provider })(trocar());
  } finally {
    Object.assign(console, originais);
    supabase.restore();
  }

  assertEquals(linhas.some((linha) => linha.includes(TOKEN_DO_CARTAO)), false, linhas.join("\n"));
});

// A Public Key nao e segredo (vai para o navegador), mas fica em secret do Supabase como o resto da
// configuracao do Mercado Pago: cada ambiente tem a sua, e o front pergunta a chave a esta funcao.
const CHAVE_PUBLICA = "APP_USR-4fe1b3c6-8ed5-4c1e-a5e3-3b0d8d7e1e01";

Deno.test("chave_publica: devolve a Public Key do ambiente ao Gerente", async () => {
  Deno.env.set("MP_PUBLIC_KEY", CHAVE_PUBLICA);
  const supabase = setupSupabase({ "rest/v1/rpc/get_billing_context": { status: 200, body: [ativa] } });
  try {
    const res = await createHandler({ provider: new FakePaymentProvider() })(request({ action: "chave_publica" }));

    assertEquals(res.status, 200);
    assertEquals(await res.json(), { publicKey: CHAVE_PUBLICA });
  } finally {
    supabase.restore();
    Deno.env.delete("MP_PUBLIC_KEY");
  }
});

Deno.test("chave_publica: aceita a chave de teste (TEST-) e tira os espacos das pontas do secret", async () => {
  Deno.env.set("MP_PUBLIC_KEY", "  TEST-4FE1B3C6-8ED5-4C1E-A5E3-3B0D8D7E1E01\n");
  const supabase = setupSupabase({ "rest/v1/rpc/get_billing_context": { status: 200, body: [ativa] } });
  try {
    const res = await createHandler({ provider: new FakePaymentProvider() })(request({ action: "chave_publica" }));

    assertEquals(res.status, 200);
    assertEquals(await res.json(), { publicKey: "TEST-4FE1B3C6-8ED5-4C1E-A5E3-3B0D8D7E1E01" });
  } finally {
    supabase.restore();
    Deno.env.delete("MP_PUBLIC_KEY");
  }
});

// A funcao entrega o valor do secret a qualquer Gerente logado. Se alguem colar no lugar da Public Key
// o Access Token (que comeca igual: APP_USR-...) ou o Client Secret, o segredo iria para o navegador.
// So sai valor com o formato de Public Key; o resto vira erro 500, e o log diz o que corrigir sem
// repetir o valor.
for (const [nome, valor] of [
  ["o Access Token", "APP_USR-8804558755729035-092911-0123456789abcdef0123456789abcdef-3726971584"],
  ["um Client Secret", "0123456789abcdef0123456789abcdef"],
  ["um texto solto", "APP_USR-public-key-de-teste"],
  ["a chave com aspas coladas", `"${CHAVE_PUBLICA}"`],
  ["a chave seguida de outro valor", `${CHAVE_PUBLICA} ${CHAVE_PUBLICA}`],
] as const) {
  Deno.test(`chave_publica: recusa ${nome} no lugar da Public Key, sem devolver nem logar o valor`, async () => {
    const linhas: string[] = [];
    const originais = { log: console.log, info: console.info, error: console.error, warn: console.warn };
    console.log = console.info = console.error = console.warn = (...args: unknown[]) => linhas.push(args.map(String).join(" "));
    Deno.env.set("MP_PUBLIC_KEY", valor);
    const supabase = setupSupabase({ "rest/v1/rpc/get_billing_context": { status: 200, body: [ativa] } });
    try {
      const res = await createHandler({ provider: new FakePaymentProvider() })(request({ action: "chave_publica" }));
      const corpo = await res.text();

      assertEquals(res.status, 500);
      assertEquals(corpo.includes(valor), false);
      assertEquals(linhas.length > 0, true, "o erro de configuracao precisa aparecer no log");
      assertEquals(linhas.some((linha) => linha.includes(valor.trim())), false, linhas.join("\n"));
    } finally {
      Object.assign(console, originais);
      supabase.restore();
      Deno.env.delete("MP_PUBLIC_KEY");
    }
  });
}

Deno.test("chave_publica: sem a chave configurada, responde 500 sem inventar nada", async () => {
  Deno.env.delete("MP_PUBLIC_KEY");
  const supabase = setupSupabase({ "rest/v1/rpc/get_billing_context": { status: 200, body: [ativa] } });
  try {
    const res = await createHandler({ provider: new FakePaymentProvider() })(request({ action: "chave_publica" }));

    assertEquals(res.status, 500);
  } finally {
    supabase.restore();
  }
});

Deno.test("chave_publica: so o Gerente do tenant recebe a chave", async () => {
  Deno.env.set("MP_PUBLIC_KEY", CHAVE_PUBLICA);
  const supabase = setupSupabase({ "rest/v1/rpc/get_billing_context": { status: 200, body: [] } });
  try {
    const res = await createHandler({ provider: new FakePaymentProvider() })(request({ action: "chave_publica" }));

    assertEquals(res.status, 403);
  } finally {
    supabase.restore();
    Deno.env.delete("MP_PUBLIC_KEY");
  }
});
