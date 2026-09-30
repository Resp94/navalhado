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

/**
 * Versao falsa do provedor de pagamento, para os testes. Guarda o que recebeu e devolve o que o
 * teste preparou. Nao fala com rede nenhuma.
 */
export class FakePaymentProvider implements PaymentProvider {
  readonly createdSubscriptions: CreateSubscriptionInput[] = [];
  readonly requestedPayments: string[] = [];
  readonly requestedSubscriptions: string[] = [];
  readonly changedCards: Array<{ subscriptionId: string; cardToken: string }> = [];

  payments = new Map<string, ProviderPayment>();
  subscriptions = new Map<string, ProviderSubscription>();
  /** Faz a proxima chamada de cada operacao falhar. */
  failWith: Error | null = null;
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

  changeAmount = notImplementedOperations.changeAmount;
  cancelSubscription = notImplementedOperations.cancelSubscription;
  chargeOnce = notImplementedOperations.chargeOnce;
}
