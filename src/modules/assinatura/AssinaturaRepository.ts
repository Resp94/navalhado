import { MENSAGEM_ASSINAR_FALHOU, MENSAGEM_CARTAO_ILEGIVEL, MENSAGEM_FORMULARIO_DO_CARTAO_FALHOU } from './errors';
import type {
  AssinaturaCriada,
  CartaoTrocado,
  Cobranca,
  CotacaoDaTroca,
  DetalhesDaAssinatura,
  EstadoDeAcesso,
  IAssinaturaAdapter,
  PagamentoDaTroca,
  PlanoTrocado,
  UsoDaChavePublica,
} from './types';

const UM_DIA_EM_MS = 24 * 60 * 60 * 1000;

// Os 4 últimos dígitos só valem no formato certo; o resto é ignorado, sem recusar a operação.
const quatroDigitos = (final?: string | null): string | null => (final && /^[0-9]{4}$/.test(final) ? final : null);

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

  /**
   * Troca o cartão da assinatura. Só o token gerado nos campos seguros do Mercado Pago e os 4 últimos
   * dígitos passam por aqui: o número do cartão nunca chega ao Navalhado. A troca não cobra nada.
   */
  async trocarCartao(token: string, final?: string | null): Promise<CartaoTrocado> {
    if (!token || !token.trim()) throw new Error(MENSAGEM_CARTAO_ILEGIVEL);
    return this.adapter.trocarCartao(token.trim(), quatroDigitos(final));
  }

  /**
   * Public Key do Mercado Pago do ambiente, para carregar os campos seguros do cartão. O token só vale para o app
   * que o gerou: a troca de cartão usa a chave da assinatura e a cobrança avulsa da diferença do plano, a da cobrança.
   */
  async obterChavePublica(uso: UsoDaChavePublica = 'assinatura'): Promise<string> {
    const chave = await this.adapter.obterChavePublica(uso);
    if (!chave) throw new Error(MENSAGEM_FORMULARIO_DO_CARTAO_FALHOU);
    return chave;
  }

  /**
   * A diferença proporcional e o valor mensal novo de uma troca de plano, calculados pela função de cobrança:
   * a tela só os mostra antes de o Gerente confirmar. Não cobra nem troca nada.
   */
  async cotarTrocaDePlano(planoId: string): Promise<CotacaoDaTroca> {
    this.exigirPlano(planoId);
    return this.adapter.cotarTrocaDePlano(planoId);
  }

  /**
   * Troca o plano da barbearia. Com `pagamento`, a diferença é cobrada no cartão do token (o número do cartão nunca passa
   * por aqui) e o plano só troca se o pagamento for aprovado; sem ele, em teste ou com a diferença pequena demais
   * para o provedor cobrar, troca sem cobrança. O valor confirmado precisa ser o que a função vai cobrar: se mudou, ela recusa.
   */
  async trocarDePlano(planoId: string, pagamento?: PagamentoDaTroca): Promise<PlanoTrocado> {
    this.exigirPlano(planoId);
    if (!pagamento) return this.adapter.trocarDePlano(planoId);
    if (!pagamento.token || !pagamento.token.trim()) throw new Error(MENSAGEM_CARTAO_ILEGIVEL);
    return this.adapter.trocarDePlano(planoId, {
      token: pagamento.token.trim(),
      final: quatroDigitos(pagamento.final),
      valorConfirmado: pagamento.valorConfirmado,
    });
  }

  /** Desiste da descida agendada antes da data: o plano atual segue e o valor da assinatura volta para o dele. */
  async desfazerDescidaDePlano(): Promise<void> {
    return this.adapter.desfazerDescidaDePlano();
  }

  /**
   * Cancela a assinatura: a cobrança para na hora e o acesso continua até o fim do período já pago. A função de cobrança cancela
   * no Mercado Pago e grava a situação; o navegador não manda barbearia nem assinatura, então não há como cancelar a de outra.
   */
  async cancelarAssinatura(): Promise<void> {
    return this.adapter.cancelarAssinatura();
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

  private exigirPlano(planoId: string): void {
    if (!planoId || !planoId.trim()) {
      throw new Error('ID do plano é obrigatório.');
    }
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
