import type { IPlanosAdapter, Plano } from '../types';

export class InMemoryPlanosAdapter implements IPlanosAdapter {
  private planos: Plano[];
  private planosDosTenants: Record<string, Plano>;

  constructor(planos: Plano[] = [], planosDosTenants: Record<string, Plano> = {}) {
    this.planos = planos;
    this.planosDosTenants = planosDosTenants;
  }

  async listar(): Promise<Plano[]> {
    return this.planos.map((plano) => ({ ...plano }));
  }

  async obterDoTenant(tenantId: string): Promise<Plano | null> {
    const plano = this.planosDosTenants[tenantId];
    return plano ? { ...plano } : null;
  }
}
