import type { SupabaseClient } from '@supabase/supabase-js';
import { ehSituacaoDaAssinatura } from '../../assinatura/situacaoDaAssinatura';
import type { MotivoDeAcesso } from '../../assinatura/types';
import type {
  AcaoDoProprietario,
  AcessoDoTenant,
  AssinaturaDoTenant,
  AvisoQueFalhou,
  CobrancaDoTenant,
  DesbloqueioDoTenant,
  DetalhesDoTenant,
  IProprietarioAdapter,
  PlanoDoTenant,
} from '../types';

interface PlanoDoBanco {
  id: string;
  name: string;
  price: number | string;
  max_professionals: number;
}

interface CobrancaDoBanco {
  id: string;
  mp_payment_id: string;
  mp_subscription_id: string | null;
  kind: string;
  status: string;
  amount: number | string;
  charged_at: string;
  card_brand: string | null;
  card_last4: string | null;
}

interface AssinaturaDoBanco {
  status: string;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  first_failed_at: string | null;
  blocked_at: string | null;
  blocked_reason: string | null;
  canceled_at: string | null;
  courtesy_ends_at: string | null;
  unblocked_until: string | null;
  mp_subscription_id: string | null;
  card_brand: string | null;
  card_last4: string | null;
  plan: PlanoDoBanco;
  scheduled_plan: PlanoDoBanco | null;
}

/** O que `admin_get_tenant_subscription` devolve. */
interface DetalhesDoBanco {
  tenant: { id: string; name: string; email: string; phone: string; timezone: string; created_at: string };
  subscription: AssinaturaDoBanco | null;
  access: { access: AcessoDoTenant['nivel']; reason: string; relevant_date: string | null };
  active_professionals: number;
  charges: CobrancaDoBanco[];
  unblock: { reason: string | null; at: string; until: string } | null;
  admin_actions: { action: string; at: string; by: string | null; details: Record<string, unknown> }[];
}

interface AvisoDoBanco {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  kind: string;
  ref_at: string;
  attempts: number;
  detail: string | null;
  created_at: string;
}

const data = (valor: string | null): Date | null => (valor === null ? null : new Date(valor));

const cartao = (bandeira: string | null, final: string | null) => (bandeira === null && final === null ? null : { bandeira, final });

const plano = (linha: PlanoDoBanco): PlanoDoTenant => ({
  id: linha.id,
  nome: linha.name,
  preco: Number(linha.price),
  limiteDeProfissionais: linha.max_professionals,
});

function assinatura(linha: AssinaturaDoBanco): AssinaturaDoTenant {
  if (!ehSituacaoDaAssinatura(linha.status)) throw new Error(`Situação de assinatura desconhecida: ${linha.status}`);
  return {
    situacao: linha.status,
    plano: plano(linha.plan),
    planoAgendado: linha.scheduled_plan ? plano(linha.scheduled_plan) : null,
    testeAte: data(linha.trial_ends_at),
    periodoDesde: data(linha.current_period_start),
    periodoAte: data(linha.current_period_end),
    primeiraRecusaEm: data(linha.first_failed_at),
    bloqueadaEm: data(linha.blocked_at),
    motivoDoBloqueio: linha.blocked_reason,
    canceladaEm: data(linha.canceled_at),
    cortesiaAte: data(linha.courtesy_ends_at),
    desbloqueadaAte: data(linha.unblocked_until),
    assinaturaNoMercadoPago: linha.mp_subscription_id,
    cartao: cartao(linha.card_brand, linha.card_last4),
  };
}

function cobranca(linha: CobrancaDoBanco): CobrancaDoTenant {
  return {
    id: linha.id,
    pagamentoNoMercadoPago: linha.mp_payment_id,
    assinaturaNoMercadoPago: linha.mp_subscription_id,
    tipo: linha.kind,
    situacao: linha.status,
    valor: Number(linha.amount),
    cobradaEm: new Date(linha.charged_at),
    cartao: cartao(linha.card_brand, linha.card_last4),
  };
}

function desbloqueio(linha: DetalhesDoBanco['unblock']): DesbloqueioDoTenant | null {
  return linha ? { motivo: linha.reason, em: new Date(linha.at), ate: new Date(linha.until) } : null;
}

function acao(linha: DetalhesDoBanco['admin_actions'][number]): AcaoDoProprietario {
  return { acao: linha.action, em: new Date(linha.at), por: linha.by, detalhes: linha.details };
}

function detalhes(linha: DetalhesDoBanco): DetalhesDoTenant {
  return {
    barbearia: {
      id: linha.tenant.id,
      nome: linha.tenant.name,
      email: linha.tenant.email,
      telefone: linha.tenant.phone,
      fuso: linha.tenant.timezone,
      criadaEm: new Date(linha.tenant.created_at),
    },
    assinatura: linha.subscription ? assinatura(linha.subscription) : null,
    acesso: { nivel: linha.access.access, motivo: linha.access.reason as MotivoDeAcesso, dataRelevante: data(linha.access.relevant_date) },
    profissionaisAtivos: Number(linha.active_professionals),
    cobrancas: linha.charges.map(cobranca),
    desbloqueio: desbloqueio(linha.unblock),
    acoes: linha.admin_actions.map(acao),
  };
}

function aviso(linha: AvisoDoBanco): AvisoQueFalhou {
  return {
    id: linha.id,
    tenantId: linha.tenant_id,
    barbearia: linha.tenant_name,
    tipo: linha.kind,
    referenciaEm: new Date(linha.ref_at),
    tentativas: linha.attempts,
    motivo: linha.detail,
    criadoEm: new Date(linha.created_at),
  };
}

/**
 * Chama as funções do banco só para o Proprietário (`admin_*`, spec 052, ticket 15). Quem recusa quem não é Proprietário, e quem
 * confere as datas e os estados, é o banco: o erro dele sobe como veio, para o repositório traduzir.
 */
export class SupabaseProprietarioAdapter implements IProprietarioAdapter {
  private readonly supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  private async chamar<T = unknown>(funcao: string, argumentos: Record<string, unknown>): Promise<T> {
    const { data: resposta, error } = await this.supabase.rpc(funcao, argumentos);
    if (error) throw error;
    return resposta as T;
  }

  async obterDetalhes(tenantId: string): Promise<DetalhesDoTenant> {
    return detalhes(await this.chamar<DetalhesDoBanco>('admin_get_tenant_subscription', { p_tenant_id: tenantId }));
  }

  async estenderTeste(tenantId: string, ate: string): Promise<void> {
    await this.chamar('admin_extend_trial', { p_tenant_id: tenantId, p_until: ate });
  }

  async darCortesia(tenantId: string, ate: string | null): Promise<void> {
    await this.chamar('admin_set_courtesy', { p_tenant_id: tenantId, p_ends_on: ate });
  }

  async encerrarCortesia(tenantId: string): Promise<void> {
    await this.chamar('admin_end_courtesy', { p_tenant_id: tenantId });
  }

  async desbloquear(tenantId: string, ate: string, motivo: string): Promise<void> {
    await this.chamar('admin_unblock_tenant', { p_tenant_id: tenantId, p_until: ate, p_reason: motivo });
  }

  async bloquear(tenantId: string, motivo: string): Promise<void> {
    await this.chamar('admin_block_tenant', { p_tenant_id: tenantId, p_reason: motivo });
  }

  async listarAvisosQueFalharam(limite: number): Promise<AvisoQueFalhou[]> {
    const linhas = await this.chamar<AvisoDoBanco[] | null>('admin_list_failed_billing_notices', { p_limit: limite });
    return (linhas ?? []).map(aviso);
  }
}
