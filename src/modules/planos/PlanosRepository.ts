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

  /**
   * Plano pré-selecionado no cadastro: o do meio da lista ordenada por preço.
   * Escolher pela posição, e não pelo nome, evita que renomear um plano mude o
   * padrão sem ninguém perceber.
   */
  planoPadrao(planos: Plano[]): Plano | undefined {
    return planos[Math.floor(planos.length / 2)];
  }
}
