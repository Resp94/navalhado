import type { IPlanosAdapter, Plano, PlanoDoTenant } from '../types';

export class InMemoryPlanosAdapter implements IPlanosAdapter {
  private planos: Plano[];
  private planosDosTenants: Record<string, PlanoDoTenant>;

  constructor(planos: Plano[] = [], planosDosTenants: Record<string, PlanoDoTenant> = {}) {
    this.planos = planos;
    this.planosDosTenants = planosDosTenants;
  }

  async listar(): Promise<Plano[]> {
    return this.planos.map((plano) => ({ ...plano }));
  }

  async obterDoTenant(tenantId: string): Promise<PlanoDoTenant | null> {
    const plano = this.planosDosTenants[tenantId];
    return plano ? { ...plano } : null;
  }
}
