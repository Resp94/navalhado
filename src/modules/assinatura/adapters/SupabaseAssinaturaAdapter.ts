import { supabase } from '../../../lib/supabase';
import { MENSAGEM_ASSINAR_FALHOU, MENSAGEM_FORMULARIO_DO_CARTAO_FALHOU, MENSAGEM_TROCAR_CARTAO_FALHOU } from '../errors';
import { ehSituacaoDaAssinatura } from '../situacaoDaAssinatura';
import type {
  AssinaturaCriada,
  CartaoDaAssinatura,
  CartaoTrocado,
  Cobranca,
  DetalhesDaAssinatura,
  EstadoDeAcesso,
  IAssinaturaAdapter,
  MotivoDeAcesso,
  NivelDeAcesso,
} from '../types';

/** Quantas cobranças o histórico traz: mais de três anos de mensalidades, sem paginação. */
const LIMITE_DO_HISTORICO = 50;

const NIVEIS: Record<string, NivelDeAcesso> = {
  allowed: 'liberado',
  warning: 'aviso',
  blocked: 'bloqueado',
};

interface LinhaDoEstado {
  access: string;
  reason: string;
  relevant_date: string | null;
}

interface LinhaDaAssinatura {
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  courtesy_ends_at: string | null;
  card_brand: string | null;
  card_last4: string | null;
  plans: { name: string; price: unknown } | { name: string; price: unknown }[] | null;
}

interface LinhaDaCobranca {
  mp_payment_id: string;
  amount: unknown;
  charged_at: string;
  status: string;
  kind: string;
  card_brand: string | null;
  card_last4: string | null;
}

const paraData = (valor: string | null): Date | null => (valor ? new Date(valor) : null);

const paraCartao = (bandeira: string | null, final: string | null): CartaoDaAssinatura | null =>
  bandeira || final ? { bandeira, final } : null;

interface RespostaDaCobranca {
  paymentLink?: string;
  subscriptionId?: string;
  firstChargeAt?: string | null;
  changed?: boolean;
  cardBrand?: string | null;
  cardLast4?: string | null;
  publicKey?: string;
  error?: string;
}

/** A função recusa com `{ error: "mensagem para o Gerente" }`; sem ela, o texto padrão da ação. */
const mensagemDaFalha = async (
  error: { context?: { json?: () => Promise<unknown> } } | null,
  padrao: string = MENSAGEM_ASSINAR_FALHOU,
): Promise<string> => {
  try {
    const corpo = (await error?.context?.json?.()) as RespostaDaCobranca | undefined;
    if (corpo?.error) return corpo.error;
  } catch {
    // Sem corpo legível: vale o texto padrão.
  }
  return padrao;
};

export class SupabaseAssinaturaAdapter implements IAssinaturaAdapter {
  // A RPC não recebe barbearia: o banco resolve a de quem chama, então o front
  // não tem como pedir o estado de outra.
  async obterEstadoDeAcesso(): Promise<EstadoDeAcesso | null> {
    const { data, error } = await supabase.rpc('get_my_access_state');

    if (error) {
      throw new Error(`Erro ao ler o estado de acesso da barbearia: ${error.message}`);
    }

    const linha = (data as LinhaDoEstado[] | null)?.[0];
    if (!linha) return null;

    const acesso = NIVEIS[linha.access];
    if (!acesso) {
      throw new Error(`Estado de acesso desconhecido: ${linha.access}`);
    }

    return {
      acesso,
      motivo: linha.reason as MotivoDeAcesso,
      dataRelevante: linha.relevant_date ? new Date(linha.relevant_date) : null,
    };
  }

  // A função confere no servidor que quem chama é o Gerente da barbearia; o front não manda
  // barbearia nem plano, então não há como assinar por outra.
  async assinar(): Promise<AssinaturaCriada> {
    const { data, error } = await supabase.functions.invoke('billing', { body: { action: 'assinar' } });

    if (error) {
      throw new Error(await mensagemDaFalha(error));
    }

    const resposta = data as RespostaDaCobranca | null;
    if (resposta?.error) throw new Error(resposta.error);
    if (!resposta?.paymentLink || !resposta.subscriptionId) throw new Error(MENSAGEM_ASSINAR_FALHOU);

    return {
      linkDePagamento: resposta.paymentLink,
      assinaturaId: resposta.subscriptionId,
      primeiraCobrancaEm: resposta.firstChargeAt ? new Date(resposta.firstChargeAt) : null,
    };
  }

