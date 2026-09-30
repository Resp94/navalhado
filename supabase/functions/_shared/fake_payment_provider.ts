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

/**
 * Versao falsa do provedor de pagamento, para os testes. Guarda o que recebeu e devolve o que o
 * teste preparou. Nao fala com rede nenhuma.
 */
export class FakePaymentProvider implements PaymentProvider {
  readonly createdSubscriptions: CreateSubscriptionInput[] = [];
  readonly requestedPayments: string[] = [];
  readonly requestedSubscriptions: string[] = [];
  readonly changedCards: Array<{ subscriptionId: string; cardToken: string }> = [];
  readonly changedAmounts: Array<{ subscriptionId: string; amount: number }> = [];
  readonly charges: ChargeOnceInput[] = [];

  payments = new Map<string, ProviderPayment>();
  subscriptions = new Map<string, ProviderSubscription>();
  /** Faz a proxima chamada de cada operacao falhar. */
  failWith: Error | null = null;
  /** Faz so a mudanca de valor da assinatura falhar: a cobranca avulsa e o resto seguem. */
  failAmountChangeWith: Error | null = null;
  /** O que muda no pagamento que a proxima cobranca avulsa devolve (aprovado, no valor cobrado, por padrao). */
  nextCharge: Partial<ProviderPayment> = {};
  nextChangedCard: ChangedCard = { cardBrand: "master", cardLast4: "5555" };
  nextSubscriptionId = "fake-sub-1";
  paymentLink = "https://provider.test/checkout/fake-sub-1";

  createSubscription(input: CreateSubscriptionInput): Promise<CreatedSubscription> {
    if (this.failWith) return Promise.reject(this.failWith);
    this.createdSubscriptions.push(input);
    return Promise.resolve({ id: this.nextSubscriptionId, status: "pending", paymentLink: this.paymentLink });
  }

  getSubscription(subscriptionId: string): Promise<ProviderSubscription> {
    this.requestedSubscriptions.push(subscriptionId);
    if (this.failWith) return Promise.reject(this.failWith);
    const found = this.subscriptions.get(subscriptionId);
    return found ? Promise.resolve(found) : Promise.reject(new PaymentProviderError("Assinatura não encontrada.", 404));
  }

  getPayment(paymentId: string): Promise<ProviderPayment> {
    this.requestedPayments.push(paymentId);
    if (this.failWith) return Promise.reject(this.failWith);
    const found = this.payments.get(paymentId);
    return found ? Promise.resolve(found) : Promise.reject(new PaymentProviderError("Pagamento não encontrado.", 404));
  }

  changeCard(subscriptionId: string, cardToken: string): Promise<ChangedCard> {
    if (this.failWith) return Promise.reject(this.failWith);
    this.changedCards.push({ subscriptionId, cardToken });
    return Promise.resolve({ ...this.nextChangedCard });
  }

  changeAmount(subscriptionId: string, amount: number): Promise<void> {
    if (this.failWith ?? this.failAmountChangeWith) return Promise.reject(this.failWith ?? this.failAmountChangeWith);
    this.changedAmounts.push({ subscriptionId, amount });
    return Promise.resolve();
  }

  chargeOnce(input: ChargeOnceInput): Promise<ProviderPayment> {
    if (this.failWith) return Promise.reject(this.failWith);
    this.charges.push(input);
    return Promise.resolve({
      id: "fake-pay-1",
      status: "approved",
      amount: input.amount,
      createdAt: new Date("2026-10-11T12:00:01.000Z"),
      approvedAt: new Date("2026-10-11T12:00:02.000Z"),
      externalReference: input.externalReference,
      cardBrand: "visa",
      cardLast4: "5682",
      kind: input.kind,
      ...this.nextCharge,
    });
  }

  cancelSubscription = notImplementedOperations.cancelSubscription;
}
