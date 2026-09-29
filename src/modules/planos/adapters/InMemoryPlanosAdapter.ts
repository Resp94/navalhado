import type { IPlanosAdapter, Plano } from '../types';

export class InMemoryPlanosAdapter implements IPlanosAdapter {
  private planos: Plano[];

  constructor(planos: Plano[] = []) {
    this.planos = planos;
  }

  async listar(): Promise<Plano[]> {
    return this.planos.map((plano) => ({ ...plano }));
  }
}
