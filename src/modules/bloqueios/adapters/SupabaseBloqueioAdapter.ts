import { supabase } from '../../../lib/supabase';
import type { BlockedSlot, CriarBloqueioInput, IBloqueioAdapter } from '../types';

export class SupabaseBloqueioAdapter implements IBloqueioAdapter {
  async listarPorData(tenantId: string, dataInicioIso: string, dataFimIso: string): Promise<BlockedSlot[]> {
    const { data, error } = await supabase
      .from('blocked_slots')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('start_time', dataInicioIso)
      .lte('start_time', dataFimIso)
      .order('start_time', { ascending: true });

    if (error) {
      throw new Error(`Erro ao listar bloqueios: ${error.message}`);
    }

    return (data || []) as BlockedSlot[];
  }

  async criarBloqueio(input: CriarBloqueioInput): Promise<BlockedSlot> {
    const { data, error } = await supabase
      .from('blocked_slots')
      .insert({
        tenant_id: input.tenant_id,
        professional_id: input.professional_id,
        start_time: input.start_time,
        end_time: input.end_time,
        reason: input.reason,
        is_all_day: input.is_all_day || false,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Erro ao criar bloqueio: ${error?.message}`);
    }

    return data as BlockedSlot;
  }

  async removerBloqueio(bloqueioId: string, tenantId: string): Promise<void> {
    const { error } = await supabase
      .from('blocked_slots')
      .delete()
      .eq('id', bloqueioId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Erro ao remover bloqueio: ${error.message}`);
    }
  }
}
