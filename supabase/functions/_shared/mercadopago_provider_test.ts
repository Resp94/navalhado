import { assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createMercadoPagoProvider } from "./mercadopago_provider.ts";
import { PaymentProviderError, PaymentProviderNotImplementedError } from "./payment_provider.ts";

type Recorded = { url: string; method: string; headers: Record<string, string>; body: unknown };

const recordingFetch = (responses: Array<{ status: number; body: unknown }>) => {
  const calls: Recorded[] = [];
  let index = 0;
  const fetchFn = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({
      url,
      method: init?.method ?? "GET",
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });
    const next = responses[Math.min(index++, responses.length - 1)];
    return Promise.resolve(new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { "Content-Type": "application/json" },
    }));
  };
  return { calls, fetchFn };
};

const TOKEN = "APP_USR-secret-token";

Deno.test("mercadopago: createSubscription creates a pending preapproval with the first charge date", async () => {
  const { calls, fetchFn } = recordingFetch([{
    status: 201,
    body: { id: "pre-123", status: "pending", init_point: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=pre-123" },
  }]);
  const provider = createMercadoPagoProvider({ accessToken: TOKEN, fetchFn });

  const created = await provider.createSubscription({
    reason: "Navalhado - plano Máquina",
    payerEmail: "gerente@barbearia.test",
    amount: 89.9,
    externalReference: "tenant-1",
    startDate: new Date("2026-10-14T15:00:00.000Z"),
    backUrl: "https://dev.navalhado.com.br/configuracoes?assinatura=retorno",
    idempotencyKey: "idem-1",
  });

  assertEquals(created, {
    id: "pre-123",
    status: "pending",
    paymentLink: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=pre-123",
  });
  assertEquals(calls.length, 1);
  assertEquals(calls[0].url, "https://api.mercadopago.com/preapproval");
  assertEquals(calls[0].method, "POST");
  assertEquals(calls[0].headers["authorization"], `Bearer ${TOKEN}`);
  assertEquals(calls[0].headers["x-idempotency-key"], "idem-1");
  assertEquals(calls[0].body, {
    reason: "Navalhado - plano Máquina",
    external_reference: "tenant-1",
    payer_email: "gerente@barbearia.test",
    back_url: "https://dev.navalhado.com.br/configuracoes?assinatura=retorno",
    status: "pending",
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: 89.9,
      currency_id: "BRL",
      start_date: "2026-10-14T15:00:00.000Z",
    },
  });
});

Deno.test("mercadopago: createSubscription without a start date charges right away (no start_date sent)", async () => {
  const { calls, fetchFn } = recordingFetch([{ status: 201, body: { id: "pre-1", status: "pending", init_point: "https://mp.test/x" } }]);
  const provider = createMercadoPagoProvider({ accessToken: TOKEN, fetchFn });

  await provider.createSubscription({
    reason: "Navalhado - plano Tesoura",
    payerEmail: "g@b.test",
    amount: 59.9,
    externalReference: "tenant-2",
    backUrl: "https://dev.navalhado.com.br/configuracoes",
  });

  const autoRecurring = (calls[0].body as { auto_recurring: Record<string, unknown> }).auto_recurring;
  assertEquals("start_date" in autoRecurring, false);
});

Deno.test("mercadopago: a refusal from the provider becomes a PaymentProviderError without the token", async () => {
  const { fetchFn } = recordingFetch([{ status: 400, body: { message: "Invalid value for payer_email", error: "bad_request" } }]);
  const provider = createMercadoPagoProvider({ accessToken: TOKEN, fetchFn });

  const error = await assertRejects(
    () => provider.createSubscription({
      reason: "x",
      payerEmail: "g@b.test",
      amount: 10,
      externalReference: "t",
      backUrl: "https://a.test",
    }),
    PaymentProviderError,
  );

  assertEquals(error.status, 400);
  assertEquals(error.message.includes(TOKEN), false);
});

Deno.test("mercadopago: a network failure becomes a PaymentProviderError", async () => {
  const provider = createMercadoPagoProvider({
    accessToken: TOKEN,
    fetchFn: () => Promise.reject(new TypeError("connection reset")),
  });

  const error = await assertRejects(() => provider.getPayment("1"), PaymentProviderError);
  assertEquals(error.status, undefined);
});

Deno.test("mercadopago: getSubscription maps status, amount, the card brand and the real next charge date", async () => {
  const { calls, fetchFn } = recordingFetch([{
    status: 200,
    body: {
      id: "pre-9",
      status: "authorized",
      external_reference: "tenant-9",
      auto_recurring: { transaction_amount: 159.9 },
      payment_method_id: "master",
      last_four_digits: "5555",
      next_payment_date: "2026-10-14T19:11:28.000-04:00",
    },
  }]);
  const provider = createMercadoPagoProvider({ accessToken: TOKEN, fetchFn });

  assertEquals(await provider.getSubscription("pre-9"), {
    id: "pre-9",
    status: "authorized",
    externalReference: "tenant-9",
    amount: 159.9,
    cardBrand: "master",
    cardLast4: "5555",
    nextPaymentAt: new Date("2026-10-14T23:11:28.000Z"),
  });
  assertEquals(calls[0].url, "https://api.mercadopago.com/preapproval/pre-9");
  assertEquals(calls[0].method, "GET");
});

