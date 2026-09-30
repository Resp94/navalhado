import {
  type ChangedCard,
  type ChargeOnceInput,
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
  /** Espera entre as tentativas de mudar o valor da assinatura. Os testes a trocam por uma que nao espera. */
  sleep?: (milliseconds: number) => Promise<void>;
}

type MercadoPagoBody = Record<string, unknown>;

// Mudar o valor da assinatura vai de novo quando o Mercado Pago limita o ritmo (429), cai (5xx) ou nao
// responde: o pedido so repete o mesmo valor, entao repeti-lo e seguro. A primeira tentativa mais duas,
// com pausas curtas para o Gerente nao esperar muito. Recusa do pedido (400, 401, 403, 404, 422) nao melhora
// com o tempo e sobe na hora.
const AMOUNT_CHANGE_RETRY_PAUSES_MS = [1000, 3000];

const isTransientFailure = (error: unknown): boolean =>
  error instanceof PaymentProviderError && (error.status === undefined || error.status === 429 || error.status >= 500);

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

// O pagamento como o Mercado Pago o devolve, na consulta e na criacao.
const toPayment = (body: MercadoPagoBody, fallbackId: string): ProviderPayment => {
  const metadata = asRecord(body.metadata);
  const card = asRecord(body.card);
  return {
    id: asString(body.id) ?? fallbackId,
    status: asString(body.status) ?? "unknown",
    statusDetail: asString(body.status_detail),
    amount: asNumber(body.transaction_amount) ?? 0,
    createdAt: asDate(body.date_created) ?? new Date(),
    approvedAt: asDate(body.date_approved),
    externalReference: asString(body.external_reference),
    subscriptionId: asString(metadata.preapproval_id) ?? asString(body.preapproval_id),
    cardBrand: asString(body.payment_method_id),
    cardLast4: asString(card.last_four_digits),
    kind: metadata.kind === "upgrade" ? "upgrade" : "recurring",
    planId: asString(metadata.plan_id),
    operationType: asString(body.operation_type),
  };
};

export const createMercadoPagoProvider = ({
  accessToken,
  fetchFn = fetch,
  baseUrl = "https://api.mercadopago.com",
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
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
      return toPayment(body, paymentId);
    },

    // O valor novo vale a partir da proxima cobranca: nada e cobrado na hora.
    async changeAmount(subscriptionId: string, amount: number): Promise<void> {
      for (let attempt = 0;; attempt++) {
        try {
          await request("PUT", `/preapproval/${encodeURIComponent(subscriptionId)}`, {
            auto_recurring: { transaction_amount: amount, currency_id: "BRL" },
          });
          return;
        } catch (error) {
          const pause = AMOUNT_CHANGE_RETRY_PAUSES_MS[attempt];
          if (pause === undefined || !isTransientFailure(error)) throw error;
          await sleep(pause);
        }
      }
    },

    // Cobranca avulsa no cartao do token (o numero do cartao nunca passa por aqui). O Mercado Pago
    // responde 201 tambem quando o cartao e recusado: a recusa vem no status do pagamento.
    async chargeOnce(input: ChargeOnceInput): Promise<ProviderPayment> {
      const body = await request("POST", "/v1/payments", {
        transaction_amount: input.amount,
        token: input.cardToken,
        description: input.description,
        installments: 1,
        payer: { email: input.payerEmail },
        external_reference: input.externalReference,
        metadata: { kind: input.kind, ...(input.planId ? { plan_id: input.planId } : {}) },
      }, input.idempotencyKey);
      return toPayment(body, "");
    },
  };
};
