import type { AssinaturaCriada, Cobranca, DetalhesDaAssinatura, EstadoDeAcesso, IAssinaturaAdapter } from '../types';

export class InMemoryAssinaturaAdapter implements IAssinaturaAdapter {
  private resultado: EstadoDeAcesso | null | Error;
  private assinaturas = new Map<string, DetalhesDaAssinatura>();
  private cobrancas = new Map<string, Cobranca[]>();
  private falhaDaAssinatura: Error | null = null;

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

  definirAssinatura(tenantId: string, assinatura: DetalhesDaAssinatura): void {
    this.assinaturas.set(tenantId, assinatura);
  }

  definirCobrancas(tenantId: string, cobrancas: Cobranca[]): void {
    this.cobrancas.set(tenantId, cobrancas);
  }

  /** Faz a leitura da assinatura falhar, para testar quem decide o que fazer com a falha. */
  falharLeituraDaAssinatura(erro: Error): void {
    this.falhaDaAssinatura = erro;
  }

  async obterAssinatura(tenantId: string): Promise<DetalhesDaAssinatura | null> {
    if (this.falhaDaAssinatura) throw this.falhaDaAssinatura;
    const assinatura = this.assinaturas.get(tenantId);
    return assinatura ? { ...assinatura } : null;
  }

  async listarCobrancas(tenantId: string): Promise<Cobranca[]> {
    return (this.cobrancas.get(tenantId) ?? []).map((cobranca) => ({ ...cobranca }));
  }
}
