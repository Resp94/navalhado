import { assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  createMessageDispatcher,
  type MessageDispatchObservation,
  type MessageLedger,
  type NormalizedMessageEvent,
} from "./message_dispatcher.ts";
import { WhatsAppProviderError } from "./whatsapp_provider.ts";

const event: NormalizedMessageEvent = {
  tenantId: "tenant-1",
  eventType: "appointment_created",
  instanceName: "nav_tenant_1",
  instanceToken: "instance-token",
  recipientNumber: "5511999999999",
  template: "Mensagem de {cliente}",
  variables: { cliente: "teste" },
  text: "Mensagem de teste",
  idempotencyKey: "appointment:appointment-1:appointment_created",
  aggregateId: "appointment-1",
};

const createMemoryLedger = () => {
  const rows = new Map<string, { status: "processing" | "succeeded" | "failed"; attempts: number; errorMessage?: string }>();
  const ledger: MessageLedger = {
    reserve: async ({ idempotencyKey }) => {
      const existing = rows.get(idempotencyKey);
      if (existing) return { reserved: false, status: existing.status, attempts: existing.attempts };
      rows.set(idempotencyKey, { status: "processing", attempts: 1 });
      return { reserved: true, status: "processing", attempts: 1 };
    },
    finalize: async ({ idempotencyKey, status, attempts, errorMessage }) => {
      rows.set(idempotencyKey, errorMessage === undefined
        ? { status, attempts }
        : { status, attempts, errorMessage });
    },
  };
  return { ledger, rows };
};

Deno.test("dispatcher retries a transient provider error and finalizes success", async () => {
  const { ledger, rows } = createMemoryLedger();
  const sent: Array<{ number: string; idempotencyKey?: string }> = [];
  let providerAttempts = 0;
  const dispatcher = createMessageDispatcher({
    ledger,
    sleep: async () => {},
    provider: {
      sendText: async (input) => {
        sent.push(input);
        providerAttempts += 1;
        if (providerAttempts === 1) throw new WhatsAppProviderError("send text", 503);
      },
    },
  });

  const result = await dispatcher(event);

  assertEquals(result, { status: "sent", attempts: 2 });
  assertEquals(providerAttempts, 2);
  assertEquals(sent[0]?.idempotencyKey, event.idempotencyKey);
  assertEquals(rows.get(event.idempotencyKey), { status: "succeeded", attempts: 2 });
});

Deno.test("dispatcher retries a rate-limited provider error and finalizes success", async () => {
  const { ledger, rows } = createMemoryLedger();
  let providerAttempts = 0;
  const dispatcher = createMessageDispatcher({
    ledger,
    sleep: async () => {},
    provider: {
      sendText: async () => {
        providerAttempts += 1;
        if (providerAttempts === 1) throw new WhatsAppProviderError("send text", 429);
      },
    },
  });

  const result = await dispatcher({ ...event, idempotencyKey: "rate-limit-event" });

  assertEquals(result, { status: "sent", attempts: 2 });
  assertEquals(providerAttempts, 2);
  assertEquals(rows.get("rate-limit-event"), { status: "succeeded", attempts: 2 });
});

Deno.test("dispatcher skips a duplicate event without calling the provider", async () => {
  const { ledger } = createMemoryLedger();
  let providerCalls = 0;
  const dispatcher = createMessageDispatcher({
    ledger,
    provider: {
      sendText: async () => {
        providerCalls += 1;
      },
    },
  });

  await dispatcher(event);
  const duplicate = await dispatcher(event);

  assertEquals(duplicate, { status: "duplicate", attempts: 1, existingStatus: "succeeded" });
  assertEquals(providerCalls, 1);
});

Deno.test("dispatcher finalizes a permanent provider error as failed", async () => {
  const { ledger, rows } = createMemoryLedger();
  const dispatcher = createMessageDispatcher({
    ledger,
    sleep: async () => {},
    provider: {
      sendText: async () => {
        throw new WhatsAppProviderError("send text", 400);
      },
    },
  });

  await assertRejects(() => dispatcher(event), Error, "Message delivery failed");

  assertEquals(rows.get(event.idempotencyKey), {
    status: "failed",
    attempts: 1,
    errorMessage: "permanent provider error: WhatsApp provider send text failed with status 400",
  });
});

Deno.test("dispatcher records template rendering failures with the actionable cause", async () => {
  const { ledger, rows } = createMemoryLedger();
  const dispatcher = createMessageDispatcher({
    ledger,
    provider: { sendText: async () => {} },
  });

  await assertRejects(
    () => dispatcher({ ...event, text: undefined, template: "Olá {faltante}" }),
    Error,
    "Message delivery failed",
  );

  assertEquals(rows.get(event.idempotencyKey), {
    status: "failed",
    attempts: 1,
    errorMessage: "Template rendering failed: unresolved token faltante",
  });
});

Deno.test("dispatcher emits sanitized operational observations", async () => {
  const { ledger } = createMemoryLedger();
  const observations: MessageDispatchObservation[] = [];
  const dispatcher = createMessageDispatcher({
    ledger,
    sleep: async () => {},
    onEvent: (observation) => observations.push(observation),
    provider: { sendText: async () => {} },
  });

  await dispatcher({ ...event, correlationId: "corr-1" });

  assertEquals(observations.length, 1);
  assertEquals(observations[0], {
    correlationId: "corr-1",
    tenantId: "tenant-1",
    eventType: "appointment_created",
    aggregateId: "appointment-1",
    attempt: 1,
    status: "sent",
    durationMs: observations[0]?.durationMs,
  });
});

