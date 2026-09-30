// Provedor de pagamento da assinatura do Navalhado (spec 052).
//
// O acesso ao Mercado Pago fica atras desta interface, no mesmo padrao do provedor de WhatsApp:
// a Edge Function de cobranca e o webhook so falam com ela, e os testes usam a versao falsa
// (fake_payment_provider.ts). Trocar o Mercado Pago por outro provedor (o plano B e o Asaas)
// nao mexe no resto.

export interface CreateSubscriptionInput {
  /** Texto que o pagador ve na pagina do provedor. */
  reason: string;
  payerEmail: string;
  /** Valor mensal em reais. */
  amount: number;
  /** Id do tenant: e como o aviso do provedor volta para a barbearia certa. */
  externalReference: string;
  /** Data da primeira cobranca. Ausente: cobra na hora. */
  startDate?: Date;
  /** Para onde o provedor devolve o Gerente depois do pagamento. */
  backUrl: string;
  idempotencyKey?: string;
}

export interface CreatedSubscription {
  id: string;
  status: string;
  /** Link da pagina de pagamento do provedor. */
  paymentLink: string;
}

export interface ProviderSubscription {
  id: string;
  status: string;
  externalReference?: string;
  amount?: number;
  /** Bandeira (payment_method_id). O final do cartao so vem no pagamento, nao na assinatura. */
  cardBrand?: string;
  cardLast4?: string;
  /** Data da proxima cobranca que o provedor calculou. Pode ser depois do fim do teste (dias inteiros). */
  nextPaymentAt?: Date;
}

export interface ProviderPayment {
  id: string;
  status: string;
  amount: number;
  createdAt: Date;
  approvedAt?: Date;
  externalReference?: string;
  /** Id da assinatura no provedor, quando o pagamento e de uma mensalidade. */
  subscriptionId?: string;
  cardBrand?: string;
  cardLast4?: string;
  /** recurring: mensalidade. upgrade: cobranca avulsa da diferenca de plano (ticket 10). */
  kind: "recurring" | "upgrade";
  /** Tipo da operacao no provedor. card_validation: validacao do cartao, valor 0, nao e cobranca. */
  operationType?: string;
}

/** O cartao que a assinatura passou a usar depois da troca. O que o provedor nao devolve fica vazio. */
export interface ChangedCard {
  cardBrand?: string;
  cardLast4?: string;
}

export interface ChargeOnceInput {
  amount: number;
  cardToken: string;
  payerEmail: string;
  description: string;
  externalReference: string;
  idempotencyKey: string;
}

export interface PaymentProvider {
  createSubscription(input: CreateSubscriptionInput): Promise<CreatedSubscription>;
  getSubscription(subscriptionId: string): Promise<ProviderSubscription>;
  getPayment(paymentId: string): Promise<ProviderPayment>;
  /** Troca o cartao da assinatura pelo token gerado no navegador (campos seguros). Nao cobra nada. */
  changeCard(subscriptionId: string, cardToken: string): Promise<ChangedCard>;
  // Os tres abaixo so existem de verdade nos tickets 10 a 12 da spec 052.
  changeAmount(subscriptionId: string, amount: number): Promise<void>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  chargeOnce(input: ChargeOnceInput): Promise<ProviderPayment>;
}

/** Falha do provedor. A mensagem nunca carrega token nem dado do pagador. */
export class PaymentProviderError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "PaymentProviderError";
  }
}

/** Operacao declarada na interface e ainda nao construida nesta fatia. */
export class PaymentProviderNotImplementedError extends Error {
  constructor(operation: string) {
    super(`Operação do provedor de pagamento ainda não implementada: ${operation}`);
    this.name = "PaymentProviderNotImplementedError";
  }
}

/**
 * As tres operacoes que so existem de verdade nos tickets 10 a 12 da spec 052. A versao real e a
 * falsa usam esta definicao unica: ao construir cada uma, sai daqui e ganha corpo nas duas.
 */
export const notImplementedOperations: Pick<
  PaymentProvider,
  "changeAmount" | "cancelSubscription" | "chargeOnce"
> = {
  changeAmount: () => Promise.reject(new PaymentProviderNotImplementedError("changeAmount")),
  cancelSubscription: () => Promise.reject(new PaymentProviderNotImplementedError("cancelSubscription")),
  chargeOnce: () => Promise.reject(new PaymentProviderNotImplementedError("chargeOnce")),
};
