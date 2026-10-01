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
  plano: { id: string; nome: string; preco: number };
  /** Plano menor que vale a partir da próxima cobrança (descida agendada), ou nulo. A data é `periodoAte`. */
  planoAgendado: { id: string; nome: string; preco: number } | null;
  testeAte: Date | null;
  /** Fim do período pago: quando a próxima mensalidade vence, ou até quando uma cancelada tem acesso. */
  periodoAte: Date | null;
  cortesiaAte: Date | null;
  cartao: CartaoDaAssinatura | null;
  /**
   * Cancelada que já assinou de novo e o Mercado Pago autorizou a assinatura nova: a cobrança dela recomeça no fim do período pago
   * (`periodoAte`). O banco tira a data do cancelamento ao assinar de novo (e o cartão ao cancelar), e a bandeira da assinatura
   * nova chega na autorização do Mercado Pago.
   */
  assinaturaNovaAutorizada: boolean;
}

/**
 * O que o cancelamento precisa saber da assinatura para dizer ao Gerente o que vai acontecer. A tela de bloqueio, que não lê a
 * assinatura, passa só a situação (bloqueada).
 */
export type AssinaturaCancelavel = Pick<
  DetalhesDaAssinatura,
  'situacao' | 'testeAte' | 'periodoAte' | 'assinaturaNovaAutorizada'
>;

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

/**
 * Como a troca de plano sai: em teste é livre; na assinatura ativa cobra a diferença na hora; se a diferença é pequena demais
 * para o provedor cobrar, troca sem cobrança; descer na assinatura ativa fica agendada para a próxima cobrança, sem cobrança
 * nem reembolso.
 */
export type ModoDaTroca = 'livre' | 'cobranca' | 'sem_cobranca' | 'agendada';

/** O que a função de cobrança calculou para a troca: o navegador só mostra, nunca calcula. */
export interface CotacaoDaTroca {
  modo: ModoDaTroca;
  /** Valor cobrado agora, em reais (zero quando não há cobrança). */
  diferenca: number;
  /** Valor mensal do plano novo, que vale a partir da próxima cobrança. */
  valorMensalNovo: number;
  /** Dias que faltam e dias do período pago, em que a diferença é proporcional. Nulos em teste. */
  diasRestantes: number | null;
  diasDoPeriodo: number | null;
  nomeDoPlano: string;
  /** Quando o plano menor passa a valer (só na descida agendada): o fim do período pago. */
  vigenteEm: Date | null;
}

/** O cartão digitado nos campos seguros para pagar a diferença, com o valor que o Gerente viu e confirmou. */
export interface PagamentoDaTroca {
  token: string;
  /** Os 4 últimos dígitos que o SDK devolveu junto do token (só para mostrar o cartão no histórico). */
  final: string | null;
  valorConfirmado: number;
}

export interface PlanoTrocado {
  planoId: string;
  nomeDoPlano: string;
  /** O que foi cobrado na hora, em reais (zero se não houve cobrança). */
  cobrado: number;
  valorMensalNovo: number;
  /** Falso se o Mercado Pago não aceitou o valor novo da próxima cobrança: o plano trocou, mas a mensalidade segue no valor antigo até alguém conferir. */
  proximaCobrancaAtualizada: boolean;
  /** Na descida agendada, quando o plano menor passa a valer; nulo nas trocas que valem já. */
  vigenteEm: Date | null;
}

/** Qual Public Key: a da assinatura (troca de cartão) ou a da cobrança avulsa (diferença do plano). No DEV são de apps diferentes. */
export type UsoDaChavePublica = 'assinatura' | 'cobranca';

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
  obterChavePublica(uso?: UsoDaChavePublica): Promise<string>;
  /** Pede à função de cobrança a diferença proporcional e o valor mensal novo de uma troca de plano. Não cobra nem troca nada. */
  cotarTrocaDePlano(planoId: string): Promise<CotacaoDaTroca>;
  /**
   * Troca o plano da barbearia. Com `pagamento`, cobra a diferença no cartão do token e só troca se o pagamento
   * for aprovado; sem ele (em teste, ou diferença pequena demais) troca sem cobrança.
   */
  trocarDePlano(planoId: string, pagamento?: PagamentoDaTroca): Promise<PlanoTrocado>;
  /** Desiste da descida agendada antes da data: o valor da assinatura volta para o do plano atual. */
  desfazerDescidaDePlano(): Promise<void>;
  /**
   * Cancela a assinatura da barbearia de quem está logado (só o Gerente consegue): a cobrança para na hora e o acesso continua
   * até o fim do período já pago. Não reembolsa nada. A falha sobe com o motivo que a função de cobrança devolveu.
   */
  cancelarAssinatura(): Promise<void>;
  /** Assinatura da barbearia, ou nulo se ela não tem. O banco só entrega ao Gerente da própria barbearia. */
  obterAssinatura(tenantId: string): Promise<DetalhesDaAssinatura | null>;
  /** Histórico gravado pelo webhook; não consulta o Mercado Pago. */
  listarCobrancas(tenantId: string): Promise<Cobranca[]>;
}
