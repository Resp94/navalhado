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

/** Nulo é a barbearia sem assinatura, que não é o mesmo que cancelada. */
export function rotuloDaSituacao(situacao: SituacaoDaAssinatura | null): string {
  return situacao ? ROTULOS[situacao] : 'Sem assinatura';
}

/** Mudanças que o Proprietário ainda faz à mão em Admin > Tenants. */
export type MudancaManual = 'courtesy' | 'blocked' | 'canceled';

/**
 * Campos gravados numa mudança manual de situação. Interino: as ferramentas do
 * Proprietário (estender teste, cortesia, desbloquear) vão substituir a escrita direta.
 */
export function camposDaMudancaManual(mudanca: MudancaManual, agora: Date = new Date()) {
  const instante = agora.toISOString();

  switch (mudanca) {
    case 'courtesy':
      return {
        status: 'courtesy' as const,
        courtesy_ends_at: null,
        blocked_at: null,
        blocked_reason: null,
        canceled_at: null,
        first_failed_at: null,
        updated_at: instante,
      };
    case 'blocked':
      return { status: 'blocked' as const, blocked_at: instante, blocked_reason: null, updated_at: instante };
    case 'canceled':
      return { status: 'canceled' as const, canceled_at: instante, updated_at: instante };
  }
}
