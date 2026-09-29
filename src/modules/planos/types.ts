// Catálogo de planos do Navalhado (spec 052, ticket 01). Todos os planos têm todos
// os recursos: o que muda de um para outro é o preço e o limite de profissionais.
export interface Plano {
  id: string;
  name: string;
  price: number;
  max_professionals: number;
}

export type PlanosStatus = 'loading' | 'ready' | 'error';

export interface IPlanosAdapter {
  listar(): Promise<Plano[]>;
  /** Plano da assinatura da barbearia (uma por barbearia), ou nulo se ela não tem assinatura. */
  obterDoTenant(tenantId: string): Promise<Plano | null>;
}