// Spec 052, ticket 04: o Estado de Acesso da barbearia manda em todo envio. Bloqueada, a
// mensagem nao chega ao provedor, fica registrada como descartada, com o motivo, e nao
// entra em fila nenhuma. Sem saber o estado, nao envia.
type DiscardInput = Parameters<NonNullable<MessageLedger["discard"]>>[0];

const createDiscardingLedger = () => {
  const { ledger, rows } = createMemoryLedger();
  const discards: DiscardInput[] = [];
  const reserves: string[] = [];
  const recordingLedger: MessageLedger = {
    reserve: async (input) => {
      reserves.push(input.idempotencyKey);
      return ledger.reserve(input);
    },
    finalize: ledger.finalize,
    discard: async (input) => {
      discards.push(input);
    },
  };
  return { ledger: recordingLedger, rows, discards, reserves };
};

Deno.test("dispatcher discards the message of a blocked tenant without calling the provider", async () => {
  const { ledger, discards, reserves } = createDiscardingLedger();
  let providerCalls = 0;
  const observations: MessageDispatchObservation[] = [];
  const dispatcher = createMessageDispatcher({
    ledger,
    accessGate: { check: async () => ({ allowed: false, reason: "trial_expired" }) },
    provider: { sendText: async () => { providerCalls += 1; } },
    onEvent: (record) => observations.push(record),
  });

  const result = await dispatcher({ ...event, appointmentId: "appointment-1" });

  assertEquals(result, { status: "discarded", attempts: 0, reason: "trial_expired" });
  assertEquals(providerCalls, 0);
  assertEquals(reserves, []);
  assertEquals(discards.length, 1);
  assertEquals(discards[0]?.tenantId, "tenant-1");
  assertEquals(discards[0]?.idempotencyKey, event.idempotencyKey);
  assertEquals(discards[0]?.eventType, "appointment_created");
  assertEquals(discards[0]?.appointmentId, "appointment-1");
  assertEquals(discards[0]?.reason, "trial_expired");
  assertEquals(observations.map((o) => o.status), ["discarded"]);
});

Deno.test("dispatcher passes the reminder window to the discard record", async () => {
  const { ledger, discards } = createDiscardingLedger();
  const dispatcher = createMessageDispatcher({
    ledger,
    accessGate: { check: async () => ({ allowed: false, reason: "payment_failed" }) },
    provider: { sendText: async () => {} },
  });

  await dispatcher({ ...event, eventType: "appointment_reminder", reminderWindow: "2h", idempotencyKey: "reminder-key" });

  assertEquals(discards[0]?.reminderWindow, "2h");
  assertEquals(discards[0]?.eventType, "appointment_reminder");
});

Deno.test("dispatcher asks the gate about the tenant of the event and sends when it is allowed", async () => {
  const { ledger, rows } = createDiscardingLedger();
  const asked: string[] = [];
  const sent: string[] = [];
  const dispatcher = createMessageDispatcher({
    ledger,
    accessGate: { check: async (tenantId) => { asked.push(tenantId); return { allowed: true }; } },
    provider: { sendText: async (input) => { sent.push(input.number); } },
  });

  const result = await dispatcher({ ...event, idempotencyKey: "allowed-key" });

  assertEquals(result, { status: "sent", attempts: 1 });
  assertEquals(asked, ["tenant-1"]);
  assertEquals(sent, ["5511999999999"]);
  assertEquals(rows.get("allowed-key"), { status: "succeeded", attempts: 1 });
});

Deno.test("dispatcher does not send when it cannot read the access state", async () => {
  const { ledger, discards, reserves } = createDiscardingLedger();
  let providerCalls = 0;
  const dispatcher = createMessageDispatcher({
    ledger,
    accessGate: { check: async () => { throw new Error("access state unavailable"); } },
    provider: { sendText: async () => { providerCalls += 1; } },
  });

  await assertRejects(() => dispatcher({ ...event, idempotencyKey: "unknown-state" }), Error, "access state unavailable");

  assertEquals(providerCalls, 0);
  assertEquals(reserves, []);
  assertEquals(discards, []);
});

Deno.test("dispatcher still discards a blocked tenant when the ledger has no discard record", async () => {
  const { ledger } = createMemoryLedger();
  let providerCalls = 0;
  const dispatcher = createMessageDispatcher({
    ledger,
    accessGate: { check: async () => ({ allowed: false, reason: "canceled" }) },
    provider: { sendText: async () => { providerCalls += 1; } },
  });

  assertEquals(await dispatcher(event), { status: "discarded", attempts: 0, reason: "canceled" });
  assertEquals(providerCalls, 0);
});

Deno.test("dispatcher without a gate keeps sending as before", async () => {
  const { ledger } = createMemoryLedger();
  let providerCalls = 0;
  const dispatcher = createMessageDispatcher({
    ledger,
    provider: { sendText: async () => { providerCalls += 1; } },
  });

  assertEquals(await dispatcher({ ...event, idempotencyKey: "no-gate" }), { status: "sent", attempts: 1 });
  assertEquals(providerCalls, 1);
});
