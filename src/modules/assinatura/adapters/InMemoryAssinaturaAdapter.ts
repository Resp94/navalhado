import type { EstadoDeAcesso, IAssinaturaAdapter } from '../types';

export class InMemoryAssinaturaAdapter implements IAssinaturaAdapter {
  private resultado: EstadoDeAcesso | null | Error;

  /** Passar um Error faz a leitura falhar, para testar quem decide o que fazer com a falha. */
  constructor(resultado: EstadoDeAcesso | null | Error = null) {
    this.resultado = resultado;
  }

  async obterEstadoDeAcesso(): Promise<EstadoDeAcesso | null> {
    if (this.resultado instanceof Error) throw this.resultado;
    return this.resultado ? { ...this.resultado } : null;
  }
}
