import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createHandler } from "./index.ts";
import { FakePaymentProvider } from "../_shared/fake_payment_provider.ts";
import { PaymentProviderError } from "../_shared/payment_provider.ts";

Deno.env.set("SUPABASE_URL", "https://mock-supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
Deno.env.set("APP_URL", "https://mock-app.com");

// Spec 052, ticket 05: acao "assinar" da Edge Function de cobranca. O provedor e o falso; o
// Supabase e simulado no nivel do fetch, como nos testes da whatsapp-integration.

type Call = { url: string; method: string; body: unknown; authorization?: string };
// Uma funcao no lugar da resposta roda a cada chamada: o teste devolve respostas diferentes em sequencia.
type MockResponse = { status: number; body: unknown };
type Mock = MockResponse | (() => MockResponse);

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
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      authorization: new Headers(init?.headers).get("authorization") ?? undefined,
    });
    for (const [key, mock] of Object.entries(mocks)) {
      if (url.includes(key)) {
        const response = typeof mock === "function" ? mock() : mock;
        return Promise.resolve(new Response(JSON.stringify(response.body), {
          status: response.status,
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

// Assinar de novo nao pode deixar a assinatura anterior cobrando: se ela ainda esta viva no Mercado Pago, a barbearia seria
// cobrada duas vezes. Quem esta BLOQUEADA (estorno, contestacao, bloqueio manual do Proprietario) ficava sem saida: a
// assinatura anterior seguia ativa la e o "Pagar" recebia 409. Agora a funcao a cancela ANTES de criar a nova (ticket 12).
// So vale para a barbearia bloqueada: em teste, ou cancelada que ja assinou de novo, a assinatura viva e a que vale. E nao
// vale para a que mudou ha pouco: pode ser a que o Gerente acabou de pagar, com o aviso do Mercado Pago ainda a caminho.
const AGORA_DO_ASSINAR = new Date("2026-10-11T12:00:00.000Z");
const HA_3_DIAS = new Date("2026-10-08T12:00:00.000Z");
const umaAnteriorNoMercadoPago = (status: string, updatedAt: Date = HA_3_DIAS) => ({ id: "fake-sub-1", status, updatedAt });
const comAnterior = (status: string, extra: Record<string, unknown> = {}): Record<string, Mock> => ({
  "rest/v1/rpc/get_billing_context": {
    status: 200,
    body: [{ ...trialContext, status, mp_subscription_id: "fake-sub-1", first_charge_at: null, ...extra }],
  },
});
const assinarAgora = (provider: FakePaymentProvider) => createHandler({ provider, now: () => AGORA_DO_ASSINAR })(request());

Deno.test("assinar when blocked cancels the previous subscription that is still authorized at the provider and then creates the new one", async () => {
  const provider = new FakePaymentProvider();
  provider.nextSubscriptionId = "fake-sub-2";
  provider.subscriptions.set("fake-sub-1", umaAnteriorNoMercadoPago("authorized"));
  let anteriorCanceladaAntesDeCriar: boolean | null = null;
  const criar = provider.createSubscription.bind(provider);
  provider.createSubscription = (input) => {
    anteriorCanceladaAntesDeCriar = provider.cancelledSubscriptions.includes("fake-sub-1");
    return criar(input);
  };
  const supabase = setupSupabase(comAnterior("blocked"));
  try {
    const res = await assinarAgora(provider);

    assertEquals(res.status, 200);
    assertEquals(provider.cancelledSubscriptions, ["fake-sub-1"]);
    assertEquals(provider.createdSubscriptions.length, 1);
    assertEquals(supabase.rpcCalls("record_mp_subscription"), [{ p_tenant_id: "tenant-1", p_mp_subscription_id: "fake-sub-2" }]);
    // A antiga vai primeiro: com a nova na frente e o cancelamento falhando, a barbearia teria duas cobrando.
    assertEquals(anteriorCanceladaAntesDeCriar, true);
  } finally {
    supabase.restore();
  }
});

Deno.test("assinar when blocked also cancels the previous subscription while it is paused at the provider", async () => {
  const provider = new FakePaymentProvider();
  provider.subscriptions.set("fake-sub-1", umaAnteriorNoMercadoPago("paused"));
  const supabase = setupSupabase(comAnterior("blocked"));
  try {
    assertEquals((await assinarAgora(provider)).status, 200);
    assertEquals(provider.cancelledSubscriptions, ["fake-sub-1"]);
    assertEquals(provider.createdSubscriptions.length, 1);
  } finally {
    supabase.restore();
  }
});

Deno.test("assinar when blocked does not create another subscription when the previous one could not be cancelled: 502, nothing is recorded and the log names the barbershop", async () => {
  const provider = new FakePaymentProvider();
  provider.failCancelWith = new PaymentProviderError("Mercado Pago respondeu 503: unavailable", 503);
  provider.subscriptions.set("fake-sub-1", umaAnteriorNoMercadoPago("authorized"));
  const supabase = setupSupabase(comAnterior("blocked"));
  const logs = capturarLogs();
  try {
    const res = await assinarAgora(provider);
    const corpo = await res.json();

    assertEquals(res.status, 502);
    assertEquals(corpo.error.includes("assinatura anterior"), true, corpo.error);
    assertEquals(corpo.error.includes("Tente de novo"), true, corpo.error);
    assertEquals(provider.createdSubscriptions.length, 0);
    assertEquals(supabase.rpcCalls("record_mp_subscription").length, 0);
    assertEquals(logs.linhas.some((linha) => linha.includes("tenant-1")), true, logs.linhas.join("\n"));
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

// O pedido pode ter cancelado e a resposta se perdido (timeout): a funcao confere o que a assinatura tem la antes de desistir.
Deno.test("assinar when blocked goes on when the cancellation answer was lost but the provider shows the previous subscription already cancelled", async () => {
  class PerdeARespostaDoCancelamento extends FakePaymentProvider {
    override async cancelSubscription(subscriptionId: string): Promise<void> {
      await super.cancelSubscription(subscriptionId);
      throw new PaymentProviderError("Mercado Pago respondeu 504: gateway timeout", 504);
    }
  }
  const provider = new PerdeARespostaDoCancelamento();
  provider.subscriptions.set("fake-sub-1", umaAnteriorNoMercadoPago("authorized"));
  const supabase = setupSupabase(comAnterior("blocked"));
  const logs = capturarLogs();
  try {
    const res = await assinarAgora(provider);

    assertEquals(res.status, 200);
    assertEquals(provider.createdSubscriptions.length, 1);
    assertEquals(supabase.rpcCalls("record_mp_subscription").length, 1);
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

// A assinatura que o Gerente acabou de pagar tambem esta "authorized" e a barbearia segue bloqueada ate o aviso do Mercado Pago
// chegar: cancelar essa, num segundo clique em "Pagar", jogaria fora o pagamento feito. Ela e protegida pela hora da ultima
// alteracao no Mercado Pago; o Gerente espera e tenta de novo (a antiga de um estorno nao mudou ha dias, e passa).
Deno.test("assinar when blocked leaves alone a previous subscription that changed less than an hour ago: it may be the one just paid", async () => {
  for (const [minutos, status] of [[10, 409], [59, 409], [61, 200]] as const) {
    const provider = new FakePaymentProvider();
    provider.subscriptions.set(
      "fake-sub-1",
      umaAnteriorNoMercadoPago("authorized", new Date(AGORA_DO_ASSINAR.getTime() - minutos * 60 * 1000)),
    );
    const supabase = setupSupabase(comAnterior("blocked"));
    try {
      const res = await assinarAgora(provider);
      const corpo = await res.json();

      assertEquals(res.status, status, `${minutos} minutos`);
      if (status === 409) {
        assertEquals(corpo.error.includes("alterada há pouco"), true, corpo.error);
        assertEquals(provider.cancelledSubscriptions.length, 0);
        assertEquals(provider.createdSubscriptions.length, 0);
        assertEquals(supabase.rpcCalls("record_mp_subscription").length, 0);
      } else {
        assertEquals(provider.cancelledSubscriptions, ["fake-sub-1"]);
      }
    } finally {
      supabase.restore();
    }
  }
});

// Cancelada que ja assinou de novo (a nova esta autorizada, com a cobranca no fim do periodo pago) e em teste com o cartao
// autorizado: a assinatura viva e a que vale, e trocar de assinatura nao e o que o Gerente quer.
Deno.test("assinar refuses to replace a live subscription when the barbershop is canceled (it already subscribed again) or in trial with the card authorized", async () => {
  for (const [status, trecho] of [["canceled", "já foi autorizada"], ["trialing", "assinatura anterior ativa"]] as const) {
    const provider = new FakePaymentProvider();
    provider.subscriptions.set("fake-sub-1", umaAnteriorNoMercadoPago("authorized"));
    const supabase = setupSupabase(comAnterior(status));
    try {
      const res = await assinarAgora(provider);
      const corpo = await res.json();

      assertEquals(res.status, 409, status);
      assertEquals(corpo.error.includes(trecho), true, corpo.error);
      assertEquals(provider.cancelledSubscriptions.length, 0);
      assertEquals(provider.createdSubscriptions.length, 0);
      assertEquals(supabase.rpcCalls("record_mp_subscription").length, 0);
    } finally {
      supabase.restore();
    }
  }
});

Deno.test("assinar does not cancel anything when the previous subscription is already cancelled, pending or gone at the provider", async () => {
  for (const previous of [umaAnteriorNoMercadoPago("cancelled"), umaAnteriorNoMercadoPago("pending"), undefined]) {
    const provider = new FakePaymentProvider();
    if (previous) provider.subscriptions.set("fake-sub-1", previous);
    const supabase = setupSupabase(comAnterior("blocked"));
    try {
      assertEquals((await assinarAgora(provider)).status, 200);
      assertEquals(provider.cancelledSubscriptions.length, 0);
      assertEquals(provider.createdSubscriptions.length, 1);
    } finally {
      supabase.restore();
    }
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

// ---------------------------------------------------------------------------
// Spec 052, ticket 10: subir de plano com diferenca proporcional. A acao "cotar_troca_de_plano" mostra
// ao Gerente a diferenca e o valor mensal novo antes de confirmar; "trocar_plano" cobra a diferenca no
// cartao digitado nos campos seguros e so com o pagamento aprovado troca o plano (o limite de
// profissionais sobe na hora) e o valor da assinatura para a proxima cobranca. Em teste a troca e livre.
// ---------------------------------------------------------------------------

const PLANO_TESOURA_ID = "b3fa7384-d113-4a1b-a5ed-1efeb7e51c11";
const PLANO_MAQUINA_ID = "b3fa7384-d113-4a1b-a5ed-1efeb7e51c22";
const PLANO_BANCADA_ID = "b3fa7384-d113-4a1b-a5ed-1efeb7e51c33";
// Dia 10 de um periodo pago de 30 dias (1/10 a 31/10): faltam 20 dias, e a diferenca Tesoura -> Maquina
// (R$ 30,00) proporcional a 20/30 e R$ 20,00.
const AGORA = new Date("2026-10-11T12:00:00.000Z");
const contextoDaTroca = {
  status: "active",
  mp_subscription_id: "mp-sub-1",
  current_plan_id: PLANO_TESOURA_ID,
  current_plan_price: "59.90",
  target_plan_id: PLANO_MAQUINA_ID,
  target_plan_name: "Máquina",
  target_plan_price: "89.90",
  target_max_professionals: 5,
  current_period_start: "2026-10-01T12:00:00+00:00",
  current_period_end: "2026-10-31T12:00:00+00:00",
  active_professionals: 1,
  failed_upgrade_attempts: 0,
  scheduled_plan_id: null,
};

const supabaseDaTroca = (overrides: Record<string, Mock> = {}) =>
  setupSupabase({
    "rest/v1/rpc/get_billing_context": { status: 200, body: [ativa] },
    "rest/v1/rpc/get_plan_change_context": { status: 200, body: [contextoDaTroca] },
    "rest/v1/rpc/apply_plan_change": { status: 200, body: "changed" },
    "rest/v1/rpc/apply_subscription_payment": { status: 200, body: "recorded" },
    "rest/v1/rpc/schedule_plan_downgrade": { status: 200, body: "scheduled" },
    "rest/v1/rpc/cancel_plan_downgrade": { status: 200, body: "canceled" },
    ...overrides,
  });
const comContexto = (contexto: Record<string, unknown>): Record<string, Mock> => ({
  "rest/v1/rpc/get_plan_change_context": { status: 200, body: [{ ...contextoDaTroca, ...contexto }] },
});
const handlerDaTroca = (provider: FakePaymentProvider) => createHandler({ provider, now: () => AGORA });
const cotar = (extra: Record<string, unknown> = {}) => request({ action: "cotar_troca_de_plano", planId: PLANO_MAQUINA_ID, ...extra });
const trocarPlano = (extra: Record<string, unknown> = {}) =>
  request({ action: "trocar_plano", planId: PLANO_MAQUINA_ID, cardToken: TOKEN_DO_CARTAO, expectedAmount: 20, ...extra });

const capturarLogs = () => {
  const linhas: string[] = [];
  const originais = { log: console.log, info: console.info, error: console.error, warn: console.warn };
  console.log = console.info = console.error = console.warn = (...args: unknown[]) => linhas.push(args.map(String).join(" "));
  return { linhas, restaurar: () => Object.assign(console, originais) };
};

const nadaFoiCobradoNemTrocado = (provider: FakePaymentProvider, supabase: ReturnType<typeof setupSupabase>) => {
  assertEquals(provider.charges.length, 0);
  assertEquals(provider.changedAmounts.length, 0);
  assertEquals(supabase.rpcCalls("apply_plan_change").length, 0);
};

// --- cotar_troca_de_plano ----------------------------------------------------------------------------------------

Deno.test("cotar_troca_de_plano: mostra a diferenca proporcional aos dias que faltam e o valor mensal novo, sem cobrar nem trocar nada", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca();
  try {
    const res = await handlerDaTroca(provider)(cotar());

    assertEquals(res.status, 200);
    assertEquals(await res.json(), {
      mode: "charge",
      difference: 20,
      newMonthlyAmount: 89.9,
      remainingDays: 20,
      periodDays: 30,
      planName: "Máquina",
    });
    assertEquals(supabase.rpcCalls("get_plan_change_context"), [{ p_tenant_id: "tenant-1", p_plan_id: PLANO_MAQUINA_ID }]);
    nadaFoiCobradoNemTrocado(provider, supabase);
  } finally {
    supabase.restore();
  }
});

Deno.test("cotar_troca_de_plano: no primeiro dia do periodo a diferenca e inteira e no ultimo e de um dia", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca();
  try {
    const primeiroDia = await createHandler({ provider, now: () => new Date("2026-10-01T12:00:01.000Z") })(cotar());
    const ultimoDia = await createHandler({ provider, now: () => new Date("2026-10-31T11:00:00.000Z") })(cotar());

    assertEquals((await primeiroDia.json()).difference, 30);
    assertEquals((await ultimoDia.json()).difference, 1);
  } finally {
    supabase.restore();
  }
});

Deno.test("cotar_troca_de_plano: em teste a troca e livre, sem cobranca", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca({
    "rest/v1/rpc/get_billing_context": { status: 200, body: [{ ...ativa, status: "trialing" }] },
    ...comContexto({ status: "trialing", current_period_start: null, current_period_end: null, mp_subscription_id: null }),
  });
  try {
    const res = await handlerDaTroca(provider)(cotar());

    assertEquals(res.status, 200);
    assertEquals(await res.json(), {
      mode: "free",
      difference: 0,
      newMonthlyAmount: 89.9,
      remainingDays: null,
      periodDays: null,
      planName: "Máquina",
    });
  } finally {
    supabase.restore();
  }
});

Deno.test("cotar_troca_de_plano: diferenca abaixo do minimo aceito pelo Mercado Pago: a troca sai sem cobranca", async () => {
  const provider = new FakePaymentProvider();
  // Periodo de 31 dias e meia hora para acabar: 30,00 x 1/31 = R$ 0,97.
  const supabase = supabaseDaTroca(comContexto({
    current_period_start: "2026-09-10T12:30:00+00:00",
    current_period_end: "2026-10-11T12:30:00+00:00",
  }));
  try {
    const res = await handlerDaTroca(provider)(cotar());

    assertEquals(res.status, 200);
    const corpo = await res.json();
    assertEquals(corpo.mode, "no_charge");
    assertEquals(corpo.difference, 0);
    assertEquals(corpo.newMonthlyAmount, 89.9);
  } finally {
    supabase.restore();
  }
});

for (const status of ["past_due", "blocked", "canceled", "courtesy"]) {
  Deno.test(`cotar_troca_de_plano: assinatura ${status} responde 409`, async () => {
    const provider = new FakePaymentProvider();
    const supabase = supabaseDaTroca(comContexto({ status }));
    try {
      const res = await handlerDaTroca(provider)(cotar());

      assertEquals(res.status, 409);
      assertEquals(typeof (await res.json()).error, "string");
    } finally {
      supabase.restore();
    }
  });
}

Deno.test("cotar_troca_de_plano: o plano em que a barbearia ja esta e um plano que nao cabe (em teste) sao recusados", async () => {
  const provider = new FakePaymentProvider();
  const casos: Array<[string, Record<string, unknown>]> = [
    ["o mesmo plano", { target_plan_id: PLANO_TESOURA_ID }],
    ["um plano que nao comporta os profissionais ativos", { status: "trialing", target_plan_price: "59.90", target_max_professionals: 1, active_professionals: 3 }],
  ];
  for (const [nome, contexto] of casos) {
    const supabase = supabaseDaTroca(comContexto(contexto));
    try {
      const res = await handlerDaTroca(provider)(cotar());

      assertEquals(res.status, 409, nome);
    } finally {
      supabase.restore();
    }
  }
});

Deno.test("cotar_troca_de_plano: assinatura ativa sem periodo pago nao tem como calcular a diferenca (500)", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca(comContexto({ current_period_start: null, current_period_end: null }));
  try {
    const res = await handlerDaTroca(provider)(cotar());

    assertEquals(res.status, 500);
  } finally {
    supabase.restore();
  }
});

for (const planId of [undefined, "", "maquina", 42, "b3fa7384-d113-4a1b-a5ed-1efeb7e51c2", "../../plans"]) {
  Deno.test(`cotar_troca_de_plano e trocar_plano: plano invalido (${JSON.stringify(planId)}) responde 400 sem ler nada`, async () => {
    const provider = new FakePaymentProvider();
    const supabase = supabaseDaTroca();
    try {
      const cotacao = await handlerDaTroca(provider)(cotar({ planId }));
      const troca = await handlerDaTroca(provider)(trocarPlano({ planId }));

      assertEquals(cotacao.status, 400);
      assertEquals(troca.status, 400);
      assertEquals(supabase.rpcCalls("get_plan_change_context").length, 0);
      nadaFoiCobradoNemTrocado(provider, supabase);
    } finally {
      supabase.restore();
    }
  });
}

Deno.test("cotar_troca_de_plano e trocar_plano: plano que nao existe responde 404", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca({ "rest/v1/rpc/get_plan_change_context": { status: 200, body: [] } });
  try {
    assertEquals((await handlerDaTroca(provider)(cotar())).status, 404);
    assertEquals((await handlerDaTroca(provider)(trocarPlano())).status, 404);
    nadaFoiCobradoNemTrocado(provider, supabase);
  } finally {
    supabase.restore();
  }
});

Deno.test("cotar_troca_de_plano e trocar_plano: so o Gerente do tenant (Barbeiro, Gerente sem tenant e inativo recebem 403)", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca({ "rest/v1/rpc/get_billing_context": { status: 200, body: [] } });
  try {
    assertEquals((await handlerDaTroca(provider)(cotar())).status, 403);
    assertEquals((await handlerDaTroca(provider)(trocarPlano())).status, 403);
    assertEquals(supabase.rpcCalls("get_plan_change_context").length, 0);
    nadaFoiCobradoNemTrocado(provider, supabase);
  } finally {
    supabase.restore();
  }
});

Deno.test("cotar_troca_de_plano e trocar_plano: sem login respondem 401", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca();
  try {
    assertEquals((await handlerDaTroca(provider)(request({ action: "cotar_troca_de_plano", planId: PLANO_MAQUINA_ID }, {}))).status, 401);
    assertEquals((await handlerDaTroca(provider)(request({ action: "trocar_plano", planId: PLANO_MAQUINA_ID }, {}))).status, 401);
    nadaFoiCobradoNemTrocado(provider, supabase);
  } finally {
    supabase.restore();
  }
});

Deno.test("cotar_troca_de_plano: falha ao ler o contexto da troca responde 500", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca({ "rest/v1/rpc/get_plan_change_context": { status: 500, body: { message: "boom" } } });
  const logs = capturarLogs();
  try {
    assertEquals((await handlerDaTroca(provider)(cotar())).status, 500);
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

// --- trocar_plano: assinatura ativa, com cobranca da diferenca -------------------------------------------------------------

Deno.test("trocar_plano: cobra a diferenca proporcional no cartao do token e, aprovada, troca o plano, grava a cobranca e muda o valor da assinatura", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca();
  try {
    const res = await handlerDaTroca(provider)(trocarPlano());

    assertEquals(res.status, 200);
    assertEquals(await res.json(), {
      changed: true,
      planId: PLANO_MAQUINA_ID,
      planName: "Máquina",
      charged: 20,
      newMonthlyAmount: 89.9,
      nextChargeUpdated: true,
    });
    assertEquals(provider.charges, [{
      amount: 20,
      cardToken: TOKEN_DO_CARTAO,
      payerEmail: "gerente@barbearia.test",
      description: "Navalhado - subida para o plano Máquina",
      externalReference: "tenant-1",
      idempotencyKey: `upgrade:tenant-1:${PLANO_MAQUINA_ID}:2026-10-31T12:00:00.000Z:0`,
      kind: "upgrade",
      planId: PLANO_MAQUINA_ID,
    }]);
    assertEquals(supabase.rpcCalls("apply_plan_change"), [{
      p_tenant_id: "tenant-1",
      p_plan_id: PLANO_MAQUINA_ID,
      p_mp_payment_id: "fake-pay-1",
      p_amount: 20,
      p_charged_at: "2026-10-11T12:00:02.000Z",
      p_card_brand: "visa",
      p_card_last4: "5682",
    }]);
    // O valor novo vale na proxima cobranca: o preco cheio do plano novo.
    assertEquals(provider.changedAmounts, [{ subscriptionId: "mp-sub-1", amount: 89.9 }]);
    // A troca de plano nao troca o cartao da assinatura.
    assertEquals(provider.changedCards.length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("trocar_plano: o final do cartao que o navegador manda so vale se o provedor nao devolveu o dele", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca();
  try {
    await handlerDaTroca(provider)(trocarPlano({ cardLast4: "9999" }));
    provider.nextCharge = { cardLast4: undefined };
    await handlerDaTroca(provider)(trocarPlano({ cardLast4: "1234" }));
    await handlerDaTroca(provider)(trocarPlano({ cardLast4: "12; drop table x" }));

    const gravados = supabase.rpcCalls("apply_plan_change") as Array<{ p_card_last4: string | null }>;
    assertEquals(gravados.map((chamada) => chamada.p_card_last4), ["5682", "1234", null]);
  } finally {
    supabase.restore();
  }
});

// A chave e da TENTATIVA, nao do cartao. O token do cartao e de uso unico: depois de um timeout em que o Mercado Pago
// ja aprovou, o Gerente digita de novo, o SDK gera outro token e, se a chave levasse o token, mudaria e cobraria a
// diferenca outra vez. Sem tentativa gravada entre os dois pedidos, a chave se repete (o Mercado Pago devolve o
// pagamento que ja fez); uma tentativa recusada ou em analise vai para o historico e muda a chave do pedido seguinte.
Deno.test("trocar_plano: um reenvio sem tentativa gravada no meio repete a chave, mesmo com outro cartao", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca();
  try {
    await handlerDaTroca(provider)(trocarPlano());
    await handlerDaTroca(provider)(trocarPlano({ cardToken: "0f9e8d7c6b5a49382716f5e4d3c2b1a0" }));

    const chaves = provider.charges.map((cobranca) => cobranca.idempotencyKey);
    assertEquals(chaves.length, 2);
    assertEquals(chaves[0], chaves[1]);
    assertEquals(chaves[0].includes(TOKEN_DO_CARTAO), false);
  } finally {
    supabase.restore();
  }
});

Deno.test("trocar_plano: depois de uma tentativa recusada gravada no historico a chave muda, e uma nova tentativa cobra", async () => {
  const provider = new FakePaymentProvider();
  for (const tentativasGravadas of [0, 1, 2]) {
    const supabase = supabaseDaTroca(comContexto({ failed_upgrade_attempts: tentativasGravadas }));
    try {
      await handlerDaTroca(provider)(trocarPlano());
    } finally {
      supabase.restore();
    }
  }

  assertEquals(provider.charges.map((cobranca) => cobranca.idempotencyKey), [
    `upgrade:tenant-1:${PLANO_MAQUINA_ID}:2026-10-31T12:00:00.000Z:0`,
    `upgrade:tenant-1:${PLANO_MAQUINA_ID}:2026-10-31T12:00:00.000Z:1`,
    `upgrade:tenant-1:${PLANO_MAQUINA_ID}:2026-10-31T12:00:00.000Z:2`,
  ]);
});

Deno.test("trocar_plano: a chave muda com o plano de destino e com o periodo pago (depois da renovacao e outra cobranca)", async () => {
  const provider = new FakePaymentProvider();
  const OUTRO_PLANO = "b3fa7384-d113-4a1b-a5ed-1efeb7e51c33";
  const cenarios: Array<[Record<string, unknown>, string]> = [
    [{}, PLANO_MAQUINA_ID],
    [{}, OUTRO_PLANO],
    [{ current_period_end: "2026-11-30T12:00:00+00:00" }, PLANO_MAQUINA_ID],
  ];
  for (const [contexto, planId] of cenarios) {
    const supabase = supabaseDaTroca(comContexto(contexto));
    try {
      // Periodo de 60 dias, faltando 50: 30,00 x 50/60 = R$ 25,00. O valor confirmado acompanha a cotacao.
      const valor = contexto.current_period_end ? 25 : 20;
      await handlerDaTroca(provider)(trocarPlano({ planId, expectedAmount: valor }));
    } finally {
      supabase.restore();
    }
  }

  const chaves = provider.charges.map((cobranca) => cobranca.idempotencyKey);
  assertEquals(new Set(chaves).size, 3, chaves.join("\n"));
  assertEquals(chaves[1].includes(OUTRO_PLANO), true);
  assertEquals(chaves[2].includes("2026-11-30T12:00:00.000Z"), true);
});

Deno.test("trocar_plano: cartao recusado: 402 com o motivo, o plano continua o mesmo e a tentativa vai para o historico", async () => {
  const provider = new FakePaymentProvider();
  provider.nextCharge = { status: "rejected", statusDetail: "cc_rejected_insufficient_amount", approvedAt: undefined };
  const supabase = supabaseDaTroca();
  try {
    const res = await handlerDaTroca(provider)(trocarPlano());
    const corpo = await res.json();

    assertEquals(res.status, 402);
    assertEquals(corpo.error.includes("saldo"), true, corpo.error);
    assertEquals(corpo.error.includes("continua o mesmo"), true, corpo.error);
    assertEquals(supabase.rpcCalls("apply_plan_change").length, 0);
    assertEquals(provider.changedAmounts.length, 0);
    assertEquals(supabase.rpcCalls("apply_subscription_payment"), [{
      p_tenant_id: "tenant-1",
      p_mp_payment_id: "fake-pay-1",
      p_mp_subscription_id: null,
      p_status: "rejected",
      p_amount: 20,
      p_charged_at: "2026-10-11T12:00:01.000Z",
      p_kind: "upgrade",
      p_card_brand: "visa",
      p_card_last4: "5682",
    }]);
  } finally {
    supabase.restore();
  }
});

for (const [statusDetail, trecho] of [
  ["cc_rejected_bad_filled_security_code", "código de segurança"],
  ["cc_rejected_bad_filled_date", "validade"],
  ["cc_rejected_call_for_authorize", "autorizar"],
  ["cc_rejected_other_reason", "recusado"],
  [undefined, "recusado"],
] as const) {
  Deno.test(`trocar_plano: cartao recusado (${statusDetail ?? "sem motivo"}) explica o motivo em linguagem de gente`, async () => {
    const provider = new FakePaymentProvider();
    provider.nextCharge = { status: "rejected", statusDetail, approvedAt: undefined };
    const supabase = supabaseDaTroca();
    try {
      const res = await handlerDaTroca(provider)(trocarPlano());
      const corpo = await res.json();

      assertEquals(res.status, 402);
      assertEquals(corpo.error.includes(trecho), true, corpo.error);
    } finally {
      supabase.restore();
    }
  });
}

Deno.test("trocar_plano: a recusa responde mesmo que o historico nao grave a tentativa", async () => {
  const provider = new FakePaymentProvider();
  provider.nextCharge = { status: "rejected", approvedAt: undefined };
  const supabase = supabaseDaTroca({ "rest/v1/rpc/apply_subscription_payment": { status: 500, body: { message: "boom" } } });
  const logs = capturarLogs();
  try {
    const res = await handlerDaTroca(provider)(trocarPlano());

    assertEquals(res.status, 402);
    assertEquals(supabase.rpcCalls("apply_plan_change").length, 0);
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

Deno.test("trocar_plano: pagamento em analise no Mercado Pago nao troca o plano e avisa", async () => {
  const provider = new FakePaymentProvider();
  provider.nextCharge = { status: "in_process", statusDetail: "pending_contingency", approvedAt: undefined };
  const supabase = supabaseDaTroca();
  try {
    const res = await handlerDaTroca(provider)(trocarPlano());
    const corpo = await res.json();

    assertEquals(res.status, 402);
    assertEquals(corpo.error.includes("analisando"), true, corpo.error);
    assertEquals(supabase.rpcCalls("apply_plan_change").length, 0);
    assertEquals(provider.changedAmounts.length, 0);
    assertEquals((supabase.rpcCalls("apply_subscription_payment")[0] as { p_status: string }).p_status, "in_process");
  } finally {
    supabase.restore();
  }
});

// So 400 e 422 dizem que o token do cartao foi recusado. O resto (credencial, limite, queda, sem rede) nao e culpa
// do cartao: o Gerente recebe um texto neutro, e so o log guarda o status.
for (const status of [400, 422]) {
  Deno.test(`trocar_plano: o Mercado Pago nao aceita o cartao (${status}): 422, nada muda, sem o token`, async () => {
    const provider = new FakePaymentProvider();
    provider.failWith = new PaymentProviderError(`Mercado Pago respondeu ${status}: Invalid token`, status);
    const supabase = supabaseDaTroca();
    try {
      const res = await handlerDaTroca(provider)(trocarPlano());
      const corpo = await res.json();

      assertEquals(res.status, 422);
      assertEquals(corpo.error, "O Mercado Pago não aceitou o cartão. Confira os dados ou use outro cartão.");
      assertEquals(JSON.stringify(corpo).includes(TOKEN_DO_CARTAO), false);
      assertEquals(supabase.rpcCalls("apply_plan_change").length, 0);
    } finally {
      supabase.restore();
    }
  });
}

for (const status of [401, 403, 404, 429, 503, undefined]) {
  Deno.test(`trocar_plano: falha do provedor que nao e do cartao (${status ?? "sem resposta"}): 502 neutro, nada muda, o motivo so no log`, async () => {
    const provider = new FakePaymentProvider();
    provider.failWith = new PaymentProviderError(`Mercado Pago respondeu ${status}: falha com ${TOKEN_DO_CARTAO}`, status);
    const supabase = supabaseDaTroca();
    const logs = capturarLogs();
    try {
      const res = await handlerDaTroca(provider)(trocarPlano());
      const corpo = await res.json();

      assertEquals(res.status, 502);
      assertEquals(corpo.error, "Não foi possível cobrar agora. Tente de novo em instantes.");
      assertEquals(supabase.rpcCalls("apply_plan_change").length, 0);
      assertEquals(logs.linhas.some((linha) => linha.includes(String(status ?? "sem resposta"))), true, logs.linhas.join("\n"));
      assertEquals(logs.linhas.some((linha) => linha.includes(TOKEN_DO_CARTAO)), false, logs.linhas.join("\n"));
    } finally {
      logs.restaurar();
      supabase.restore();
    }
  });
}

for (const cardToken of [undefined, "", "curto", "com espaço no meio 1234567890", "x".repeat(65), 1234567890123456, "../../users/me"]) {
  Deno.test(`trocar_plano: token invalido (${JSON.stringify(cardToken)}) responde 400 sem cobrar`, async () => {
    const provider = new FakePaymentProvider();
    const supabase = supabaseDaTroca();
    try {
      const res = await handlerDaTroca(provider)(trocarPlano({ cardToken }));

      assertEquals(res.status, 400);
      nadaFoiCobradoNemTrocado(provider, supabase);
    } finally {
      supabase.restore();
    }
  });
}

// O valor que o Gerente confirmou na tela e o que sera cobrado: se a diferenca mudou (virou o dia, o periodo
// foi renovado), a funcao recusa em vez de cobrar um valor que ele nao viu.
Deno.test("trocar_plano: o valor confirmado na tela tem de ser o que sera cobrado", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca();
  try {
    const mudou = await handlerDaTroca(provider)(trocarPlano({ expectedAmount: 21 }));
    const naoMandou = await handlerDaTroca(provider)(trocarPlano({ expectedAmount: undefined }));
    const textoNoLugar = await handlerDaTroca(provider)(trocarPlano({ expectedAmount: "20" }));

    assertEquals(mudou.status, 409);
    assertEquals(naoMandou.status, 400);
    assertEquals(textoNoLugar.status, 400);
    nadaFoiCobradoNemTrocado(provider, supabase);
  } finally {
    supabase.restore();
  }
});

Deno.test("trocar_plano: centavos de diferenca de ponto flutuante no valor confirmado nao bloqueiam a troca", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca(comContexto({ current_period_end: "2026-10-22T12:00:00+00:00" }));
  try {
    // Periodo de 21 dias, faltam 11: 30,00 x 11/21 = 15,714... = R$ 15,71.
    const res = await handlerDaTroca(provider)(trocarPlano({ expectedAmount: 15.71 }));

    assertEquals(res.status, 200);
    assertEquals(provider.charges[0].amount, 15.71);
  } finally {
    supabase.restore();
  }
});

Deno.test("trocar_plano: se o banco nao consegue trocar o plano depois da cobranca aprovada, avisa que a cobranca foi feita e nao mexe no valor da assinatura", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca({ "rest/v1/rpc/apply_plan_change": { status: 500, body: { message: "boom", code: "XX000" } } });
  const logs = capturarLogs();
  try {
    const res = await handlerDaTroca(provider)(trocarPlano());
    const corpo = await res.json();

    assertEquals(res.status, 500);
    assertEquals(corpo.error.includes("Cobramos a diferença"), true, corpo.error);
    assertEquals(provider.changedAmounts.length, 0);
    // O log diz qual pagamento ficou sem troca, para o suporte regularizar; nunca o token.
    assertEquals(logs.linhas.some((linha) => linha.includes("fake-pay-1")), true, logs.linhas.join("\n"));
    assertEquals(logs.linhas.some((linha) => linha.includes(TOKEN_DO_CARTAO)), false, logs.linhas.join("\n"));
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

// "duplicate": o banco ja aplicou o plano com ESTE pagamento (a resposta de um pedido anterior se perdeu e o webhook foi na
// frente, ou um reenvio). Se o plano da barbearia e o de destino, a troca ja vale e a resposta e de sucesso. Se nao e, o Mercado
// Pago devolveu um pagamento antigo (a chave de idempotencia se repetiu, por exemplo com o plano revertido no mesmo periodo):
// nada foi cobrado agora e o plano nao trocou, entao a funcao nao pode dizer que trocou nem mudar o valor da assinatura.
const planoJaEhODeDestino = (): Mock => {
  let leituras = 0;
  return () => ({
    status: 200,
    body: [leituras++ === 0 ? contextoDaTroca : { ...contextoDaTroca, current_plan_id: PLANO_MAQUINA_ID }],
  });
};

Deno.test("trocar_plano: com 'duplicate' e o plano ja e o de destino (o webhook foi na frente), responde que trocou e confere o valor da assinatura", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca({
    "rest/v1/rpc/get_plan_change_context": planoJaEhODeDestino(),
    "rest/v1/rpc/apply_plan_change": { status: 200, body: "duplicate" },
  });
  try {
    const res = await handlerDaTroca(provider)(trocarPlano());
    const corpo = await res.json();

    assertEquals(res.status, 200);
    assertEquals(corpo.changed, true);
    assertEquals(corpo.charged, 20);
    assertEquals(provider.changedAmounts, [{ subscriptionId: "mp-sub-1", amount: 89.9 }]);
    // A segunda leitura e a que confere o plano depois do "duplicate".
    assertEquals(supabase.rpcCalls("get_plan_change_context"), [
      { p_tenant_id: "tenant-1", p_plan_id: PLANO_MAQUINA_ID },
      { p_tenant_id: "tenant-1", p_plan_id: PLANO_MAQUINA_ID },
    ]);
  } finally {
    supabase.restore();
  }
});

Deno.test("trocar_plano: com 'duplicate' e o plano que NAO e o de destino (o Mercado Pago devolveu um pagamento ja usado), responde 409, nao muda o valor da assinatura e loga", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca({ "rest/v1/rpc/apply_plan_change": { status: 200, body: "duplicate" } });
  const logs = capturarLogs();
  try {
    const res = await handlerDaTroca(provider)(trocarPlano());
    const corpo = await res.json();

    assertEquals(res.status, 409);
    assertEquals(corpo.changed, undefined);
    assertEquals(corpo.error.includes("já tinha sido usado"), true, corpo.error);
    assertEquals(corpo.error.includes("nada foi cobrado agora"), true, corpo.error);
    assertEquals(corpo.error.includes("continua o mesmo"), true, corpo.error);
    assertEquals(supabase.rpcCalls("apply_plan_change").length, 1);
    // O valor da assinatura no Mercado Pago nao e o do plano de destino enquanto o plano nao trocou.
    assertEquals(provider.changedAmounts.length, 0);
    assertEquals(provider.changedCards.length, 0);
    // O log diz qual pagamento foi devolvido e de qual barbearia, para o suporte conferir; nunca o token.
    assertEquals(logs.linhas.some((linha) => linha.includes("fake-pay-1") && linha.includes("tenant-1")), true, logs.linhas.join("\n"));
    assertEquals(logs.linhas.some((linha) => linha.includes(TOKEN_DO_CARTAO)), false, logs.linhas.join("\n"));
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

Deno.test("trocar_plano: com 'duplicate' e a leitura do plano falhando, nao diz que trocou nem mexe no valor da assinatura", async () => {
  const provider = new FakePaymentProvider();
  let leituras = 0;
  const supabase = supabaseDaTroca({
    // A primeira leitura e a do inicio do pedido; a segunda, que confere o plano depois do "duplicate", falha.
    "rest/v1/rpc/get_plan_change_context": () =>
      leituras++ === 0 ? { status: 200, body: [contextoDaTroca] } : { status: 500, body: { code: "XX000", message: "falha" } },
    "rest/v1/rpc/apply_plan_change": { status: 200, body: "duplicate" },
  });
  const logs = capturarLogs();
  try {
    const res = await handlerDaTroca(provider)(trocarPlano());
    const corpo = await res.json();

    assertEquals(res.status, 500);
    assertEquals(corpo.changed, undefined);
    assertEquals(corpo.error.includes("Não foi possível conferir a troca de plano"), true, corpo.error);
    assertEquals(provider.changedAmounts.length, 0);
    assertEquals(logs.linhas.some((linha) => linha.includes("fake-pay-1") && linha.includes("tenant-1")), true, logs.linhas.join("\n"));
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

Deno.test("trocar_plano: com 'changed' (o caso normal) nao le o contexto da troca de novo", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca();
  try {
    const res = await handlerDaTroca(provider)(trocarPlano());

    assertEquals(res.status, 200);
    assertEquals(supabase.rpcCalls("get_plan_change_context").length, 1);
  } finally {
    supabase.restore();
  }
});

Deno.test("trocar_plano: se o Mercado Pago nao aceita o valor novo da assinatura, o plano ja trocou: responde que deu certo e registra o problema", async () => {
  const provider = new FakePaymentProvider();
  provider.failAmountChangeWith = new PaymentProviderError("Mercado Pago respondeu 429: local_rate_limited", 429);
  const supabase = supabaseDaTroca();
  const logs = capturarLogs();
  try {
    const res = await handlerDaTroca(provider)(trocarPlano());
    const corpo = await res.json();

    assertEquals(res.status, 200);
    assertEquals(corpo.changed, true);
    assertEquals(corpo.nextChargeUpdated, false);
    assertEquals(supabase.rpcCalls("apply_plan_change").length, 1);
    assertEquals(logs.linhas.some((linha) => linha.includes("valor da assinatura") && linha.includes("tenant-1")), true, logs.linhas.join("\n"));
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

// --- trocar_plano: sem cobranca --------------------------------------------------------------------------------------------

Deno.test("trocar_plano em teste: a troca e livre, sem cobranca, e muda o valor da assinatura no Mercado Pago se ela ja existe", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca({
    "rest/v1/rpc/get_billing_context": { status: 200, body: [{ ...ativa, status: "trialing" }] },
    ...comContexto({ status: "trialing", current_period_start: null, current_period_end: null }),
  });
  try {
    const res = await handlerDaTroca(provider)(request({ action: "trocar_plano", planId: PLANO_MAQUINA_ID }));

    assertEquals(res.status, 200);
    assertEquals(await res.json(), {
      changed: true,
      planId: PLANO_MAQUINA_ID,
      planName: "Máquina",
      charged: 0,
      newMonthlyAmount: 89.9,
      nextChargeUpdated: true,
    });
    assertEquals(provider.charges.length, 0);
    assertEquals(supabase.rpcCalls("apply_plan_change"), [{
      p_tenant_id: "tenant-1",
      p_plan_id: PLANO_MAQUINA_ID,
      p_mp_payment_id: null,
      p_amount: null,
      p_charged_at: null,
      p_card_brand: null,
      p_card_last4: null,
    }]);
    assertEquals(provider.changedAmounts, [{ subscriptionId: "mp-sub-1", amount: 89.9 }]);
  } finally {
    supabase.restore();
  }
});

Deno.test("trocar_plano em teste sem assinatura no Mercado Pago: so troca o plano, sem falar com o provedor", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca({
    "rest/v1/rpc/get_billing_context": { status: 200, body: [{ ...ativa, status: "trialing", mp_subscription_id: null }] },
    ...comContexto({ status: "trialing", mp_subscription_id: null, current_period_start: null, current_period_end: null }),
  });
  try {
    const res = await handlerDaTroca(provider)(request({ action: "trocar_plano", planId: PLANO_MAQUINA_ID }));

    assertEquals(res.status, 200);
    assertEquals((await res.json()).nextChargeUpdated, true);
    assertEquals(supabase.rpcCalls("apply_plan_change").length, 1);
    assertEquals(provider.changedAmounts.length, 0);
    assertEquals(provider.charges.length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("trocar_plano em teste: nao exige cartao nem valor confirmado, e ignora o que vier", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca(comContexto({ status: "trialing", current_period_start: null, current_period_end: null }));
  try {
    const res = await handlerDaTroca(provider)(trocarPlano({ cardToken: undefined, expectedAmount: 999 }));

    assertEquals(res.status, 200);
    assertEquals(provider.charges.length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("trocar_plano com diferenca abaixo do minimo do Mercado Pago: troca o plano sem cobranca avulsa", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca(comContexto({
    current_period_start: "2026-09-10T12:30:00+00:00",
    current_period_end: "2026-10-11T12:30:00+00:00",
  }));
  try {
    const res = await handlerDaTroca(provider)(trocarPlano({ expectedAmount: 0 }));

    assertEquals(res.status, 200);
    assertEquals((await res.json()).charged, 0);
    assertEquals(provider.charges.length, 0);
    assertEquals((supabase.rpcCalls("apply_plan_change")[0] as { p_mp_payment_id: string | null }).p_mp_payment_id, null);
    assertEquals(provider.changedAmounts, [{ subscriptionId: "mp-sub-1", amount: 89.9 }]);
  } finally {
    supabase.restore();
  }
});

for (const status of ["past_due", "blocked", "canceled", "courtesy"]) {
  Deno.test(`trocar_plano: assinatura ${status} nao troca de plano (409) e nada e cobrado`, async () => {
    const provider = new FakePaymentProvider();
    const supabase = supabaseDaTroca(comContexto({ status }));
    try {
      const res = await handlerDaTroca(provider)(trocarPlano());

      assertEquals(res.status, 409);
      nadaFoiCobradoNemTrocado(provider, supabase);
    } finally {
      supabase.restore();
    }
  });
}

Deno.test("trocar_plano: o plano em que a barbearia ja esta e um plano que nao cabe (em teste) nao sao cobrados", async () => {
  const provider = new FakePaymentProvider();
  const casos: Array<[string, Record<string, unknown>]> = [
    ["o mesmo plano", { target_plan_id: PLANO_TESOURA_ID }],
    ["um plano que nao comporta os profissionais ativos", { status: "trialing", target_plan_price: "59.90", target_max_professionals: 1, active_professionals: 3 }],
  ];
  for (const [nome, contexto] of casos) {
    const supabase = supabaseDaTroca(comContexto(contexto));
    try {
      const res = await handlerDaTroca(provider)(trocarPlano());

      assertEquals(res.status, 409, nome);
      nadaFoiCobradoNemTrocado(provider, supabase);
    } finally {
      supabase.restore();
    }
  }
});

// A funcao do banco e a ultima guarda: se a situacao mudou entre a cotacao e a troca, ela recusa.
for (const [code, trecho] of [
  ["55000", "não aceita"],
  ["53400", "Exclua"],
  ["22023", "trocar para este plano"],
  ["XX000", "Tente de novo"],
] as const) {
  Deno.test(`trocar_plano sem cobranca: o banco recusa a troca (${code}) e o Gerente recebe o motivo`, async () => {
    const provider = new FakePaymentProvider();
    const supabase = supabaseDaTroca({
      ...comContexto({ status: "trialing", current_period_start: null, current_period_end: null }),
      "rest/v1/rpc/apply_plan_change": { status: 400, body: { code, message: "recusado" } },
    });
    const logs = capturarLogs();
    try {
      const res = await handlerDaTroca(provider)(request({ action: "trocar_plano", planId: PLANO_MAQUINA_ID }));
      const corpo = await res.json();

      assertEquals(res.status, code === "XX000" ? 500 : 409);
      assertEquals(corpo.error.includes(trecho), true, corpo.error);
      assertEquals(provider.changedAmounts.length, 0);
    } finally {
      logs.restaurar();
      supabase.restore();
    }
  });
}

// --- Credenciais do provedor: o token e a Public Key da cobranca avulsa -------------------------------------------------

// No DEV a assinatura usa o Access Token do vendedor de teste, mas a API de pagamentos so aceita o token de teste do
// app (e um e-mail de pagador que nao seja de conta de teste). Em prod um token so serve para os dois.
const respostasDoMercadoPago = {
  "api.mercadopago.com/v1/payments": {
    status: 201,
    body: {
      id: 1352660205,
      status: "approved",
      transaction_amount: 20,
      date_created: "2026-10-11T09:00:01.000-04:00",
      date_approved: "2026-10-11T09:00:02.000-04:00",
      external_reference: "tenant-1",
      metadata: { kind: "upgrade" },
      payment_method_id: "visa",
      card: { last_four_digits: "5682" },
    },
  },
  "api.mercadopago.com/preapproval/mp-sub-1": { status: 200, body: { id: "mp-sub-1", status: "authorized" } },
};

const usandoCredenciais = async (variaveis: Record<string, string>, teste: () => Promise<void>) => {
  const nomes = ["MP_ACCESS_TOKEN", "MP_CHARGE_ACCESS_TOKEN", "MP_CHARGE_PAYER_EMAIL"];
  for (const nome of nomes) Deno.env.delete(nome);
  for (const [nome, valor] of Object.entries(variaveis)) Deno.env.set(nome, valor);
  try {
    await teste();
  } finally {
    for (const nome of nomes) Deno.env.delete(nome);
  }
};

Deno.test("trocar_plano: com um token separado para a cobranca avulsa, ele cobra e o da assinatura muda o valor; o e-mail do pagador vem da configuracao", async () => {
  await usandoCredenciais(
    { MP_ACCESS_TOKEN: "sub-token", MP_CHARGE_ACCESS_TOKEN: "charge-token", MP_CHARGE_PAYER_EMAIL: "pagador-dev@navalhado.test" },
    async () => {
      const supabase = supabaseDaTroca(respostasDoMercadoPago);
      try {
        const res = await createHandler({ now: () => AGORA })(trocarPlano());

        assertEquals(res.status, 200);
        const pagamento = supabase.calls.find((chamada) => chamada.url.includes("/v1/payments"));
        const mudancaDeValor = supabase.calls.find((chamada) => chamada.url.includes("/preapproval/mp-sub-1"));
        assertEquals(pagamento?.authorization, "Bearer charge-token");
        assertEquals((pagamento?.body as { payer: { email: string } }).payer.email, "pagador-dev@navalhado.test");
        assertEquals(mudancaDeValor?.authorization, "Bearer sub-token");
        assertEquals(mudancaDeValor?.method, "PUT");
      } finally {
        supabase.restore();
      }
    },
  );
});

Deno.test("trocar_plano: sem token separado (prod), o mesmo token cobra e muda o valor, e o pagador e o Gerente", async () => {
  // O e-mail de pagador configurado sozinho nao vale: sem o token separado ele tiraria o e-mail real do Gerente.
  await usandoCredenciais({ MP_ACCESS_TOKEN: "sub-token", MP_CHARGE_PAYER_EMAIL: "pagador-dev@navalhado.test" }, async () => {
    const supabase = supabaseDaTroca(respostasDoMercadoPago);
    try {
      const res = await createHandler({ now: () => AGORA })(trocarPlano());

      assertEquals(res.status, 200);
      const pagamento = supabase.calls.find((chamada) => chamada.url.includes("/v1/payments"));
      const mudancaDeValor = supabase.calls.find((chamada) => chamada.url.includes("/preapproval/mp-sub-1"));
      assertEquals(pagamento?.authorization, "Bearer sub-token");
      assertEquals((pagamento?.body as { payer: { email: string } }).payer.email, "gerente@barbearia.test");
      assertEquals(mudancaDeValor?.authorization, "Bearer sub-token");
    } finally {
      supabase.restore();
    }
  });
});

Deno.test("trocar_plano: sem nenhum token do Mercado Pago configurado, a cobranca responde 500 sem chamar ninguem", async () => {
  await usandoCredenciais({}, async () => {
    const supabase = supabaseDaTroca(respostasDoMercadoPago);
    const logs = capturarLogs();
    try {
      const res = await createHandler({ now: () => AGORA })(trocarPlano());

      assertEquals(res.status, 500);
      assertEquals(supabase.calls.some((chamada) => chamada.url.includes("api.mercadopago.com")), false);
      assertEquals(supabase.rpcCalls("apply_plan_change").length, 0);
    } finally {
      logs.restaurar();
      supabase.restore();
    }
  });
});

const CHAVE_DA_COBRANCA = "TEST-0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

Deno.test("chave_publica para a cobranca avulsa: devolve a Public Key separada quando ela esta configurada; senao a da assinatura", async () => {
  Deno.env.set("MP_PUBLIC_KEY", CHAVE_PUBLICA);
  const supabase = setupSupabase({ "rest/v1/rpc/get_billing_context": { status: 200, body: [ativa] } });
  try {
    const handler = createHandler({ provider: new FakePaymentProvider() });
    const semSeparada = await handler(request({ action: "chave_publica", uso: "cobranca" }));
    Deno.env.set("MP_CHARGE_PUBLIC_KEY", `  ${CHAVE_DA_COBRANCA}\n`);
    const comSeparada = await handler(request({ action: "chave_publica", uso: "cobranca" }));
    // A troca de cartao continua com a chave da assinatura: o token so vale para o app que o gerou.
    const daAssinatura = await handler(request({ action: "chave_publica" }));
    const uso = await handler(request({ action: "chave_publica", uso: "assinatura" }));

    assertEquals((await semSeparada.json()).publicKey, CHAVE_PUBLICA);
    assertEquals((await comSeparada.json()).publicKey, CHAVE_DA_COBRANCA);
    assertEquals((await daAssinatura.json()).publicKey, CHAVE_PUBLICA);
    assertEquals((await uso.json()).publicKey, CHAVE_PUBLICA);
  } finally {
    supabase.restore();
    Deno.env.delete("MP_PUBLIC_KEY");
    Deno.env.delete("MP_CHARGE_PUBLIC_KEY");
  }
});

Deno.test("chave_publica para a cobranca avulsa: a chave separada com formato errado vira erro 500, sem devolver nem logar o valor", async () => {
  const valor = "APP_USR-8804558755729035-092911-0123456789abcdef0123456789abcdef-3726971584";
  Deno.env.set("MP_PUBLIC_KEY", CHAVE_PUBLICA);
  Deno.env.set("MP_CHARGE_PUBLIC_KEY", valor);
  const supabase = setupSupabase({ "rest/v1/rpc/get_billing_context": { status: 200, body: [ativa] } });
  const logs = capturarLogs();
  try {
    const res = await createHandler({ provider: new FakePaymentProvider() })(request({ action: "chave_publica", uso: "cobranca" }));
    const corpo = await res.text();

    assertEquals(res.status, 500);
    assertEquals(corpo.includes(valor), false);
    assertEquals(logs.linhas.length > 0, true);
    assertEquals(logs.linhas.some((linha) => linha.includes(valor)), false, logs.linhas.join("\n"));
  } finally {
    logs.restaurar();
    supabase.restore();
    Deno.env.delete("MP_PUBLIC_KEY");
    Deno.env.delete("MP_CHARGE_PUBLIC_KEY");
  }
});

// ---------------------------------------------------------------------------
// Spec 052, ticket 11: descer de plano agendado. Na assinatura ativa, "trocar_plano" para um plano mais
// barato nao cobra nem troca nada agora: agenda o plano menor para a proxima cobranca (sem reembolso),
// muda o valor da assinatura no Mercado Pago e, se o Mercado Pago nao aceitar, desfaz o agendamento para
// o banco e o Mercado Pago nao ficarem em desacordo. "desfazer_descida" volta o valor da assinatura e
// tira o agendamento. Em teste descer troca na hora (o caminho do ticket 10).
// ---------------------------------------------------------------------------

const contextoDaDescida = {
  current_plan_id: PLANO_MAQUINA_ID,
  current_plan_price: "89.90",
  target_plan_id: PLANO_TESOURA_ID,
  target_plan_name: "Tesoura",
  target_plan_price: "59.90",
  target_max_professionals: 1,
};
const descer = (extra: Record<string, unknown> = {}) => request({ action: "trocar_plano", planId: PLANO_TESOURA_ID, ...extra });
const cotarDescida = () => request({ action: "cotar_troca_de_plano", planId: PLANO_TESOURA_ID });
const desfazerDescida = () => request({ action: "desfazer_descida" });
const comDescidaAgendada = (extra: Record<string, unknown> = {}) =>
  comContexto({ ...contextoDaDescida, target_plan_id: PLANO_MAQUINA_ID, scheduled_plan_id: PLANO_TESOURA_ID, ...extra });

Deno.test("cotar_troca_de_plano: descer na assinatura ativa e descida agendada: sem cobranca, vale no fim do periodo pago", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca(comContexto(contextoDaDescida));
  try {
    const res = await handlerDaTroca(provider)(cotarDescida());

    assertEquals(res.status, 200);
    assertEquals(await res.json(), {
      mode: "scheduled",
      difference: 0,
      newMonthlyAmount: 59.9,
      remainingDays: null,
      periodDays: null,
      effectiveAt: "2026-10-31T12:00:00.000Z",
      planName: "Tesoura",
    });
    nadaFoiCobradoNemTrocado(provider, supabase);
    assertEquals(supabase.rpcCalls("schedule_plan_downgrade").length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("cotar_troca_de_plano: descer com mais profissionais do que o plano menor aceita responde 409 com quantos excluir", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca(comContexto({ ...contextoDaDescida, active_professionals: 3 }));
  try {
    const res = await handlerDaTroca(provider)(cotarDescida());
    const mensagem = (await res.json()).error as string;

    assertEquals(res.status, 409);
    assertEquals(mensagem.includes("Exclua 2 profissionais"), true, mensagem);
    assertEquals(mensagem.includes("Desative"), false, mensagem);
  } finally {
    supabase.restore();
  }
});

Deno.test("cotar_troca_de_plano: o plano que ja esta agendado e cotado de novo, como descida agendada", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca(comContexto({ ...contextoDaDescida, scheduled_plan_id: PLANO_TESOURA_ID }));
  try {
    const res = await handlerDaTroca(provider)(cotarDescida());

    assertEquals(res.status, 200);
    assertEquals((await res.json()).mode, "scheduled");
  } finally {
    supabase.restore();
  }
});

// A mensalidade ja foi cobrada e o aviso do Mercado Pago ainda nao chegou: o periodo pago acabou (AGORA e 11/10; o periodo
// vai ate 01/10) e a assinatura segue "ativa". Agendar agora valeria para uma mensalidade ja cobrada pelo valor do plano maior.
const comPeriodoVencido = {
  current_period_start: "2026-09-01T12:00:00+00:00",
  current_period_end: "2026-10-01T12:00:00+00:00",
};

Deno.test("cotar_troca_de_plano: descer com o periodo pago vencido responde 409 e diz que a mensalidade ainda nao foi processada", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca(comContexto({ ...contextoDaDescida, ...comPeriodoVencido }));
  try {
    const res = await handlerDaTroca(provider)(cotarDescida());

    assertEquals(res.status, 409);
    assertEquals((await res.json()).error.includes("ainda não foi processada"), true);
  } finally {
    supabase.restore();
  }
});

Deno.test("trocar_plano: descer com o periodo pago vencido responde 409 e nao agenda nada nem mexe no Mercado Pago", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca(comContexto({ ...contextoDaDescida, ...comPeriodoVencido }));
  try {
    const res = await handlerDaTroca(provider)(descer());

    assertEquals(res.status, 409);
    assertEquals(supabase.rpcCalls("schedule_plan_downgrade").length, 0);
    assertEquals(provider.changedAmounts.length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("trocar_plano: descer na assinatura ativa agenda o plano menor e muda o valor da assinatura, sem cobrar e sem pedir cartao", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca(comContexto(contextoDaDescida));
  try {
    const res = await handlerDaTroca(provider)(descer());

    assertEquals(res.status, 200);
    assertEquals(await res.json(), {
      scheduled: true,
      planId: PLANO_TESOURA_ID,
      planName: "Tesoura",
      effectiveAt: "2026-10-31T12:00:00.000Z",
      newMonthlyAmount: 59.9,
    });
    assertEquals(supabase.rpcCalls("schedule_plan_downgrade"), [{ p_tenant_id: "tenant-1", p_plan_id: PLANO_TESOURA_ID }]);
    assertEquals(provider.changedAmounts, [{ subscriptionId: "mp-sub-1", amount: 59.9 }]);
    assertEquals(provider.charges.length, 0);
    assertEquals(supabase.rpcCalls("apply_plan_change").length, 0);
    assertEquals(supabase.rpcCalls("cancel_plan_downgrade").length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("trocar_plano: descer sem assinatura no Mercado Pago so agenda no banco", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca(comContexto({ ...contextoDaDescida, mp_subscription_id: null }));
  try {
    const res = await handlerDaTroca(provider)(descer());

    assertEquals(res.status, 200);
    assertEquals(supabase.rpcCalls("schedule_plan_downgrade").length, 1);
    assertEquals(provider.changedAmounts.length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("trocar_plano: o Mercado Pago nao aceita o valor novo: o agendamento e desfeito e o Gerente e avisado", async () => {
  const provider = new FakePaymentProvider();
  provider.failAmountChangeWith = new PaymentProviderError("Mercado Pago respondeu 429: local_rate_limited", 429);
  const supabase = supabaseDaTroca(comContexto(contextoDaDescida));
  const logs = capturarLogs();
  try {
    const res = await handlerDaTroca(provider)(descer());
    const corpo = await res.json();

    assertEquals(res.status, 502);
    assertEquals(corpo.error.includes("agendar"), true);
    assertEquals(supabase.rpcCalls("schedule_plan_downgrade").length, 1);
    assertEquals(supabase.rpcCalls("cancel_plan_downgrade"), [{ p_tenant_id: "tenant-1" }]);
    assertEquals(logs.linhas.some((linha) => linha.includes("429")), true, logs.linhas.join("\n"));
    // 429 e recusa clara (o pedido nao foi processado): nao ha o que conferir no Mercado Pago.
    assertEquals(provider.requestedSubscriptions.length, 0);
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

Deno.test("trocar_plano: se nem o desfazer do agendamento passa, o log diz que o banco e o Mercado Pago ficaram em desacordo", async () => {
  const provider = new FakePaymentProvider();
  provider.failAmountChangeWith = new PaymentProviderError("Mercado Pago respondeu 422: invalid amount", 422);
  const supabase = supabaseDaTroca({
    ...comContexto(contextoDaDescida),
    "rest/v1/rpc/cancel_plan_downgrade": { status: 500, body: { code: "XX000", message: "falha" } },
  });
  const logs = capturarLogs();
  try {
    const res = await handlerDaTroca(provider)(descer());

    assertEquals(res.status, 502);
    assertEquals(logs.linhas.some((linha) => linha.includes("tenant-1") && linha.includes("agendamento")), true, logs.linhas.join("\n"));
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

// Trocar uma descida ja agendada por outra: o agendamento que o pedido substituiu volta, em vez de sumir. Bancada com a
// Maquina agendada (o Mercado Pago cobra R$ 89,90) escolhe a Tesoura; o Mercado Pago recusa o valor de R$ 59,90.
const bancadaComMaquinaAgendada = {
  current_plan_id: PLANO_BANCADA_ID,
  current_plan_price: "159.90",
  scheduled_plan_id: PLANO_MAQUINA_ID,
};

Deno.test("trocar_plano: o Mercado Pago recusa o valor ao trocar uma descida ja agendada por outra: o agendamento anterior volta, nao some", async () => {
  const provider = new FakePaymentProvider();
  provider.failAmountChangeWith = new PaymentProviderError("Mercado Pago respondeu 400: invalid amount", 400);
  const supabase = supabaseDaTroca(comContexto({ ...contextoDaDescida, ...bancadaComMaquinaAgendada }));
  const logs = capturarLogs();
  try {
    const res = await handlerDaTroca(provider)(descer());

    assertEquals(res.status, 502);
    assertEquals(supabase.rpcCalls("schedule_plan_downgrade"), [
      { p_tenant_id: "tenant-1", p_plan_id: PLANO_TESOURA_ID },
      { p_tenant_id: "tenant-1", p_plan_id: PLANO_MAQUINA_ID },
    ]);
    assertEquals(supabase.rpcCalls("cancel_plan_downgrade").length, 0);
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

Deno.test("trocar_plano: se o agendamento anterior nao volta, o log diz qual barbearia e quais planos conferir", async () => {
  const provider = new FakePaymentProvider();
  provider.failAmountChangeWith = new PaymentProviderError("Mercado Pago respondeu 400: invalid amount", 400);
  let chamadas = 0;
  const supabase = supabaseDaTroca({
    ...comContexto({ ...contextoDaDescida, ...bancadaComMaquinaAgendada }),
    // A primeira chamada agenda a Tesoura; a segunda, que restaura a Maquina, falha.
    "rest/v1/rpc/schedule_plan_downgrade": () =>
      chamadas++ === 0 ? { status: 200, body: "scheduled" } : { status: 500, body: { code: "XX000", message: "falha" } },
  });
  const logs = capturarLogs();
  try {
    const res = await handlerDaTroca(provider)(descer());

    assertEquals(res.status, 502);
    assertEquals(chamadas, 2);
    assertEquals(
      logs.linhas.some((linha) => linha.includes("tenant-1") && linha.includes("agendamento anterior")),
      true,
      logs.linhas.join("\n"),
    );
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

Deno.test("trocar_plano: pedir de novo o plano que ja esta agendado confere o valor no Mercado Pago e responde 200, sem desfazer nada", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca({
    ...comContexto({ ...contextoDaDescida, scheduled_plan_id: PLANO_TESOURA_ID }),
    "rest/v1/rpc/schedule_plan_downgrade": { status: 200, body: "unchanged" },
  });
  try {
    const res = await handlerDaTroca(provider)(descer());

    assertEquals(res.status, 200);
    assertEquals((await res.json()).scheduled, true);
    assertEquals(provider.changedAmounts, [{ subscriptionId: "mp-sub-1", amount: 59.9 }]);
    assertEquals(supabase.rpcCalls("cancel_plan_downgrade").length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("trocar_plano: pedir de novo o plano ja agendado com o Mercado Pago recusando o valor nao desfaz o agendamento que ja existia", async () => {
  const provider = new FakePaymentProvider();
  provider.failAmountChangeWith = new PaymentProviderError("Mercado Pago respondeu 400: invalid amount", 400);
  const supabase = supabaseDaTroca({
    ...comContexto({ ...contextoDaDescida, scheduled_plan_id: PLANO_TESOURA_ID }),
    "rest/v1/rpc/schedule_plan_downgrade": { status: 200, body: "unchanged" },
  });
  const logs = capturarLogs();
  try {
    const res = await handlerDaTroca(provider)(descer());

    assertEquals(res.status, 502);
    assertEquals(supabase.rpcCalls("schedule_plan_downgrade").length, 1);
    assertEquals(supabase.rpcCalls("cancel_plan_downgrade").length, 0);
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

// Falha sem resposta (timeout, queda de conexao) ou 5xx: o Mercado Pago pode ja ter aplicado o valor. Antes de tratar como
// "nao aplicou" a funcao confere o valor que a assinatura tem la.
const falhaSemResposta = () => new PaymentProviderError("Mercado Pago nao respondeu a tempo");
const assinaturaNoMercadoPago = (amount: number) => ({ id: "mp-sub-1", status: "authorized", amount });

Deno.test("trocar_plano: falha sem resposta mas o Mercado Pago ja tem o valor novo: a descida fica agendada e o Gerente recebe o sucesso", async () => {
  const provider = new FakePaymentProvider();
  provider.failAmountChangeWith = falhaSemResposta();
  provider.subscriptions.set("mp-sub-1", assinaturaNoMercadoPago(59.9));
  const supabase = supabaseDaTroca(comContexto(contextoDaDescida));
  const logs = capturarLogs();
  try {
    const res = await handlerDaTroca(provider)(descer());

    assertEquals(res.status, 200);
    assertEquals((await res.json()).scheduled, true);
    assertEquals(provider.requestedSubscriptions, ["mp-sub-1"]);
    assertEquals(supabase.rpcCalls("cancel_plan_downgrade").length, 0);
    assertEquals(logs.linhas.some((linha) => linha.includes("tenant-1")), true, logs.linhas.join("\n"));
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

Deno.test("trocar_plano: falha 5xx e o Mercado Pago segue com o valor antigo: o agendamento e desfeito", async () => {
  const provider = new FakePaymentProvider();
  provider.failAmountChangeWith = new PaymentProviderError("Mercado Pago respondeu 504: gateway timeout", 504);
  provider.subscriptions.set("mp-sub-1", assinaturaNoMercadoPago(89.9));
  const supabase = supabaseDaTroca(comContexto(contextoDaDescida));
  const logs = capturarLogs();
  try {
    const res = await handlerDaTroca(provider)(descer());

    assertEquals(res.status, 502);
    assertEquals(provider.requestedSubscriptions, ["mp-sub-1"]);
    assertEquals(supabase.rpcCalls("cancel_plan_downgrade"), [{ p_tenant_id: "tenant-1" }]);
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

Deno.test("trocar_plano: falha sem resposta e nao ha como conferir o valor: o agendamento fica, o log diz o que conferir e o Gerente pode tentar de novo", async () => {
  const provider = new FakePaymentProvider();
  provider.failAmountChangeWith = falhaSemResposta();
  // Sem a assinatura no provedor falso, a conferencia tambem falha (404).
  const supabase = supabaseDaTroca(comContexto(contextoDaDescida));
  const logs = capturarLogs();
  try {
    const res = await handlerDaTroca(provider)(descer());

    assertEquals(res.status, 502);
    assertEquals(supabase.rpcCalls("cancel_plan_downgrade").length, 0);
    assertEquals(logs.linhas.some((linha) => linha.includes("tenant-1") && linha.includes("confirmar")), true, logs.linhas.join("\n"));
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

for (const [code, trecho] of [
  ["55000", "não aceita"],
  ["53400", "Exclua"],
  ["22023", "não foi possível"],
  ["XX000", "Tente de novo"],
] as const) {
  Deno.test(`trocar_plano: o banco recusa agendar a descida (${code}) e o Gerente recebe o motivo, sem mexer no Mercado Pago`, async () => {
    const provider = new FakePaymentProvider();
    const supabase = supabaseDaTroca({
      ...comContexto(contextoDaDescida),
      "rest/v1/rpc/schedule_plan_downgrade": { status: 400, body: { code, message: "recusado" } },
    });
    const logs = capturarLogs();
    try {
      const res = await handlerDaTroca(provider)(descer());
      const corpo = await res.json();

      assertEquals(res.status, code === "XX000" ? 500 : 409);
      assertEquals(String(corpo.error).toLowerCase().includes(trecho.toLowerCase()), true, corpo.error);
      assertEquals(provider.changedAmounts.length, 0);
      assertEquals(supabase.rpcCalls("cancel_plan_downgrade").length, 0);
    } finally {
      logs.restaurar();
      supabase.restore();
    }
  });
}

Deno.test("trocar_plano: o banco recusa agendar porque o periodo pago venceu (PERIOD_ELAPSED): o Gerente recebe o motivo, sem mexer no Mercado Pago", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca({
    ...comContexto(contextoDaDescida),
    "rest/v1/rpc/schedule_plan_downgrade": {
      status: 400,
      body: { code: "55000", message: "PERIOD_ELAPSED: o periodo pago ja venceu e a mensalidade ainda nao foi processada." },
    },
  });
  const logs = capturarLogs();
  try {
    const res = await handlerDaTroca(provider)(descer());

    assertEquals(res.status, 409);
    assertEquals((await res.json()).error.includes("ainda não foi processada"), true);
    assertEquals(provider.changedAmounts.length, 0);
    assertEquals(supabase.rpcCalls("cancel_plan_downgrade").length, 0);
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

Deno.test("trocar_plano: descer com mais profissionais ativos do que o plano menor aceita nao agenda nada", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca(comContexto({ ...contextoDaDescida, active_professionals: 3 }));
  try {
    const res = await handlerDaTroca(provider)(descer());

    assertEquals(res.status, 409);
    assertEquals(supabase.rpcCalls("schedule_plan_downgrade").length, 0);
    assertEquals(provider.changedAmounts.length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("trocar_plano: em teste descer troca na hora, sem agendar", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca({
    "rest/v1/rpc/get_billing_context": { status: 200, body: [{ ...ativa, status: "trialing", mp_subscription_id: null }] },
    ...comContexto({ ...contextoDaDescida, status: "trialing", mp_subscription_id: null, current_period_start: null, current_period_end: null }),
  });
  try {
    const res = await handlerDaTroca(provider)(descer());

    assertEquals(res.status, 200);
    assertEquals((await res.json()).changed, true);
    assertEquals(supabase.rpcCalls("apply_plan_change").length, 1);
    assertEquals(supabase.rpcCalls("schedule_plan_downgrade").length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("trocar_plano: subir de plano com uma descida agendada continua cobrando a diferenca (o banco desfaz o agendamento ao trocar)", async () => {
  const provider = new FakePaymentProvider();
  // Maquina com descida para a Tesoura agendada subindo para a Bancada: 70,00 x 20/30 = 46,67.
  const supabase = supabaseDaTroca(comContexto({
    current_plan_id: PLANO_MAQUINA_ID,
    current_plan_price: "89.90",
    target_plan_id: PLANO_BANCADA_ID,
    target_plan_name: "Bancada",
    target_plan_price: "159.90",
    target_max_professionals: 10,
    scheduled_plan_id: PLANO_TESOURA_ID,
  }));
  try {
    const res = await handlerDaTroca(provider)(
      request({ action: "trocar_plano", planId: PLANO_BANCADA_ID, cardToken: TOKEN_DO_CARTAO, expectedAmount: 46.67 }),
    );

    assertEquals(res.status, 200);
    assertEquals(provider.charges.length, 1);
    assertEquals(supabase.rpcCalls("apply_plan_change").length, 1);
    assertEquals(provider.changedAmounts, [{ subscriptionId: "mp-sub-1", amount: 159.9 }]);
  } finally {
    supabase.restore();
  }
});

// --- desfazer_descida --------------------------------------------------------------------------------------------

Deno.test("desfazer_descida: volta o valor da assinatura para o do plano atual e tira o agendamento", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca(comDescidaAgendada());
  try {
    const res = await handlerDaTroca(provider)(desfazerDescida());

    assertEquals(res.status, 200);
    assertEquals(await res.json(), { canceled: true });
    assertEquals(supabase.rpcCalls("get_plan_change_context"), [{ p_tenant_id: "tenant-1", p_plan_id: "plan-maquina" }]);
    assertEquals(provider.changedAmounts, [{ subscriptionId: "mp-sub-1", amount: 89.9 }]);
    assertEquals(supabase.rpcCalls("cancel_plan_downgrade"), [{ p_tenant_id: "tenant-1" }]);
    assertEquals(provider.charges.length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("desfazer_descida: sem descida agendada responde 409 e nao mexe em nada", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca(comDescidaAgendada({ scheduled_plan_id: null }));
  try {
    const res = await handlerDaTroca(provider)(desfazerDescida());

    assertEquals(res.status, 409);
    assertEquals(provider.changedAmounts.length, 0);
    assertEquals(supabase.rpcCalls("cancel_plan_downgrade").length, 0);
  } finally {
    supabase.restore();
  }
});

for (const status of ["trialing", "blocked", "canceled", "courtesy"]) {
  Deno.test(`desfazer_descida: assinatura ${status} responde 409`, async () => {
    const provider = new FakePaymentProvider();
    const supabase = supabaseDaTroca(comDescidaAgendada({ status }));
    try {
      const res = await handlerDaTroca(provider)(desfazerDescida());

      assertEquals(res.status, 409);
      assertEquals(provider.changedAmounts.length, 0);
      assertEquals(supabase.rpcCalls("cancel_plan_downgrade").length, 0);
    } finally {
      supabase.restore();
    }
  });
}

// Com o pagamento recusado a descida segue agendada (o Mercado Pago tenta de novo pelo valor do plano menor) e o limite
// menor continua valendo para cadastros: o Gerente precisa poder desfazer, senao nao ve nem levanta o que o restringe.
Deno.test("desfazer_descida: com o pagamento recusado desfaz do mesmo jeito, mesmo com o periodo ja vencido", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca(comDescidaAgendada({ status: "past_due", ...comPeriodoVencido }));
  try {
    const res = await handlerDaTroca(provider)(desfazerDescida());

    assertEquals(res.status, 200);
    assertEquals(await res.json(), { canceled: true });
    assertEquals(provider.changedAmounts, [{ subscriptionId: "mp-sub-1", amount: 89.9 }]);
    assertEquals(supabase.rpcCalls("cancel_plan_downgrade"), [{ p_tenant_id: "tenant-1" }]);
  } finally {
    supabase.restore();
  }
});

Deno.test("desfazer_descida: na assinatura ativa com o periodo vencido responde 409 e nao mexe no Mercado Pago", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca(comDescidaAgendada(comPeriodoVencido));
  try {
    const res = await handlerDaTroca(provider)(desfazerDescida());

    assertEquals(res.status, 409);
    assertEquals((await res.json()).error.includes("ainda não foi processada"), true);
    assertEquals(provider.changedAmounts.length, 0);
    assertEquals(supabase.rpcCalls("cancel_plan_downgrade").length, 0);
  } finally {
    supabase.restore();
  }
});

// Entre ler o contexto e desfazer, outro pedido resolveu a descida: a renovacao aplicou o plano menor, ou uma subida de
// plano limpou o agendamento. O banco responde "none" e a funcao nao pode dizer que desfez: o valor que ela acabou de por no
// Mercado Pago (o do plano que ela leu) pode ja nao ser o do plano de agora, entao ela o confere de novo.
Deno.test("desfazer_descida: o agendamento ja nao existia (none) e o plano mudou no meio: o valor da assinatura volta ao do plano de agora", async () => {
  const provider = new FakePaymentProvider();
  let leituras = 0;
  const supabase = supabaseDaTroca({
    ...comDescidaAgendada(),
    "rest/v1/rpc/cancel_plan_downgrade": { status: 200, body: "none" },
    // A primeira leitura e a do inicio do pedido (Maquina); a segunda, depois de uma subida para a Bancada.
    "rest/v1/rpc/get_billing_context": () => ({
      status: 200,
      body: [leituras++ === 0 ? ativa : { ...ativa, plan_id: PLANO_BANCADA_ID, plan_name: "Bancada", plan_price: 159.9 }],
    }),
  });
  const logs = capturarLogs();
  try {
    const res = await handlerDaTroca(provider)(desfazerDescida());
    const corpo = await res.json();

    assertEquals(res.status, 409);
    assertEquals(corpo.canceled, undefined);
    assertEquals(corpo.error.includes("já não está agendada"), true, corpo.error);
    assertEquals(provider.changedAmounts, [
      { subscriptionId: "mp-sub-1", amount: 89.9 },
      { subscriptionId: "mp-sub-1", amount: 159.9 },
    ]);
    assertEquals(logs.linhas.some((linha) => linha.includes("tenant-1") && linha.includes("já não estava agendada")), true, logs.linhas.join("\n"));
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

Deno.test("desfazer_descida: o agendamento ja nao existia (none) e o Mercado Pago nao aceita a conferencia: 502 e o log diz qual barbearia conferir", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca({
    ...comDescidaAgendada(),
    "rest/v1/rpc/cancel_plan_downgrade": { status: 200, body: "none" },
  });
  const logs = capturarLogs();
  try {
    // O primeiro valor entra; a conferencia seguinte e recusada.
    let chamadas = 0;
    const original = provider.changeAmount.bind(provider);
    provider.changeAmount = (subscriptionId, amount) =>
      chamadas++ === 0 ? original(subscriptionId, amount) : Promise.reject(new PaymentProviderError("Mercado Pago respondeu 400", 400));
    const res = await handlerDaTroca(provider)(desfazerDescida());

    assertEquals(res.status, 502);
    assertEquals(logs.linhas.some((linha) => linha.includes("tenant-1") && linha.includes("confira")), true, logs.linhas.join("\n"));
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

Deno.test("desfazer_descida: o banco recusa desfazer porque o periodo venceu (PERIOD_ELAPSED): 409 com o motivo", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca({
    ...comDescidaAgendada(),
    "rest/v1/rpc/cancel_plan_downgrade": {
      status: 400,
      body: { code: "55000", message: "PERIOD_ELAPSED: o periodo pago ja venceu e a mensalidade ainda nao foi processada." },
    },
  });
  const logs = capturarLogs();
  try {
    const res = await handlerDaTroca(provider)(desfazerDescida());

    assertEquals(res.status, 409);
    assertEquals((await res.json()).error.includes("ainda não foi processada"), true);
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

Deno.test("desfazer_descida: o Mercado Pago nao aceita o valor: o agendamento fica como esta e o Gerente e avisado", async () => {
  const provider = new FakePaymentProvider();
  provider.failAmountChangeWith = new PaymentProviderError("Mercado Pago respondeu 429: local_rate_limited", 429);
  const supabase = supabaseDaTroca(comDescidaAgendada());
  const logs = capturarLogs();
  try {
    const res = await handlerDaTroca(provider)(desfazerDescida());

    assertEquals(res.status, 502);
    assertEquals(supabase.rpcCalls("cancel_plan_downgrade").length, 0);
    assertEquals(logs.linhas.some((linha) => linha.includes("429")), true, logs.linhas.join("\n"));
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

Deno.test("desfazer_descida: o valor voltou no Mercado Pago mas o banco nao desfez: erro 500 e o log diz qual barbearia conferir", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca({
    ...comDescidaAgendada(),
    "rest/v1/rpc/cancel_plan_downgrade": { status: 500, body: { code: "XX000", message: "falha" } },
  });
  const logs = capturarLogs();
  try {
    const res = await handlerDaTroca(provider)(desfazerDescida());

    assertEquals(res.status, 500);
    assertEquals(provider.changedAmounts.length, 1);
    assertEquals(logs.linhas.some((linha) => linha.includes("tenant-1")), true, logs.linhas.join("\n"));
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

Deno.test("desfazer_descida: sem assinatura no Mercado Pago so desfaz no banco", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca(comDescidaAgendada({ mp_subscription_id: null }));
  try {
    const res = await handlerDaTroca(provider)(desfazerDescida());

    assertEquals(res.status, 200);
    assertEquals(provider.changedAmounts.length, 0);
    assertEquals(supabase.rpcCalls("cancel_plan_downgrade").length, 1);
  } finally {
    supabase.restore();
  }
});

Deno.test("desfazer_descida: quem nao e Gerente do tenant recebe 403 e nada e lido nem mudado", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDaTroca({ "rest/v1/rpc/get_billing_context": { status: 200, body: [] } });
  try {
    const res = await handlerDaTroca(provider)(desfazerDescida());

    assertEquals(res.status, 403);
    assertEquals(supabase.rpcCalls("get_plan_change_context").length, 0);
    assertEquals(supabase.rpcCalls("cancel_plan_downgrade").length, 0);
    assertEquals(provider.changedAmounts.length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("desfazer_descida: sem o token do Mercado Pago configurado nao tenta e o Gerente recebe o erro de cobranca indisponivel", async () => {
  Deno.env.delete("MP_ACCESS_TOKEN");
  const supabase = supabaseDaTroca(comDescidaAgendada());
  const logs = capturarLogs();
  try {
    const res = await createHandler({ now: () => AGORA })(desfazerDescida());

    // O 500 e o da configuracao que falta, nao o de outra falha qualquer antes dela.
    assertEquals(res.status, 500);
    assertEquals((await res.json()).error, "Cobrança indisponível.");
    assertEquals(logs.linhas.some((linha) => linha.includes("MP_ACCESS_TOKEN")), true, logs.linhas.join("\n"));
    assertEquals(supabase.rpcCalls("cancel_plan_downgrade").length, 0);
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

// ---------------------------------------------------------------------------
// Spec 052, ticket 12: cancelar a assinatura. A acao "cancelar" cancela no Mercado Pago na hora (a cobranca recorrente
// para) e so depois grava a situacao e a data do cancelamento no banco; se a gravacao falhar depois do cancelamento, o
// aviso do webhook completa. Vale para a assinatura ativa, com pagamento recusado e, em teste, a que ja tem o cartao
// autorizado no Mercado Pago (cancelar tira a cobranca do fim do teste).
// ---------------------------------------------------------------------------

const cancelar = () => request({ action: "cancelar" });
const supabaseDoCancelamento = (overrides: Record<string, Mock> = {}) =>
  setupSupabase({
    "rest/v1/rpc/get_billing_context": { status: 200, body: [ativa] },
    "rest/v1/rpc/cancel_subscription": { status: 200, body: "canceled" },
    ...overrides,
  });
const comSituacao = (status: string, extra: Record<string, unknown> = {}): Record<string, Mock> => ({
  "rest/v1/rpc/get_billing_context": { status: 200, body: [{ ...ativa, status, ...extra }] },
});
const aAssinaturaNoMercadoPago = (status: string) => ({ id: "mp-sub-1", status });

Deno.test("cancelar: cancela a assinatura no Mercado Pago e so depois grava a situacao no banco", async () => {
  const provider = new FakePaymentProvider();
  let canceladaNoProvedorAntesDoBanco: boolean | null = null;
  const supabase = supabaseDoCancelamento({
    "rest/v1/rpc/cancel_subscription": () => {
      canceladaNoProvedorAntesDoBanco = provider.cancelledSubscriptions.length === 1;
      return { status: 200, body: "canceled" };
    },
  });
  try {
    const res = await createHandler({ provider })(cancelar());

    assertEquals(res.status, 200);
    assertEquals(await res.json(), { canceled: true });
    assertEquals(provider.cancelledSubscriptions, ["mp-sub-1"]);
    assertEquals(supabase.rpcCalls("cancel_subscription"), [{ p_tenant_id: "tenant-1" }]);
    // O Mercado Pago vai primeiro: com o banco na frente e o provedor falhando, a barbearia ficaria cancelada e cobrada.
    assertEquals(canceladaNoProvedorAntesDoBanco, true);
    assertEquals(provider.charges.length, 0);
    assertEquals(provider.changedAmounts.length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("cancelar: com o pagamento recusado tambem cancela, para o Mercado Pago deixar de tentar a cobranca", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDoCancelamento(comSituacao("past_due"));
  try {
    const res = await createHandler({ provider })(cancelar());

    assertEquals(res.status, 200);
    assertEquals(provider.cancelledSubscriptions, ["mp-sub-1"]);
    assertEquals(supabase.rpcCalls("cancel_subscription").length, 1);
  } finally {
    supabase.restore();
  }
});

Deno.test("cancelar: em teste com o cartao autorizado no Mercado Pago, cancela a cobranca do fim do teste", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDoCancelamento({
    ...comSituacao("trialing"),
    "rest/v1/rpc/cancel_subscription": { status: 200, body: "trial_canceled" },
  });
  try {
    const res = await createHandler({ provider })(cancelar());

    assertEquals(res.status, 200);
    assertEquals(await res.json(), { canceled: true });
    assertEquals(provider.cancelledSubscriptions, ["mp-sub-1"]);
  } finally {
    supabase.restore();
  }
});

Deno.test("cancelar: em teste sem assinatura no Mercado Pago nao ha o que cancelar (409) e nada e chamado", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDoCancelamento(comSituacao("trialing", { mp_subscription_id: null }));
  try {
    const res = await createHandler({ provider })(cancelar());

    assertEquals(res.status, 409);
    assertEquals((await res.json()).error.includes("não há assinatura"), true);
    assertEquals(provider.cancelledSubscriptions.length, 0);
    assertEquals(supabase.rpcCalls("cancel_subscription").length, 0);
  } finally {
    supabase.restore();
  }
});

for (
  const [status, trecho] of [
    ["canceled", "já está cancelada"],
    ["blocked", "bloqueado"],
    ["courtesy", "cortesia"],
  ] as const
) {
  Deno.test(`cancelar: assinatura ${status} responde 409 com o motivo e nada e chamado`, async () => {
    const provider = new FakePaymentProvider();
    const supabase = supabaseDoCancelamento(comSituacao(status));
    try {
      const res = await createHandler({ provider })(cancelar());
      const corpo = await res.json();

      assertEquals(res.status, 409);
      assertEquals(String(corpo.error).includes(trecho), true, corpo.error);
      assertEquals(provider.cancelledSubscriptions.length, 0);
      assertEquals(supabase.rpcCalls("cancel_subscription").length, 0);
    } finally {
      supabase.restore();
    }
  });
}

Deno.test("cancelar: ativa sem assinatura no Mercado Pago (dado fora do normal) so grava no banco", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDoCancelamento(comSituacao("active", { mp_subscription_id: null }));
  try {
    const res = await createHandler({ provider })(cancelar());

    assertEquals(res.status, 200);
    assertEquals(provider.cancelledSubscriptions.length, 0);
    assertEquals(supabase.rpcCalls("cancel_subscription").length, 1);
  } finally {
    supabase.restore();
  }
});

// Quando o pedido ao Mercado Pago falha, a funcao confere o que a assinatura tem la antes de decidir: o pedido pode ter
// cancelado e a resposta se perdido (timeout), ou o Mercado Pago pode recusar cancelar o que ja esta cancelado.
Deno.test("cancelar: o Mercado Pago falha e a assinatura segue ativa la: 502, nada e gravado e o Gerente pode tentar de novo", async () => {
  const provider = new FakePaymentProvider();
  provider.failCancelWith = new PaymentProviderError("Mercado Pago respondeu 503: unavailable", 503);
  provider.subscriptions.set("mp-sub-1", aAssinaturaNoMercadoPago("authorized"));
  const supabase = supabaseDoCancelamento();
  const logs = capturarLogs();
  try {
    const res = await createHandler({ provider })(cancelar());
    const corpo = await res.json();

    assertEquals(res.status, 502);
    assertEquals(corpo.error.includes("Tente de novo"), true, corpo.error);
    assertEquals(provider.requestedSubscriptions, ["mp-sub-1"]);
    assertEquals(supabase.rpcCalls("cancel_subscription").length, 0);
    assertEquals(logs.linhas.some((linha) => linha.includes("tenant-1")), true, logs.linhas.join("\n"));
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

Deno.test("cancelar: o Mercado Pago falha mas a assinatura ja esta cancelada la (a resposta se perdeu, ou ela ja estava): grava e responde que cancelou", async () => {
  for (const falha of [new PaymentProviderError("Mercado Pago respondeu 504: gateway timeout", 504), new PaymentProviderError("Mercado Pago respondeu 400: already cancelled", 400)]) {
    const provider = new FakePaymentProvider();
    provider.failCancelWith = falha;
    provider.subscriptions.set("mp-sub-1", aAssinaturaNoMercadoPago("cancelled"));
    const supabase = supabaseDoCancelamento();
    const logs = capturarLogs();
    try {
      const res = await createHandler({ provider })(cancelar());

      assertEquals(res.status, 200, `${falha.status}`);
      assertEquals((await res.json()).canceled, true);
      assertEquals(supabase.rpcCalls("cancel_subscription"), [{ p_tenant_id: "tenant-1" }]);
    } finally {
      logs.restaurar();
      supabase.restore();
    }
  }
});

Deno.test("cancelar: o Mercado Pago falha e nao da para conferir a assinatura: 502, nada e gravado e o log diz o que conferir", async () => {
  const provider = new FakePaymentProvider();
  provider.failCancelWith = new PaymentProviderError("Mercado Pago nao respondeu a tempo");
  // Sem a assinatura no provedor falso, a conferencia tambem falha (404).
  const supabase = supabaseDoCancelamento();
  const logs = capturarLogs();
  try {
    const res = await createHandler({ provider })(cancelar());

    assertEquals(res.status, 502);
    assertEquals(supabase.rpcCalls("cancel_subscription").length, 0);
    assertEquals(logs.linhas.some((linha) => linha.includes("tenant-1") && linha.includes("confira")), true, logs.linhas.join("\n"));
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

Deno.test("cancelar: cancelou no Mercado Pago mas o banco nao gravou: 500 que diz que foi cancelada e o log diz qual barbearia conferir", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDoCancelamento({
    "rest/v1/rpc/cancel_subscription": { status: 500, body: { code: "XX000", message: "falha" } },
  });
  const logs = capturarLogs();
  try {
    const res = await createHandler({ provider })(cancelar());
    const corpo = await res.json();

    assertEquals(res.status, 500);
    assertEquals(corpo.error.includes("foi cancelada no Mercado Pago"), true, corpo.error);
    assertEquals(provider.cancelledSubscriptions, ["mp-sub-1"]);
    assertEquals(logs.linhas.some((linha) => linha.includes("tenant-1")), true, logs.linhas.join("\n"));
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});

Deno.test("cancelar: quem nao e Gerente do tenant recebe 403 e nada e chamado", async () => {
  const provider = new FakePaymentProvider();
  const supabase = supabaseDoCancelamento({ "rest/v1/rpc/get_billing_context": { status: 200, body: [] } });
  try {
    const res = await createHandler({ provider })(cancelar());

    assertEquals(res.status, 403);
    assertEquals(provider.cancelledSubscriptions.length, 0);
    assertEquals(supabase.rpcCalls("cancel_subscription").length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("cancelar: sem o token do Mercado Pago configurado nao tenta e o Gerente recebe o erro de cobranca indisponivel", async () => {
  Deno.env.delete("MP_ACCESS_TOKEN");
  const supabase = supabaseDoCancelamento();
  const logs = capturarLogs();
  try {
    const res = await createHandler()(cancelar());

    assertEquals(res.status, 500);
    assertEquals((await res.json()).error, "Cobrança indisponível.");
    assertEquals(logs.linhas.some((linha) => linha.includes("MP_ACCESS_TOKEN")), true, logs.linhas.join("\n"));
    assertEquals(supabase.rpcCalls("cancel_subscription").length, 0);
  } finally {
    logs.restaurar();
    supabase.restore();
  }
});
