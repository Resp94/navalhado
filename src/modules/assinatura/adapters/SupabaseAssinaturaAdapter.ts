import { supabase } from '../../../lib/supabase';
import {
  MENSAGEM_ASSINAR_FALHOU,
  MENSAGEM_COTAR_TROCA_FALHOU,
  MENSAGEM_FORMULARIO_DO_CARTAO_FALHOU,
  MENSAGEM_TROCAR_CARTAO_FALHOU,
  MENSAGEM_TROCAR_PLANO_FALHOU,
} from '../errors';
import { ehSituacaoDaAssinatura } from '../situacaoDaAssinatura';
import type {
  AssinaturaCriada,
  CartaoDaAssinatura,
  CartaoTrocado,
  Cobranca,
  CotacaoDaTroca,
  DetalhesDaAssinatura,
  EstadoDeAcesso,
  IAssinaturaAdapter,
  ModoDaTroca,
  MotivoDeAcesso,
  NivelDeAcesso,
  PagamentoDaTroca,
  PlanoTrocado,
  UsoDaChavePublica,
} from '../types';

/** Quantas cobranças o histórico traz: mais de três anos de mensalidades, sem paginação. */
const LIMITE_DO_HISTORICO = 50;

const NIVEIS: Record<string, NivelDeAcesso> = {
  allowed: 'liberado',
  warning: 'aviso',
  blocked: 'bloqueado',
};

// O modo que a função de cobrança devolve na cotação da troca de plano.
const MODOS_DA_TROCA: Record<string, ModoDaTroca> = {
  free: 'livre',
  charge: 'cobranca',
  no_charge: 'sem_cobranca',
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
  plans: { id: string; name: string; price: unknown } | { id: string; name: string; price: unknown }[] | null;
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
  mode?: string;
  difference?: number;
  newMonthlyAmount?: number;
  remainingDays?: number | null;
  periodDays?: number | null;
  planName?: string;
  planId?: string;
  charged?: number;
  nextChargeUpdated?: boolean;
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

  // Só o token do cartão e os 4 últimos dígitos saem daqui: o número foi digitado nos campos seguros do
  // Mercado Pago. Os 4 dígitos são só para exibição (o Mercado Pago não os devolve na troca) e a função os
  // confere. A função confere no servidor que quem chama é o Gerente da barbearia; o front não manda
  // barbearia nem assinatura.
  async trocarCartao(token: string, final: string | null = null): Promise<CartaoTrocado> {
    const { data, error } = await supabase.functions.invoke('billing', {
      body: { action: 'trocar_cartao', cardToken: token, ...(final ? { cardLast4: final } : {}) },
    });

    if (error) {
      throw new Error(await mensagemDaFalha(error, MENSAGEM_TROCAR_CARTAO_FALHOU));
    }

    const resposta = data as RespostaDaCobranca | null;
    if (resposta?.error) throw new Error(resposta.error);
    if (resposta?.changed !== true) throw new Error(MENSAGEM_TROCAR_CARTAO_FALHOU);

    return { bandeira: resposta.cardBrand ?? null, final: resposta.cardLast4 ?? null };
  }

  // A Public Key não é segredo, mas cada ambiente tem a sua: fica em secret do Supabase e a função
  // de cobrança entrega ao Gerente. A da cobrança avulsa pode ser de outro app (no DEV é).
  async obterChavePublica(uso: UsoDaChavePublica = 'assinatura'): Promise<string> {
    const { data, error } = await supabase.functions.invoke('billing', {
      body: uso === 'cobranca' ? { action: 'chave_publica', uso } : { action: 'chave_publica' },
    });

    const resposta = data as RespostaDaCobranca | null;
    if (error || !resposta?.publicKey) throw new Error(MENSAGEM_FORMULARIO_DO_CARTAO_FALHOU);
    return resposta.publicKey;
  }

  // A função de cobrança calcula a diferença no servidor (e a recusa quando a troca não é possível); o front não manda
  // barbearia nem valor, só o plano, então não há como cotar ou trocar a assinatura de outra barbearia.
  async cotarTrocaDePlano(planoId: string): Promise<CotacaoDaTroca> {
    const { data, error } = await supabase.functions.invoke('billing', {
      body: { action: 'cotar_troca_de_plano', planId: planoId },
    });

    if (error) {
      throw new Error(await mensagemDaFalha(error, MENSAGEM_COTAR_TROCA_FALHOU));
    }

    const resposta = data as RespostaDaCobranca | null;
    if (resposta?.error) throw new Error(resposta.error);
    const modo = resposta?.mode ? MODOS_DA_TROCA[resposta.mode] : undefined;
    if (
      !resposta || !modo || typeof resposta.difference !== 'number' || typeof resposta.newMonthlyAmount !== 'number' ||
      !resposta.planName
    ) {
      throw new Error(MENSAGEM_COTAR_TROCA_FALHOU);
    }

    return {
      modo,
      diferenca: resposta.difference,
      valorMensalNovo: resposta.newMonthlyAmount,
      diasRestantes: resposta.remainingDays ?? null,
      diasDoPeriodo: resposta.periodDays ?? null,
      nomeDoPlano: resposta.planName,
    };
  }

  // Só o token do cartão (digitado nos campos seguros), o valor que o Gerente confirmou e os 4 últimos dígitos saem daqui: o
  // número do cartão nunca passa pelo Navalhado, e a função cobra o valor que ela mesma calcula (recusa se o confirmado mudou).
  async trocarDePlano(planoId: string, pagamento?: PagamentoDaTroca): Promise<PlanoTrocado> {
    const { data, error } = await supabase.functions.invoke('billing', {
      body: {
        action: 'trocar_plano',
        planId: planoId,
        ...(pagamento
          ? {
            cardToken: pagamento.token,
            expectedAmount: pagamento.valorConfirmado,
            ...(pagamento.final ? { cardLast4: pagamento.final } : {}),
          }
          : {}),
      },
    });

    if (error) {
      throw new Error(await mensagemDaFalha(error, MENSAGEM_TROCAR_PLANO_FALHOU));
    }

    const resposta = data as RespostaDaCobranca | null;
    if (resposta?.error) throw new Error(resposta.error);
    if (resposta?.changed !== true || !resposta.planId || !resposta.planName) throw new Error(MENSAGEM_TROCAR_PLANO_FALHOU);

    return {
      planoId: resposta.planId,
      nomeDoPlano: resposta.planName,
      cobrado: Number(resposta.charged ?? 0),
      valorMensalNovo: Number(resposta.newMonthlyAmount),
      proximaCobrancaAtualizada: resposta.nextChargeUpdated !== false,
    };
  }

  // A barbearia tem uma única assinatura (unique por tenant_id). A RLS só entrega a linha ao
  // Gerente da própria barbearia; o filtro por tenant também vale para o Proprietário, que lê todas.
  async obterAssinatura(tenantId: string): Promise<DetalhesDaAssinatura | null> {
    const { data, error } = await supabase
      .from('tenant_subscriptions')
      .select('status, trial_ends_at, current_period_end, courtesy_ends_at, card_brand, card_last4, plans!tenant_subscriptions_plan_id_fkey(id, name, price)')
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
      plano: { id: plano.id, nome: plano.name, preco: Number(plano.price) },
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
