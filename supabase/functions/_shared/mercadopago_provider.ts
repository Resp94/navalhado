import {
  type ChangedCard,
  type CreatedSubscription,
  type CreateSubscriptionInput,
  notImplementedOperations,
  type PaymentProvider,
  PaymentProviderError,
  type ProviderPayment,
  type ProviderSubscription,
} from "./payment_provider.ts";

export interface MercadoPagoProviderOptions {
  /** Access Token do app do Mercado Pago. Vem so de secret do Supabase; nunca do front. */
  accessToken: string;
  fetchFn?: typeof fetch;
  baseUrl?: string;
}

type MercadoPagoBody = Record<string, unknown>;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" ? String(value) : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const asDate = (value: unknown): Date | undefined => {
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const asRecord = (value: unknown): MercadoPagoBody =>
  value && typeof value === "object" && !Array.isArray(value) ? value as MercadoPagoBody : {};

export const createMercadoPagoProvider = ({
  accessToken,
  fetchFn = fetch,
  baseUrl = "https://api.mercadopago.com",
}: MercadoPagoProviderOptions): PaymentProvider => {
  const request = async (
    method: "GET" | "POST" | "PUT",
    path: string,
    body?: MercadoPagoBody,
    idempotencyKey?: string,
  ): Promise<MercadoPagoBody> => {
    let response: Response;
    try {
      response = await fetchFn(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new PaymentProviderError("Não foi possível falar com o Mercado Pago.");
    }

    let parsed: MercadoPagoBody = {};
    try {
      parsed = asRecord(await response.json());
    } catch {
      // Corpo vazio ou nao JSON: vale so o status.
    }

    if (!response.ok) {
      const detail = asString(parsed.message) ?? asString(parsed.error) ?? "recusado";
      throw new PaymentProviderError(`Mercado Pago respondeu ${response.status}: ${detail}`, response.status);
    }
    return parsed;
  };

  return {
    ...notImplementedOperations,

    async createSubscription(input: CreateSubscriptionInput): Promise<CreatedSubscription> {
      const body = await request("POST", "/preapproval", {
        reason: input.reason,
        external_reference: input.externalReference,
        payer_email: input.payerEmail,
        back_url: input.backUrl,
        status: "pending",
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: input.amount,
          currency_id: "BRL",
          ...(input.startDate ? { start_date: input.startDate.toISOString() } : {}),
        },
      }, input.idempotencyKey);

      const id = asString(body.id);
      const paymentLink = asString(body.init_point);
      if (!id || !paymentLink) {
        throw new PaymentProviderError("O Mercado Pago não devolveu a assinatura nem o link de pagamento.");
      }
      return { id, status: asString(body.status) ?? "pending", paymentLink };
    },

    // So o token vai para o Mercado Pago: o numero do cartao nunca passa por aqui. A troca nao cobra
    // nada; a proxima cobranca (ou a nova tentativa de uma cobranca recusada) sai no cartao novo.
    async changeCard(subscriptionId: string, cardToken: string): Promise<ChangedCard> {
      const body = await request("PUT", `/preapproval/${encodeURIComponent(subscriptionId)}`, { card_token_id: cardToken });
      const card = asRecord(body.card);
      return {
        cardBrand: asString(body.payment_method_id),
        cardLast4: asString(body.last_four_digits) ?? asString(card.last_four_digits),
      };
    },

    async getSubscription(subscriptionId: string): Promise<ProviderSubscription> {
      const body = await request("GET", `/preapproval/${encodeURIComponent(subscriptionId)}`);
      const autoRecurring = asRecord(body.auto_recurring);
      const card = asRecord(body.card);
      return {
        id: asString(body.id) ?? subscriptionId,
        status: asString(body.status) ?? "unknown",
        externalReference: asString(body.external_reference),
        amount: asNumber(autoRecurring.transaction_amount),
        cardBrand: asString(body.payment_method_id),
        cardLast4: asString(body.last_four_digits) ?? asString(card.last_four_digits),
        nextPaymentAt: asDate(body.next_payment_date),
      };
    },

    async getPayment(paymentId: string): Promise<ProviderPayment> {
      const body = await request("GET", `/v1/payments/${encodeURIComponent(paymentId)}`);
      const metadata = asRecord(body.metadata);
      const card = asRecord(body.card);
      return {
        id: asString(body.id) ?? paymentId,
        status: asString(body.status) ?? "unknown",
        amount: asNumber(body.transaction_amount) ?? 0,
        createdAt: asDate(body.date_created) ?? new Date(),
        approvedAt: asDate(body.date_approved),
        externalReference: asString(body.external_reference),
        subscriptionId: asString(metadata.preapproval_id) ?? asString(body.preapproval_id),
        cardBrand: asString(body.payment_method_id),
        cardLast4: asString(card.last_four_digits),
        kind: metadata.kind === "upgrade" ? "upgrade" : "recurring",
        operationType: asString(body.operation_type),
      };
    },
  };
};
