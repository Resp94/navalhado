// Cotacao de uma troca de plano (spec 052, ticket 10). Funcao pura: recebe o que o banco devolveu
// (get_plan_change_context) e a hora de agora e diz se a troca e possivel e quanto custa na hora.
//
// - Em teste a troca e livre (para cima e para baixo) e sem cobranca.
// - Na assinatura ativa, subir cobra a diferenca proporcional aos dias que faltam no periodo pago:
//   (preco novo - preco atual) x dias que faltam / dias do periodo, arredondada em centavos. A partir
//   da proxima cobranca vale o preco cheio do plano novo. Descer (ticket 11) nao cobra nem reembolsa nada:
//   o plano menor fica agendado e vale na proxima cobranca, isto e, no fim do periodo pago.
// - Diferenca abaixo do minimo que o provedor aceita: o plano troca sem cobranca avulsa.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Menor cobranca avulsa no cartao. A documentacao do Mercado Pago nao traz o piso do pagamento avulso;
 * R$ 1,00 fica acima de qualquer piso que se conhece, e o que sobra abaixo dele (no ultimo dia do
 * periodo, menos de R$ 1,00) o plano troca sem cobrar. Um piso abaixo do real faria a cobranca falhar
 * justo quando o Gerente quer subir de plano.
 */
export const MINIMUM_CHARGE = 1;

export interface PlanChangeInput {
  /** Situacao da assinatura: so "trialing" e "active" trocam de plano. */
  status: string;
  currentPlanId: string;
  currentPlanPrice: number;
  targetPlanId: string;
  targetPlanName: string;
  targetPlanPrice: number;
  targetMaxProfessionals: number;
  activeProfessionals: number;
  /** Periodo pago atual. Em teste nao existe, e a cotacao nao o usa. */
  periodStart: Date | null;
  periodEnd: Date | null;
  /** Plano da descida ja agendada, se houver (assinatura ativa). */
  scheduledPlanId: string | null;
  now: Date;
}

export type PlanChangeRefusalCode = "status" | "same_plan" | "same_price" | "already_scheduled" | "over_limit" | "no_period";

export type PlanChangeQuote =
  | {
    ok: true;
    /**
     * free: em teste, sem cobranca. charge: cobra a diferenca agora. no_charge: diferenca abaixo do minimo, troca sem
     * cobrar. scheduled: descida na assinatura ativa, sem cobranca, que vale na proxima cobranca (effectiveAt).
     */
    mode: "free" | "charge" | "no_charge" | "scheduled";
    /** Valor cobrado agora, em reais (zero quando nao ha cobranca). */
    difference: number;
    /** Valor mensal do plano novo, que vale a partir da proxima cobranca. */
    newMonthlyAmount: number;
    remainingDays: number | null;
    periodDays: number | null;
    /** Quando o plano menor passa a valer (so na descida agendada): o fim do periodo pago. */
    effectiveAt?: Date;
  }
  | { ok: false; code: PlanChangeRefusalCode; message: string };

const toCents = (amount: number): number => Math.round(amount * 100);

/**
 * A diferenca proporcional aos dias que faltam. Os dias que faltam sao contados para cima (quem ainda
 * tem 1 hora de periodo tem 1 dia) e ficam entre 0 e os dias do periodo; os dias do periodo sao os do
 * mes em questao (28 a 31). No primeiro dia inteiro paga a diferenca inteira; depois do fim, nada.
 */
export const proratedDifference = (
  currentPrice: number,
  targetPrice: number,
  periodStart: Date,
  periodEnd: Date,
  now: Date,
): { difference: number; remainingDays: number; periodDays: number } => {
  const periodDays = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / DAY_MS));
  const remainingDays = Math.min(periodDays, Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / DAY_MS)));
  const cents = Math.round(((toCents(targetPrice) - toCents(currentPrice)) * remainingDays) / periodDays);
  return { difference: cents / 100, remainingDays, periodDays };
};

const STATUS_MESSAGES: Record<string, string> = {
  past_due: "Há uma cobrança pendente. Troque o cartão para regularizar antes de mudar de plano.",
  blocked: "O acesso da barbearia está bloqueado. Regularize a assinatura antes de mudar de plano.",
  canceled: "A assinatura está cancelada. Assine de novo para mudar de plano.",
  courtesy: "A barbearia está com cortesia: não há cobrança, então não há plano para mudar por aqui.",
};

const refuse = (code: PlanChangeRefusalCode, message: string): PlanChangeQuote => ({ ok: false, code, message });

export const quotePlanChange = (input: PlanChangeInput): PlanChangeQuote => {
  if (input.status !== "trialing" && input.status !== "active") {
    return refuse("status", STATUS_MESSAGES[input.status] ?? "A assinatura não permite mudar de plano agora.");
  }
  if (input.targetPlanId === input.currentPlanId) {
    return refuse("same_plan", "A barbearia já está neste plano.");
  }
  if (input.status === "active" && toCents(input.targetPlanPrice) === toCents(input.currentPlanPrice)) {
    return refuse("same_price", "Este plano custa o mesmo que o plano atual.");
  }
  if (input.status === "active" && input.scheduledPlanId === input.targetPlanId) {
    return refuse("already_scheduled", `A mudança para o plano ${input.targetPlanName} já está agendada.`);
  }
  if (input.activeProfessionals > input.targetMaxProfessionals) {
    const toDeactivate = input.activeProfessionals - input.targetMaxProfessionals;
    return refuse(
      "over_limit",
      `Seus ${input.activeProfessionals} profissionais ativos não cabem no plano ${input.targetPlanName}, que aceita até ${input.targetMaxProfessionals}. Desative ${toDeactivate} ${
        toDeactivate === 1 ? "profissional" : "profissionais"
      } antes de trocar de plano.`,
    );
  }

  if (input.status === "trialing") {
    return {
      ok: true,
      mode: "free",
      difference: 0,
      newMonthlyAmount: input.targetPlanPrice,
      remainingDays: null,
      periodDays: null,
    };
  }

  if (!input.periodStart || !input.periodEnd) {
    return refuse("no_period", "Não foi possível calcular a diferença do plano.");
  }
  // Descer: sem cobranca e sem reembolso, o plano menor vale quando o periodo pago acaba.
  if (toCents(input.targetPlanPrice) < toCents(input.currentPlanPrice)) {
    return {
      ok: true,
      mode: "scheduled",
      difference: 0,
      newMonthlyAmount: input.targetPlanPrice,
      remainingDays: null,
      periodDays: null,
      effectiveAt: input.periodEnd,
    };
  }
  const { difference, remainingDays, periodDays } = proratedDifference(
    input.currentPlanPrice,
    input.targetPlanPrice,
    input.periodStart,
    input.periodEnd,
    input.now,
  );
  const charges = difference >= MINIMUM_CHARGE;
  return {
    ok: true,
    mode: charges ? "charge" : "no_charge",
    difference: charges ? difference : 0,
    newMonthlyAmount: input.targetPlanPrice,
    remainingDays,
    periodDays,
  };
};
