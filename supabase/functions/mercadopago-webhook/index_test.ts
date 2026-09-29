import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createHandler } from "./index.ts";
import { FakePaymentProvider } from "../_shared/fake_payment_provider.ts";
import { PaymentProviderError, type ProviderPayment } from "../_shared/payment_provider.ts";

Deno.env.set("SUPABASE_URL", "https://mock-supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");

// Spec 052, ticket 05: webhook do Mercado Pago. O provedor e o falso; o Supabase e simulado no
// nivel do fetch. Cada aviso e conferido pela assinatura secreta, gravado com chave unica e
// decidido pelo que o provedor responde, nunca pelo corpo do aviso.

const SECRET = "webhook-secret-de-teste";
const TENANT_ID = "6f1c2a3e-1111-4222-8333-444455556666";

type Call = { url: string; body: unknown };
type Mock = { status: number; body: unknown };

const approvedPayment: ProviderPayment = {
  id: "111",
  status: "approved",
  amount: 89.9,
  createdAt: new Date("2026-10-14T15:00:01.000Z"),
  approvedAt: new Date("2026-10-14T15:00:03.000Z"),
  externalReference: TENANT_ID,
  subscriptionId: "pre-123",
  cardBrand: "visa",
  cardLast4: "5682",
  kind: "recurring",
};

const setupSupabase = (overrides: Record<string, Mock> = {}) => {
  const original = globalThis.fetch;
  const calls: Call[] = [];
  const mocks: Record<string, Mock> = {
    "rest/v1/rpc/record_billing_event": { status: 200, body: "new" },
    "rest/v1/rpc/finish_billing_event": { status: 200, body: null },
    "rest/v1/rpc/get_tenant_by_mp_subscription": { status: 200, body: TENANT_ID },
    "rest/v1/rpc/apply_subscription_payment": { status: 200, body: "activated" },
    "rest/v1/rpc/record_subscription_authorization": { status: 200, body: true },
    ...overrides,
  };

  globalThis.fetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined });
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

const hmacHex = async (secret: string, message: string): Promise<string> => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

interface NotificationOptions {
  type?: string;
  action?: string;
  notificationId?: number;
  dataId?: string;
  /** Deixa o data.id fora da URL (o Mercado Pago tira do manifesto o que nao veio). */
  omitDataIdFromQuery?: boolean;
  secret?: string;
  requestId?: string;
  signed?: boolean;
  extraBody?: Record<string, unknown>;
}

