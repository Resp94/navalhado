// Catálogo de planos do Navalhado (spec 052, ticket 01). Todos os planos têm todos
// os recursos: o que muda de um para outro é o preço e o limite de profissionais.
export interface Plano {
  id: string;
  name: string;
  price: number;
  max_professionals: number;
}

/**
 * O plano que a cota de profissionais da barbearia usa. Com uma descida de plano agendada (spec 052, ticket 11) é o plano
 * menor, porque o banco já aplica o limite dele; `descidaAgendada` marca esse caso, em que o plano atual é maior.
 */
export interface PlanoDoTenant extends Plano {
  descidaAgendada?: boolean;
}

export type PlanosStatus = 'loading' | 'ready' | 'error';

export interface IPlanosAdapter {
  listar(): Promise<Plano[]>;
  /** Plano da cota da barbearia (uma assinatura por barbearia), ou nulo se ela não tem assinatura. */
  obterDoTenant(tenantId: string): Promise<PlanoDoTenant | null>;
}
