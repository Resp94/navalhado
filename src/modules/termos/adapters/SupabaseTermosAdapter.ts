import type { SupabaseClient } from '@supabase/supabase-js';
import { MENSAGEM_ACEITAR_FALHOU } from '../errors';
import type { ITermosAdapter } from '../types';

/**
 * Lê e grava com a sessão de quem está logado. A leitura é da tabela `terms_acceptances`, onde a RLS deixa cada um ver só os
 * próprios aceites; a gravação é pela função `accept_terms`, que age sobre quem chama e é idempotente (a tabela não aceita escrita
 * direta do navegador).
 */
export class SupabaseTermosAdapter implements ITermosAdapter {
  private readonly supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async jaAceitou(versao: string): Promise<boolean> {
    // Sem `user_id` de propósito: quem limita a leitura ao próprio usuário é a RLS (pgTAP 79). Se a política de leitura for
    // alargada (a auditoria do Proprietário, por exemplo), este filtro precisa passar a repetir o `user_id` do usuário logado.
    const { data, error } = await this.supabase.from('terms_acceptances').select('version').eq('version', versao).limit(1);
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }

  async aceitar(versao: string): Promise<void> {
    const { error } = await this.supabase.rpc('accept_terms', { p_version: versao });
    if (error) {
      // O Gerente lê a mensagem padrão, e não o texto do banco; o erro do banco vai para o log (e fica na `cause`).
      console.error('Erro ao gravar o aceite dos termos:', error);
      throw new Error(MENSAGEM_ACEITAR_FALHOU, { cause: error });
    }
  }
}
