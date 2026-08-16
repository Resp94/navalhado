import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultClient } from '../../../lib/supabase';
import type { IEsperaAdapter, WaitingListEntry, WaitingListStatus } from '../types';

export class SupabaseEsperaAdapter implements IEsperaAdapter {
  constructor(private client: SupabaseClient = defaultClient) {}

  async listarPorData(tenantId: string, dataIso: string): Promise<WaitingListEntry[]> {
    const startOfDay = `${dataIso}T00:00:00.000Z`;
    const endOfDay = `${dataIso}T23:59:59.999Z`;

    const { data, error } = await this.client
      .from('waiting_list')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as WaitingListEntry[];
  }

  async adicionar(
    entrada: Omit<WaitingListEntry, 'id' | 'created_at' | 'updated_at'>
  ): Promise<WaitingListEntry> {
    const { data, error } = await this.client
      .from('waiting_list')
      .insert(entrada)
      .select()
      .single();

    if (error) throw error;
    return data as WaitingListEntry;
  }

  async atualizarStatus(id: string, status: WaitingListStatus): Promise<WaitingListEntry> {
    const { data, error } = await this.client
      .from('waiting_list')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as WaitingListEntry;
  }

  async remover(id: string): Promise<void> {
    const { error } = await this.client
      .from('waiting_list')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
