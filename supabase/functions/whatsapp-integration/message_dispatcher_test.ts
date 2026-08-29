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
  const rows = new Map<string, { status: "processing" | "succeeded" | "failed"; attempts: number }>();
  const ledger: MessageLedger = {
    reserve: async ({ idempotencyKey }) => {
      const existing = rows.get(idempotencyKey);
      if (existing) return { reserved: false, ...existing };
      rows.set(idempotencyKey, { status: "processing", attempts: 1 });
      return { reserved: true, status: "processing", attempts: 1 };
    },
    finalize: async ({ idempotencyKey, status, attempts }) => {
      rows.set(idempotencyKey, { status, attempts });
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

  assertEquals(duplicate, { status: "duplicate", attempts: 1 });
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

  assertEquals(rows.get(event.idempotencyKey), { status: "failed", attempts: 1 });
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
