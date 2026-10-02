// Situações que tenant_subscriptions.status pode ter (spec 052, ticket 03).
export type SituacaoDaAssinatura = 'trialing' | 'active' | 'past_due' | 'blocked' | 'canceled' | 'courtesy';

const ROTULOS: Record<SituacaoDaAssinatura, string> = {
  trialing: 'Em teste',
  active: 'Ativa',
  past_due: 'Pagamento recusado',
  blocked: 'Bloqueada',
  canceled: 'Cancelada',
  courtesy: 'Cortesia',
};

export const ehSituacaoDaAssinatura = (valor: string): valor is SituacaoDaAssinatura =>
  Object.prototype.hasOwnProperty.call(ROTULOS, valor);

/** Nulo é a barbearia sem assinatura, que não é o mesmo que cancelada. */
export function rotuloDaSituacao(situacao: SituacaoDaAssinatura | null): string {
  return situacao ? ROTULOS[situacao] : 'Sem assinatura';
}
