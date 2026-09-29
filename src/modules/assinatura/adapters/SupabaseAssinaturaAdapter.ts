import { supabase } from '../../../lib/supabase';
import { MENSAGEM_ASSINAR_FALHOU } from '../errors';
import type { AssinaturaCriada, EstadoDeAcesso, IAssinaturaAdapter, MotivoDeAcesso, NivelDeAcesso } from '../types';

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

interface RespostaDaCobranca {
  paymentLink?: string;
  subscriptionId?: string;
  firstChargeAt?: string | null;
  error?: string;
}

/** A função recusa com `{ error: "mensagem para o Gerente" }`; sem ela, um texto claro. */
const mensagemDaFalha = async (error: { context?: { json?: () => Promise<unknown> } } | null): Promise<string> => {
  try {
    const corpo = (await error?.context?.json?.()) as RespostaDaCobranca | undefined;
    if (corpo?.error) return corpo.error;
  } catch {
    // Sem corpo legível: vale o texto padrão.
  }
  return MENSAGEM_ASSINAR_FALHOU;
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
}
