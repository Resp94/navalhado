import { supabase } from '../../../lib/supabase';
import type { EstadoDeAcesso, IAssinaturaAdapter, MotivoDeAcesso, NivelDeAcesso } from '../types';

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
}