const notification = async ({
  type = "payment",
  action = "payment.updated",
  notificationId = 98765,
  dataId = "111",
  omitDataIdFromQuery = false,
  secret = SECRET,
  requestId = "req-abc-123",
  signed = true,
  extraBody = {},
}: NotificationOptions = {}) => {
  const ts = "1760453000000";
  const manifest = `${omitDataIdFromQuery ? "" : `id:${dataId.toLowerCase()};`}request-id:${requestId};ts:${ts};`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (signed) {
    headers["x-signature"] = `ts=${ts},v1=${await hmacHex(secret, manifest)}`;
    headers["x-request-id"] = requestId;
  }
  const query = omitDataIdFromQuery ? `type=${type}` : `data.id=${encodeURIComponent(dataId)}&type=${type}`;
  return new Request(`https://mock-supabase.co/functions/v1/mercadopago-webhook?${query}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: notificationId, type, action, data: { id: dataId }, live_mode: true, ...extraBody }),
  });
};

const handlerWith = (provider: FakePaymentProvider) => createHandler({ provider, webhookSecret: SECRET });

Deno.test("an approved payment notification activates the subscription with the payment fetched from the provider", async () => {
  const provider = new FakePaymentProvider();
  provider.payments.set("111", approvedPayment);
  const supabase = setupSupabase();
  try {
    const res = await handlerWith(provider)(await notification());

    assertEquals(res.status, 200);
    assertEquals(await res.json(), { status: "processed" });
    assertEquals(provider.requestedPayments, ["111"]);
    assertEquals(supabase.rpcCalls("record_billing_event"), [{
      p_event_key: "mp:98765",
      p_topic: "payment",
      p_resource_id: "111",
      p_payload: { id: 98765, type: "payment", action: "payment.updated", data: { id: "111" }, live_mode: true },
    }]);
    assertEquals(supabase.rpcCalls("get_tenant_by_mp_subscription"), [{ p_mp_subscription_id: "pre-123" }]);
    assertEquals(supabase.rpcCalls("apply_subscription_payment"), [{
      p_tenant_id: TENANT_ID,
      p_mp_payment_id: "111",
      p_mp_subscription_id: "pre-123",
      p_status: "approved",
      p_amount: 89.9,
      p_charged_at: "2026-10-14T15:00:03.000Z",
      p_kind: "recurring",
      p_card_brand: "visa",
      p_card_last4: "5682",
    }]);
    assertEquals(supabase.rpcCalls("finish_billing_event"), [{
      p_event_key: "mp:98765",
      p_status: "processed",
      p_detail: "activated",
    }]);
  } finally {
    supabase.restore();
  }
});

Deno.test("a notification with an invalid signature is refused before anything is stored or fetched", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase();
  try {
    const res = await handlerWith(provider)(await notification({ secret: "outro-segredo" }));

    assertEquals(res.status, 401);
    assertEquals(supabase.calls.length, 0);
    assertEquals(provider.requestedPayments.length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("a notification without the signature headers is refused", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase();
  try {
    const res = await handlerWith(provider)(await notification({ signed: false }));

    assertEquals(res.status, 401);
    assertEquals(supabase.calls.length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("a signature made for another resource id is refused", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase();
  try {
    const genuine = await notification({ dataId: "111" });
    const forged = new Request("https://mock-supabase.co/functions/v1/mercadopago-webhook?data.id=999&type=payment", {
      method: "POST",
      headers: genuine.headers,
      body: await genuine.text(),
    });

    const res = await handlerWith(provider)(forged);

    assertEquals(res.status, 401);
    assertEquals(provider.requestedPayments.length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("without a configured secret the webhook refuses everything (fails closed)", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase();
  Deno.env.delete("MP_WEBHOOK_SECRET");
  try {
    const res = await createHandler({ provider })(await notification());

    assertEquals(res.status, 500);
    assertEquals(supabase.calls.length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("the data.id is lowercased in the signed manifest, as the Mercado Pago documents", async () => {
  const provider = new FakePaymentProvider();
  provider.payments.set("ABC123", { ...approvedPayment, id: "ABC123" });
  const supabase = setupSupabase();
  try {
    const res = await handlerWith(provider)(await notification({ dataId: "ABC123" }));

    assertEquals(res.status, 200);
    assertEquals(provider.requestedPayments, ["ABC123"]);
  } finally {
    supabase.restore();
  }
});

Deno.test("when data.id is not in the URL it leaves the manifest and is read from the body", async () => {
  const provider = new FakePaymentProvider();
  provider.payments.set("111", approvedPayment);
  const supabase = setupSupabase();
  try {
    const res = await handlerWith(provider)(await notification({ omitDataIdFromQuery: true }));

    assertEquals(res.status, 200);
    assertEquals(provider.requestedPayments, ["111"]);
  } finally {
    supabase.restore();
  }
});

Deno.test("a repeated notification is ignored without touching the provider or the subscription", async () => {
  const provider = new FakePaymentProvider();
  provider.payments.set("111", approvedPayment);
  const supabase = setupSupabase({ "rest/v1/rpc/record_billing_event": { status: 200, body: "duplicate" } });
  try {
    const res = await handlerWith(provider)(await notification());

    assertEquals(res.status, 200);
    assertEquals(await res.json(), { status: "duplicate" });
    assertEquals(provider.requestedPayments.length, 0);
    assertEquals(supabase.rpcCalls("apply_subscription_payment").length, 0);
    assertEquals(supabase.rpcCalls("finish_billing_event").length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("a notification that the provider redelivers after a failure is processed again", async () => {
  const provider = new FakePaymentProvider();
  provider.payments.set("111", approvedPayment);
  const supabase = setupSupabase({ "rest/v1/rpc/record_billing_event": { status: 200, body: "retry" } });
  try {
    const res = await handlerWith(provider)(await notification());

    assertEquals(res.status, 200);
    assertEquals(provider.requestedPayments, ["111"]);
    assertEquals(supabase.rpcCalls("apply_subscription_payment").length, 1);
  } finally {
    supabase.restore();
  }
});

Deno.test("the decision comes from the provider, not from what the notification body claims", async () => {
  const provider = new FakePaymentProvider();
  provider.payments.set("111", { ...approvedPayment, status: "rejected", approvedAt: undefined });
  const supabase = setupSupabase({ "rest/v1/rpc/apply_subscription_payment": { status: 200, body: "recorded" } });
  try {
    const res = await handlerWith(provider)(await notification({ extraBody: { status: "approved", transaction_amount: 1 } }));

    assertEquals(res.status, 200);
    const [applied] = supabase.rpcCalls("apply_subscription_payment") as Array<Record<string, unknown>>;
    assertEquals(applied.p_status, "rejected");
    assertEquals(applied.p_amount, 89.9);
    assertEquals(applied.p_charged_at, "2026-10-14T15:00:01.000Z");
  } finally {
    supabase.restore();
  }
});

Deno.test("a payment with no subscription id falls back to the tenant in the external reference", async () => {
  const provider = new FakePaymentProvider();
  provider.payments.set("111", { ...approvedPayment, subscriptionId: undefined });
  const supabase = setupSupabase();
  try {
    const res = await handlerWith(provider)(await notification());

    assertEquals(res.status, 200);
    assertEquals(supabase.rpcCalls("get_tenant_by_mp_subscription").length, 0);
    const [applied] = supabase.rpcCalls("apply_subscription_payment") as Array<Record<string, unknown>>;
    assertEquals(applied.p_tenant_id, TENANT_ID);
    assertEquals(applied.p_mp_subscription_id, null);
  } finally {
    supabase.restore();
  }
});

Deno.test("a payment that belongs to no tenant is stored and ignored, without failing the delivery", async () => {
  const provider = new FakePaymentProvider();
  provider.payments.set("111", { ...approvedPayment, subscriptionId: undefined, externalReference: "pedido-do-marketplace" });
  const supabase = setupSupabase();
  try {
    const res = await handlerWith(provider)(await notification());

    assertEquals(res.status, 200);
    assertEquals(await res.json(), { status: "ignored" });
    assertEquals(supabase.rpcCalls("apply_subscription_payment").length, 0);
    const [finished] = supabase.rpcCalls("finish_billing_event") as Array<Record<string, unknown>>;
    assertEquals(finished.p_status, "ignored");
    // O motivo guarda o que o Mercado Pago mandou (sem dado de cartao nem do pagador), para quem
    // investiga um aviso ignorado ver por que nao achou a barbearia.
    assertEquals(
      finished.p_detail,
      "pagamento sem barbearia conhecida (status=approved, valor=89.9, external_reference=pedido-do-marketplace, assinatura=-)",
    );
  } finally {
    supabase.restore();
  }
});

Deno.test("a payment of a subscription the database does not know is ignored", async () => {
  const provider = new FakePaymentProvider();
  provider.payments.set("111", { ...approvedPayment, externalReference: undefined });
  const supabase = setupSupabase({ "rest/v1/rpc/get_tenant_by_mp_subscription": { status: 200, body: null } });
  try {
    const res = await handlerWith(provider)(await notification());

    assertEquals(res.status, 200);
    assertEquals(await res.json(), { status: "ignored" });
    assertEquals(supabase.rpcCalls("apply_subscription_payment").length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("an outcome the database ignores (other subscription) is stored as ignored", async () => {
  const provider = new FakePaymentProvider();
  provider.payments.set("111", approvedPayment);
  const supabase = setupSupabase({ "rest/v1/rpc/apply_subscription_payment": { status: 200, body: "ignored_other_subscription" } });
  try {
    const res = await handlerWith(provider)(await notification());

    assertEquals(await res.json(), { status: "ignored" });
    assertEquals(supabase.rpcCalls("finish_billing_event"), [{
      p_event_key: "mp:98765",
      p_status: "ignored",
      p_detail: "ignored_other_subscription",
    }]);
  } finally {
    supabase.restore();
  }
});

Deno.test("a provider failure marks the event failed and answers 500 so the Mercado Pago redelivers", async () => {
  const provider = new FakePaymentProvider();
  provider.failWith = new PaymentProviderError("Mercado Pago respondeu 500: erro", 500);
  const supabase = setupSupabase();
  try {
    const res = await handlerWith(provider)(await notification());

    assertEquals(res.status, 500);
    assertEquals(supabase.rpcCalls("apply_subscription_payment").length, 0);
    const [finished] = supabase.rpcCalls("finish_billing_event") as Array<Record<string, unknown>>;
    assertEquals(finished.p_status, "failed");
  } finally {
    supabase.restore();
  }
});

Deno.test("a database failure while applying the payment marks the event failed and answers 500", async () => {
  const provider = new FakePaymentProvider();
  provider.payments.set("111", approvedPayment);
  const supabase = setupSupabase({ "rest/v1/rpc/apply_subscription_payment": { status: 500, body: { message: "boom" } } });
  try {
    const res = await handlerWith(provider)(await notification());

    assertEquals(res.status, 500);
    assertEquals((supabase.rpcCalls("finish_billing_event")[0] as Record<string, unknown>).p_status, "failed");
  } finally {
    supabase.restore();
  }
});

Deno.test("a failure to store the event answers 500 without fetching anything", async () => {
  const provider = new FakePaymentProvider();
  provider.payments.set("111", approvedPayment);
  const supabase = setupSupabase({ "rest/v1/rpc/record_billing_event": { status: 500, body: { message: "boom" } } });
  try {
    const res = await handlerWith(provider)(await notification());

    assertEquals(res.status, 500);
    assertEquals(provider.requestedPayments.length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("an authorized subscription stores the card shown to the manager and the real next charge date", async () => {
  const provider = new FakePaymentProvider();
  provider.subscriptions.set("pre-123", {
    id: "pre-123",
    status: "authorized",
    externalReference: TENANT_ID,
    cardBrand: "visa",
    cardLast4: "5682",
    nextPaymentAt: new Date("2026-10-14T23:11:28.000Z"),
  });
  const supabase = setupSupabase();
  try {
    const res = await handlerWith(provider)(await notification({
      type: "subscription_preapproval",
      action: "updated",
      dataId: "pre-123",
      notificationId: 555,
    }));

    assertEquals(res.status, 200);
    assertEquals(provider.requestedSubscriptions, ["pre-123"]);
    assertEquals(supabase.rpcCalls("record_subscription_authorization"), [{
      p_mp_subscription_id: "pre-123",
      p_card_brand: "visa",
      p_card_last4: "5682",
      p_next_payment_at: "2026-10-14T23:11:28.000Z",
    }]);
    assertEquals((supabase.rpcCalls("finish_billing_event")[0] as Record<string, unknown>).p_status, "processed");
  } finally {
    supabase.restore();
  }
});

// Formato real do Mercado Pago: a assinatura autorizada traz a bandeira, nao o final do cartao.
Deno.test("an authorized subscription without the card last digits still records the brand and the next charge date", async () => {
  const provider = new FakePaymentProvider();
  provider.subscriptions.set("pre-123", {
    id: "pre-123",
    status: "authorized",
    externalReference: TENANT_ID,
    cardBrand: "visa",
    nextPaymentAt: new Date("2026-10-14T23:11:28.000Z"),
  });
  const supabase = setupSupabase();
  try {
    const res = await handlerWith(provider)(await notification({
      type: "subscription_preapproval",
      action: "updated",
      dataId: "pre-123",
    }));

    assertEquals(await res.json(), { status: "processed" });
    assertEquals(supabase.rpcCalls("record_subscription_authorization"), [{
      p_mp_subscription_id: "pre-123",
      p_card_brand: "visa",
      p_card_last4: null,
      p_next_payment_at: "2026-10-14T23:11:28.000Z",
    }]);
  } finally {
    supabase.restore();
  }
});

// Formato real do Mercado Pago: ao autorizar a assinatura ele cria um pagamento de validacao do
// cartao, de valor 0, sem external_reference. Nao e cobranca e nao aponta para barbearia nenhuma.
Deno.test("the card validation payment that comes with the authorization is stored and ignored", async () => {
  const provider = new FakePaymentProvider();
  provider.payments.set("111", {
    ...approvedPayment,
    amount: 0,
    externalReference: undefined,
    subscriptionId: undefined,
    operationType: "card_validation",
  });
  const supabase = setupSupabase();
  try {
    const res = await handlerWith(provider)(await notification());

    assertEquals(await res.json(), { status: "ignored" });
    assertEquals(supabase.rpcCalls("apply_subscription_payment").length, 0);
    assertEquals(supabase.rpcCalls("get_tenant_by_mp_subscription").length, 0);
    assertEquals((supabase.rpcCalls("finish_billing_event")[0] as Record<string, unknown>).p_detail, "validação de cartão (sem cobrança)");
  } finally {
    supabase.restore();
  }
});

Deno.test("a subscription that is not authorized yet changes nothing", async () => {
  const provider = new FakePaymentProvider();
  provider.subscriptions.set("pre-123", { id: "pre-123", status: "pending", externalReference: TENANT_ID });
  const supabase = setupSupabase();
  try {
    const res = await handlerWith(provider)(await notification({
      type: "subscription_preapproval",
      action: "created",
      dataId: "pre-123",
    }));

    assertEquals(await res.json(), { status: "ignored" });
    assertEquals(supabase.rpcCalls("record_subscription_authorization").length, 0);
  } finally {
    supabase.restore();
  }
});

Deno.test("subscription payment notices and unknown topics are stored and ignored (the payment notice does the work)", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase();
  try {
    const handler = handlerWith(provider);

    const authorizedPayment = await handler(await notification({ type: "subscription_authorized_payment", dataId: "ap-1", notificationId: 1 }));
    const plan = await handler(await notification({ type: "subscription_preapproval_plan", dataId: "plan-1", notificationId: 2 }));

    assertEquals(await authorizedPayment.json(), { status: "ignored" });
    assertEquals(await plan.json(), { status: "ignored" });
    assertEquals(provider.requestedPayments.length, 0);
    assertEquals(provider.requestedSubscriptions.length, 0);
    assertEquals(supabase.rpcCalls("record_billing_event").length, 2);
  } finally {
    supabase.restore();
  }
});

Deno.test("the webhook only accepts POST", async () => {
  const provider = new FakePaymentProvider();
  const supabase = setupSupabase();
  try {
    const res = await handlerWith(provider)(new Request("https://mock-supabase.co/functions/v1/mercadopago-webhook", { method: "GET" }));

    assertEquals(res.status, 405);
  } finally {
    supabase.restore();
  }
});
