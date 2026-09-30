import { MENSAGEM_ASSINAR_FALHOU } from './errors';
import type { AssinaturaCriada, Cobranca, DetalhesDaAssinatura, EstadoDeAcesso, IAssinaturaAdapter } from './types';

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
   * Cria a assinatura da barbearia e devolve o link de pagamento do Mercado Pago. O link só
   * vale se for https: o front vai navegar para ele, então nunca para outro tipo de endereço.
   */
  async assinar(): Promise<AssinaturaCriada> {
    const criada = await this.adapter.assinar();
    if (!criada.linkDePagamento.startsWith('https://')) {
      throw new Error(MENSAGEM_ASSINAR_FALHOU);
    }
    return criada;
  }

  /** Assinatura da barbearia (plano, situação, datas, cartão), ou nulo se ela não tem. */
  async obterAssinatura(tenantId: string): Promise<DetalhesDaAssinatura | null> {
    this.exigirTenant(tenantId);
    return this.adapter.obterAssinatura(tenantId);
  }

  /** Histórico de cobranças da barbearia, da mais recente para a mais antiga. */
  async listarCobrancas(tenantId: string): Promise<Cobranca[]> {
    this.exigirTenant(tenantId);
    const cobrancas = await this.adapter.listarCobrancas(tenantId);
    return [...cobrancas].sort((a, b) => b.cobradaEm.getTime() - a.cobradaEm.getTime());
  }

  private exigirTenant(tenantId: string): void {
    if (!tenantId || !tenantId.trim()) {
      throw new Error('ID da barbearia (tenant) é obrigatório.');
    }
  }

  /**
   * Dias que faltam até a data relevante, arredondados para cima: quem tem 2 dias e
   * 1 hora ainda vê "3 dias". Nunca negativo. Sem data relevante, não há o que contar.
   */
  diasRestantes(estado: Pick<EstadoDeAcesso, 'dataRelevante'>, agora: Date = new Date()): number | null {
    if (!estado.dataRelevante) return null;
    const faltaEmMs = estado.dataRelevante.getTime() - agora.getTime();
    return Math.max(0, Math.ceil(faltaEmMs / UM_DIA_EM_MS));
  }
}
