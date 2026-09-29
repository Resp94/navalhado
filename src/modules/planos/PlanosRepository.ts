import type { IPlanosAdapter, Plano } from './types';

export class PlanosRepository {
  private adapter: IPlanosAdapter;

  constructor(adapter: IPlanosAdapter) {
    this.adapter = adapter;
  }

  /** Catálogo do mais barato para o mais caro. Catálogo vazio é erro: a tela não tem o que oferecer. */
  async listar(): Promise<Plano[]> {
    const lista = await this.adapter.listar();
    if (!lista || lista.length === 0) {
      throw new Error('Nenhum plano disponível no catálogo.');
    }
    return [...lista].sort((a, b) => a.price - b.price);
  }

  /** Plano da barbearia, o mesmo que o banco usa para aplicar o limite de profissionais. */
  async obterPlanoDoTenant(tenantId: string): Promise<Plano | null> {
    if (!tenantId || !tenantId.trim()) {
      throw new Error('ID da barbearia (tenant) é obrigatório.');
    }
    return this.adapter.obterDoTenant(tenantId);
  }

  /** O plano é o de maior limite do catálogo: acima dele não há plano para onde subir. */
  ehOMaiorPlano(planos: Plano[], plano: Pick<Plano, 'max_professionals'>): boolean {
    return planos.length > 0 && planos.every((p) => p.max_professionals <= plano.max_professionals);
  }

  /**
   * Plano pré-selecionado no cadastro: o do meio da lista ordenada por preço.
   * Escolher pela posição, e não pelo nome, evita que renomear um plano mude o
   * padrão sem ninguém perceber.
   */
  planoPadrao(planos: Plano[]): Plano | undefined {
    return planos[Math.floor(planos.length / 2)];
  }
}
