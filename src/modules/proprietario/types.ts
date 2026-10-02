import type { SituacaoDaAssinatura } from '../assinatura/situacaoDaAssinatura';
import type { MotivoDeAcesso } from '../assinatura/types';

/**
 * Ferramentas do Proprietário (spec 052, ticket 15): o Proprietário do SaaS vê a assinatura de cada barbearia e resolve os casos de
 * suporte sem abrir o banco. Quem decide é o banco (funções `admin_*`, só para o Proprietário); o front lê e pede.
 */

export interface PlanoDoTenant {
  id: string;
  nome: string;
  preco: number;
  limiteDeProfissionais: number;
}

export interface AssinaturaDoTenant {
  situacao: SituacaoDaAssinatura;
  plano: PlanoDoTenant;
  /** Plano menor que vale a partir da próxima cobrança (descida agendada), ou nulo. */
  planoAgendado: PlanoDoTenant | null;
  testeAte: Date | null;
  periodoDesde: Date | null;
  periodoAte: Date | null;
  primeiraRecusaEm: Date | null;
  bloqueadaEm: Date | null;
  /** `trial_expired`, `payment_failed`, `canceled`, `courtesy_expired`, `refunded`, `charged_back`; nulo no bloqueio manual. */
  motivoDoBloqueio: string | null;
  canceladaEm: Date | null;
  cortesiaAte: Date | null;
  /** Até quando uma barbearia bloqueada foi liberada à mão, ou nulo. */
  desbloqueadaAte: Date | null;
  assinaturaNoMercadoPago: string | null;
  cartao: { bandeira: string | null; final: string | null } | null;
}

export interface CobrancaDoTenant {
  id: string;
  pagamentoNoMercadoPago: string;
  assinaturaNoMercadoPago: string | null;
  /** `recurring` (mensalidade) ou `upgrade` (diferença da subida de plano). */
  tipo: string;
  situacao: string;
  valor: number;
  cobradaEm: Date;
  cartao: { bandeira: string | null; final: string | null } | null;
}

/** O Estado de Acesso de hoje, como o banco o calcula (`allowed`, `warning` ou `blocked`, e o motivo). */
export interface AcessoDoTenant {
  nivel: 'allowed' | 'warning' | 'blocked';
  motivo: MotivoDeAcesso;
  dataRelevante: Date | null;
}

/** O último desbloqueio manual, com o motivo que o Proprietário deu. */
export interface DesbloqueioDoTenant {
  motivo: string | null;
  em: Date;
  ate: Date;
}

export interface AcaoDoProprietario {
  /** `admin_extend_trial`, `admin_set_courtesy`, `admin_end_courtesy`, `admin_unblock_tenant` ou `admin_block_tenant`. */
  acao: string;
  em: Date;
  por: string | null;
  detalhes: Record<string, unknown>;
}

export interface DetalhesDoTenant {
  barbearia: { id: string; nome: string; email: string; telefone: string; fuso: string; criadaEm: Date };
  /** Nulo na barbearia sem assinatura. */
  assinatura: AssinaturaDoTenant | null;
  acesso: AcessoDoTenant;
  profissionaisAtivos: number;
  cobrancas: CobrancaDoTenant[];
  desbloqueio: DesbloqueioDoTenant | null;
  acoes: AcaoDoProprietario[];
}

/** Um aviso por e-mail que o Resend recusou ou que esgotou as tentativas (ticket 08). */
export interface AvisoQueFalhou {
  id: string;
  tenantId: string;
  barbearia: string | null;
  /** `trial_ending`, `payment_failed_day0`, `payment_failed_day3`, `payment_failed_day4` ou `blocked`. */
  tipo: string;
  referenciaEm: Date;
  tentativas: number;
  motivo: string | null;
  criadoEm: Date;
}

export interface IProprietarioAdapter {
  obterDetalhes(tenantId: string): Promise<DetalhesDoTenant>;
  /** `ate` é um dia (AAAA-MM-DD) no fuso da barbearia: o teste vai até o fim desse dia. */
  estenderTeste(tenantId: string, ate: string): Promise<void>;
  /** Sem `ate`, a cortesia não tem fim. */
  darCortesia(tenantId: string, ate: string | null): Promise<void>;
  encerrarCortesia(tenantId: string): Promise<void>;
  desbloquear(tenantId: string, ate: string, motivo: string): Promise<void>;
  bloquear(tenantId: string, motivo: string): Promise<void>;
  listarAvisosQueFalharam(limite: number): Promise<AvisoQueFalhou[]>;
}
