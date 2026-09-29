import type { AssinaturaCriada, EstadoDeAcesso, IAssinaturaAdapter } from '../types';

export class InMemoryAssinaturaAdapter implements IAssinaturaAdapter {
  private resultado: EstadoDeAcesso | null | Error;

  /** Quantas vezes o Gerente pediu para assinar. */
  public assinaturasSolicitadas = 0;
  /** O que `assinar` devolve. Passar um Error faz a chamada falhar. */
  public respostaDeAssinar: AssinaturaCriada | Error = {
    linkDePagamento: 'https://provider.test/checkout/assinatura-1',
    assinaturaId: 'assinatura-1',
    primeiraCobrancaEm: null,
  };

  /** Passar um Error faz a leitura falhar, para testar quem decide o que fazer com a falha. */
  constructor(resultado: EstadoDeAcesso | null | Error = null) {
    this.resultado = resultado;
  }

  async obterEstadoDeAcesso(): Promise<EstadoDeAcesso | null> {
    if (this.resultado instanceof Error) throw this.resultado;
    return this.resultado ? { ...this.resultado } : null;
  }

  async assinar(): Promise<AssinaturaCriada> {
    this.assinaturasSolicitadas += 1;
    if (this.respostaDeAssinar instanceof Error) throw this.respostaDeAssinar;
    return { ...this.respostaDeAssinar };
  }
}
