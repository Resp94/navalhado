import type { ProviderSendTextInput, WhatsAppProvider } from "./whatsapp_provider.ts";

export interface NormalizedMessageEvent {
  tenantId: string;
  eventType: string;
  instanceName: string;
  instanceToken: string;
  recipientNumber: string;
  template: string;
  fallbackTemplate?: string;
  variables: Record<string, string | undefined>;
  text?: string;
  idempotencyKey: string;
  correlationId?: string;
  aggregateId?: string;
  instanceId?: string;
  appointmentId?: string | null;
  reminderWindow?: string;
  direction?: "inbound" | "outbound";
  isFirstMessageOfDay?: boolean;
  clientAccessLink?: string;
}

export interface MessageReservation {
  reserved: boolean;
  status: "processing" | "succeeded" | "failed";
  attempts: number;
}

export interface MessageLedger {
  reserve(input: {
    tenantId: string;
    eventType: string;
    idempotencyKey: string;
    instanceId?: string;
    appointmentId?: string | null;
    reminderWindow?: string;
    direction?: "inbound" | "outbound";
  }): Promise<MessageReservation>;
  finalize(input: {
    tenantId: string;
    eventType: string;
    idempotencyKey: string;
    status: "succeeded" | "failed";
    attempts: number;
    errorMessage?: string;
    appointmentId?: string | null;
    reminderWindow?: string;
    direction?: "inbound" | "outbound";
  }): Promise<void>;
}

export interface MessageDispatcherDependencies {
  provider: Pick<WhatsAppProvider, "sendText">;
  ledger: MessageLedger;
  sleep?: (milliseconds: number) => Promise<void>;
  maxAttempts?: number;
  renderTemplate?: (event: NormalizedMessageEvent) => string;
  onEvent?: (record: MessageDispatchObservation) => void;
}

export interface MessageDispatchObservation {
  correlationId: string;
  tenantId: string;
  eventType: string;
  aggregateId?: string;
  attempt: number;
  status: "sent" | "duplicate" | "failed";
  providerStatus?: number;
  durationMs: number;
}

export interface MessageDispatchResult {
  status: "sent" | "duplicate";
  attempts: number;
  existingStatus?: MessageReservation["status"];
}

export class MessageDispatchError extends Error {
  constructor(
    message: string,
    readonly attempts: number,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "MessageDispatchError";
  }
}

const errorStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== "object") return undefined;
  const status = Number((error as { status?: unknown }).status);
  return Number.isFinite(status) && status > 0 ? status : undefined;
};

const isRetryable = (error: unknown): boolean => {
  const status = errorStatus(error);
  return status === undefined || status === 429 || status >= 500;
};

export interface MessageRetryOptions {
  sleep?: (milliseconds: number) => Promise<void>;
  maxAttempts?: number;
}

export const sendWithRetry = async (
  provider: Pick<WhatsAppProvider, "sendText">,
  input: ProviderSendTextInput,
  initialAttempt = 1,
  options: MessageRetryOptions = {},
): Promise<number> => {
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  let backoffMs = 250;

  for (let attempt = Math.max(1, initialAttempt); attempt <= maxAttempts; attempt++) {
    try {
      await provider.sendText(input);
      return attempt;
    } catch (error) {
      if (!isRetryable(error) || attempt >= maxAttempts) {
        if (error && typeof error === "object") {
          (error as { attempts?: number }).attempts = attempt;
        }
        throw error;
      }

      const retryAfterMs = Number((error as { retryAfterMs?: unknown })?.retryAfterMs) || 0;
      await sleep(Math.min(Math.max(backoffMs, retryAfterMs), 60_000));
      backoffMs *= 2;
    }
  }

  throw new Error("WhatsApp provider request failed");
};

export const createMessageDispatcher = ({
  provider,
  ledger,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  maxAttempts = 3,
  renderTemplate,
  onEvent,
}: MessageDispatcherDependencies) => async (
  event: NormalizedMessageEvent,
): Promise<MessageDispatchResult> => {
  const reservation = await ledger.reserve({
    tenantId: event.tenantId,
    eventType: event.eventType,
    idempotencyKey: event.idempotencyKey,
    instanceId: event.instanceId,
    appointmentId: event.appointmentId,
    reminderWindow: event.reminderWindow,
    direction: event.direction,
  });

  const startedAt = Date.now();
  const correlationId = event.correlationId || crypto.randomUUID();
  const observe = (record: Omit<MessageDispatchObservation, "correlationId" | "tenantId" | "eventType" | "durationMs">) => {
    onEvent?.({
      correlationId,
      tenantId: event.tenantId,
      eventType: event.eventType,
      durationMs: Date.now() - startedAt,
      ...record,
    });
  };

  if (!reservation.reserved) {
    observe({ aggregateId: event.aggregateId, attempt: reservation.attempts, status: "duplicate" });
    return { status: "duplicate", attempts: reservation.attempts, existingStatus: reservation.status };
  }

  const attempts = Math.max(1, reservation.attempts);
  try {
    const template = event.template.trim().length > 0 ? event.template : (event.fallbackTemplate ?? event.template);
    const text = event.text ?? renderTemplate?.({ ...event, template }) ?? template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
      const value = event.variables[key.toLowerCase()];
      if (value === undefined) throw new Error(`Template rendering failed: unresolved token ${key}`);
      return value;
    });
    const completedAttempts = await sendWithRetry(provider, {
      instanceName: event.instanceName,
      instanceToken: event.instanceToken,
      number: event.recipientNumber,
      text,
      idempotencyKey: event.idempotencyKey,
    }, attempts, { sleep, maxAttempts });
    await ledger.finalize({
      tenantId: event.tenantId,
      eventType: event.eventType,
      idempotencyKey: event.idempotencyKey,
      appointmentId: event.appointmentId,
      reminderWindow: event.reminderWindow,
      direction: event.direction,
      status: "succeeded",
      attempts: completedAttempts,
    });
    observe({ aggregateId: event.aggregateId, attempt: completedAttempts, status: "sent" });
    return { status: "sent", attempts: completedAttempts };
  } catch (error) {
    const failedAttempts = Number((error as { attempts?: unknown })?.attempts ?? attempts);
    const providerStatus = errorStatus(error);
    const providerMessage = error instanceof Error ? error.message : "provider request failed";
    const isPermanentProviderFailure = providerStatus !== undefined &&
      providerStatus >= 400 && providerStatus < 500 && providerStatus !== 429;
    const errorMessage = isPermanentProviderFailure
      ? `permanent provider error: ${providerMessage}`
      : providerMessage;
    await ledger.finalize({
      tenantId: event.tenantId,
      eventType: event.eventType,
      idempotencyKey: event.idempotencyKey,
      appointmentId: event.appointmentId,
      reminderWindow: event.reminderWindow,
      direction: event.direction,
      status: "failed",
      attempts: failedAttempts,
      errorMessage,
    });
    observe({
      aggregateId: event.aggregateId,
      attempt: failedAttempts,
      status: "failed",
      providerStatus,
    });
    throw new MessageDispatchError("Message delivery failed", failedAttempts, error);
  }
};