Deno.test("mercadopago: getPayment maps an approved subscription payment", async () => {
  const { calls, fetchFn } = recordingFetch([{
    status: 200,
    body: {
      id: 1352660205,
      status: "approved",
      transaction_amount: 89.9,
      date_created: "2026-10-14T15:00:01.000-04:00",
      date_approved: "2026-10-14T15:00:03.000-04:00",
      external_reference: "tenant-1",
      metadata: { preapproval_id: "pre-123" },
      payment_method_id: "visa",
      card: { last_four_digits: "5682" },
    },
  }]);
  const provider = createMercadoPagoProvider({ accessToken: TOKEN, fetchFn });

  const payment = await provider.getPayment("1352660205");

  assertEquals(payment.id, "1352660205");
  assertEquals(payment.status, "approved");
  assertEquals(payment.amount, 89.9);
  assertEquals(payment.createdAt.toISOString(), "2026-10-14T19:00:01.000Z");
  assertEquals(payment.approvedAt?.toISOString(), "2026-10-14T19:00:03.000Z");
  assertEquals(payment.externalReference, "tenant-1");
  assertEquals(payment.subscriptionId, "pre-123");
  assertEquals(payment.cardBrand, "visa");
  assertEquals(payment.cardLast4, "5682");
  assertEquals(payment.kind, "recurring");
  assertEquals(calls[0].url, "https://api.mercadopago.com/v1/payments/1352660205");
});

// Formato real observado no DEV (2026-09-29): a assinatura autorizada traz so a bandeira
// (payment_method_id) e um card_id; o final do cartao nao vem.
Deno.test("mercadopago: an authorized subscription without the card last digits keeps the brand and no last4", async () => {
  const { fetchFn } = recordingFetch([{
    status: 200,
    body: {
      id: "0296f4657d7a40fda65bc984e1f51820",
      status: "authorized",
      external_reference: "37855f6a-8bfe-4b62-bf45-081dcec62b95",
      card_id: "9861532859",
      payment_method_id: "visa",
      auto_recurring: { transaction_amount: 59.9, free_trial: { frequency: 15, frequency_type: "days" } },
      next_payment_date: "2026-10-14T19:11:28.000-04:00",
    },
  }]);
  const provider = createMercadoPagoProvider({ accessToken: TOKEN, fetchFn });

  const subscription = await provider.getSubscription("0296f4657d7a40fda65bc984e1f51820");

  assertEquals(subscription.cardBrand, "visa");
  assertEquals(subscription.cardLast4, undefined);
  assertEquals(subscription.nextPaymentAt?.toISOString(), "2026-10-14T23:11:28.000Z");
});

// Formato real observado no DEV: ao autorizar a assinatura o Mercado Pago cria um pagamento de
// validacao do cartao (valor 0, sem external_reference nem metadata), que nao e cobranca.
Deno.test("mercadopago: getPayment exposes the operation type, so a card validation is recognized", async () => {
  const { fetchFn } = recordingFetch([{
    status: 200,
    body: {
      id: 180528172811,
      status: "approved",
      operation_type: "card_validation",
      transaction_amount: 0,
      date_created: "2026-09-29T19:14:52.000-04:00",
      date_approved: "2026-09-29T19:14:53.000-04:00",
      external_reference: null,
      metadata: {},
      payment_method_id: "visa",
      card: { last_four_digits: "5682" },
    },
  }]);
  const provider = createMercadoPagoProvider({ accessToken: TOKEN, fetchFn });

  const payment = await provider.getPayment("180528172811");

  assertEquals(payment.operationType, "card_validation");
  assertEquals(payment.amount, 0);
  assertEquals(payment.externalReference, undefined);
});

Deno.test("mercadopago: a payment marked as upgrade in the metadata is an upgrade charge", async () => {
  const { fetchFn } = recordingFetch([{
    status: 200,
    body: {
      id: 55,
      status: "approved",
      transaction_amount: 10,
      date_created: "2026-10-14T15:00:01.000Z",
      external_reference: "tenant-1",
      metadata: { kind: "upgrade" },
    },
  }]);
  const provider = createMercadoPagoProvider({ accessToken: TOKEN, fetchFn });

  const payment = await provider.getPayment("55");

  assertEquals(payment.kind, "upgrade");
  assertEquals(payment.approvedAt, undefined);
  assertEquals(payment.subscriptionId, undefined);
});

Deno.test("mercadopago: the resource id is encoded in the URL path", async () => {
  const { calls, fetchFn } = recordingFetch([{ status: 200, body: { id: "x", status: "authorized" } }]);
  const provider = createMercadoPagoProvider({ accessToken: TOKEN, fetchFn });

  await provider.getSubscription("../../users/me");

  assertEquals(calls[0].url, "https://api.mercadopago.com/preapproval/..%2F..%2Fusers%2Fme");
});

Deno.test("mercadopago: operations of tickets 09 to 12 are declared but not built yet", async () => {
  const provider = createMercadoPagoProvider({ accessToken: TOKEN, fetchFn: () => Promise.reject(new Error("no network")) });

  await assertRejects(() => provider.changeCard("s", "tok"), PaymentProviderNotImplementedError);
  await assertRejects(() => provider.changeAmount("s", 10), PaymentProviderNotImplementedError);
  await assertRejects(() => provider.cancelSubscription("s"), PaymentProviderNotImplementedError);
  await assertRejects(
    () => provider.chargeOnce({
      amount: 1,
      cardToken: "t",
      payerEmail: "a@b.test",
      description: "d",
      externalReference: "r",
      idempotencyKey: "k",
    }),
    PaymentProviderNotImplementedError,
  );
});