  // Só o token do cartão sai daqui: o número foi digitado nos campos seguros do Mercado Pago. A função
  // confere no servidor que quem chama é o Gerente da barbearia; o front não manda barbearia nem assinatura.
  async trocarCartao(token: string): Promise<CartaoTrocado> {
    const { data, error } = await supabase.functions.invoke('billing', { body: { action: 'trocar_cartao', cardToken: token } });

    if (error) {
      throw new Error(await mensagemDaFalha(error, MENSAGEM_TROCAR_CARTAO_FALHOU));
    }

    const resposta = data as RespostaDaCobranca | null;
    if (resposta?.error) throw new Error(resposta.error);
    if (resposta?.changed !== true) throw new Error(MENSAGEM_TROCAR_CARTAO_FALHOU);

    return { bandeira: resposta.cardBrand ?? null, final: resposta.cardLast4 ?? null };
  }

  // A Public Key não é segredo, mas cada ambiente tem a sua: fica em secret do Supabase e a função
  // de cobrança entrega ao Gerente.
  async obterChavePublica(): Promise<string> {
    const { data, error } = await supabase.functions.invoke('billing', { body: { action: 'chave_publica' } });

    const resposta = data as RespostaDaCobranca | null;
    if (error || !resposta?.publicKey) throw new Error(MENSAGEM_FORMULARIO_DO_CARTAO_FALHOU);
    return resposta.publicKey;
  }

  // A barbearia tem uma única assinatura (unique por tenant_id). A RLS só entrega a linha ao
  // Gerente da própria barbearia; o filtro por tenant também vale para o Proprietário, que lê todas.
  async obterAssinatura(tenantId: string): Promise<DetalhesDaAssinatura | null> {
    const { data, error } = await supabase
      .from('tenant_subscriptions')
      .select('status, trial_ends_at, current_period_end, courtesy_ends_at, card_brand, card_last4, plans!tenant_subscriptions_plan_id_fkey(name, price)')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao ler a assinatura da barbearia: ${error.message}`);
    }
    if (!data) return null;

    const linha = data as unknown as LinhaDaAssinatura;
    if (!ehSituacaoDaAssinatura(linha.status)) {
      throw new Error(`Situação da assinatura desconhecida: ${linha.status}`);
    }
    const plano = Array.isArray(linha.plans) ? linha.plans[0] : linha.plans;
    if (!plano) {
      throw new Error('Erro ao ler a assinatura da barbearia: plano não encontrado.');
    }

    return {
      situacao: linha.status,
      plano: { nome: plano.name, preco: Number(plano.price) },
      testeAte: paraData(linha.trial_ends_at),
      periodoAte: paraData(linha.current_period_end),
      cortesiaAte: paraData(linha.courtesy_ends_at),
      cartao: paraCartao(linha.card_brand, linha.card_last4),
    };
  }

  // Lê o que o webhook gravou; nunca consulta o Mercado Pago.
  async listarCobrancas(tenantId: string): Promise<Cobranca[]> {
    const { data, error } = await supabase
      .from('billing_charges')
      .select('mp_payment_id, amount, charged_at, status, kind, card_brand, card_last4')
      .eq('tenant_id', tenantId)
      .order('charged_at', { ascending: false })
      .limit(LIMITE_DO_HISTORICO);

    if (error) {
      throw new Error(`Erro ao ler o histórico de cobranças: ${error.message}`);
    }

    return ((data ?? []) as LinhaDaCobranca[]).map((linha) => ({
      id: linha.mp_payment_id,
      valor: Number(linha.amount),
      cobradaEm: new Date(linha.charged_at),
      situacao: linha.status,
      tipo: linha.kind === 'upgrade' ? 'upgrade' : 'recurring',
      cartao: paraCartao(linha.card_brand, linha.card_last4),
    }));
  }
}
