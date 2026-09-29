import type { EstadoDeAcesso, IAssinaturaAdapter } from './types';

const UM_DIA_EM_MS = 24 * 60 * 60 * 1000;

export class AssinaturaRepository {
  private adapter: IAssinaturaAdapter;

  constructor(adapter: IAssinaturaAdapter) {
    this.adapter = adapter;
  }

  /** Estado da barbearia de quem está logado. A falha sobe: quem chama decide se abre ou fecha. */
  async obterEstadoDeAcesso(): Promise<EstadoDeAcesso | null> {
    return this.adapter.obterEstadoDeAcesso();
  }

  /**
   * Dias que faltam até a data relevante, arredondados para cima: quem tem 2 dias e
   * 1 hora ainda vê "3 dias". Nunca negativo. Sem data relevante, não há o que contar.
   */
  diasRestantes(estado: EstadoDeAcesso, agora: Date = new Date()): number | null {
    if (!estado.dataRelevante) return null;
    const faltaEmMs = estado.dataRelevante.getTime() - agora.getTime();
    return Math.max(0, Math.ceil(faltaEmMs / UM_DIA_EM_MS));
  }
}
