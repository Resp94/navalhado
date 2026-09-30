import type { SituacaoDaAssinatura } from './situacaoDaAssinatura';

// Estado de Acesso da barbearia (spec 052, ticket 03). O banco calcula; o front só lê.
export type NivelDeAcesso = 'liberado' | 'aviso' | 'bloqueado';

/** Motivos que o banco devolve junto com o estado (private.subscription_access_state). */
export type MotivoDeAcesso =
  | 'trial'
  | 'trial_expired'
  | 'active'
  | 'payment_failed'
  | 'canceled'
  | 'courtesy'
  | 'courtesy_expired'
  | 'refunded'
  | 'charged_back'
  | 'blocked'
  | 'no_subscription';

export interface EstadoDeAcesso {
  acesso: NivelDeAcesso;
  motivo: MotivoDeAcesso;
  /** Fim do teste, data do bloqueio ou fim do período pago, conforme o motivo. */
  dataRelevante: Date | null;
}

/** Quem vê a tela: o Gerente pode agir (pagar); o Barbeiro só recebe a explicação. */
export type PerfilNoBloqueio = 'gerente' | 'barbeiro';

export type EstadoDeAcessoStatus = 'loading' | 'ready' | 'error';

/** Assinatura criada no Mercado Pago (spec 052, ticket 05): o Gerente conclui no link. */
export interface AssinaturaCriada {
  linkDePagamento: string;
  assinaturaId: string;
  /** Data da primeira cobrança, ou nulo quando a cobrança é imediata. */
  primeiraCobrancaEm: Date | null;
}

/** Cartão da assinatura, só para exibição: a bandeira vem na autorização, o final no primeiro pagamento. */
export interface CartaoDaAssinatura {
  bandeira: string | null;
  final: string | null;
}

/** A assinatura da barbearia como a tela Assinatura mostra (spec 052, ticket 06). */
export interface DetalhesDaAssinatura {
  situacao: SituacaoDaAssinatura;
  plano: { nome: string; preco: number };
  testeAte: Date | null;
  /** Fim do período pago: quando a próxima mensalidade vence, ou até quando uma cancelada tem acesso. */
  periodoAte: Date | null;
  cortesiaAte: Date | null;
  cartao: CartaoDaAssinatura | null;
}

/** Uma linha do histórico de cobranças, gravada pelo webhook do Mercado Pago. */
export interface Cobranca {
  id: string;
  valor: number;
  cobradaEm: Date;
  /** Situação do pagamento no Mercado Pago (approved, rejected, refunded...). */
  situacao: string;
  /** recurring: mensalidade. upgrade: diferença de plano cobrada na hora. */
  tipo: 'recurring' | 'upgrade';
  cartao: CartaoDaAssinatura | null;
}

/** O cartão que a assinatura passou a usar. O que o provedor não devolveu vem nulo. */
export interface CartaoTrocado {
  bandeira: string | null;
  final: string | null;
}

export interface IAssinaturaAdapter {
  /** Estado da barbearia de quem está logado, ou nulo se o usuário não tem barbearia. */
  obterEstadoDeAcesso(): Promise<EstadoDeAcesso | null>;
  /** Cria a assinatura da barbearia de quem está logado (só o Gerente consegue) e devolve o link de pagamento. */
  assinar(): Promise<AssinaturaCriada>;
  /**
   * Troca o cartão da assinatura pelo token gerado nos campos seguros do Mercado Pago (sem cobrança).
   * `final` são os 4 últimos dígitos que o SDK devolveu junto do token: o Mercado Pago não os devolve na troca.
   */
  trocarCartao(token: string, final?: string | null): Promise<CartaoTrocado>;
  /** Public Key do Mercado Pago do ambiente, para carregar os campos seguros. */
  obterChavePublica(): Promise<string>;
  /** Assinatura da barbearia, ou nulo se ela não tem. O banco só entrega ao Gerente da própria barbearia. */
  obterAssinatura(tenantId: string): Promise<DetalhesDaAssinatura | null>;
  /** Histórico gravado pelo webhook; não consulta o Mercado Pago. */
  listarCobrancas(tenantId: string): Promise<Cobranca[]>;
}
