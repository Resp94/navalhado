import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultClient } from '../../../lib/supabase';
import type { IEsperaAdapter, WaitingListEntry, WaitingListStatus } from '../types';

interface DbWaitingListRow {
  id: string;
  tenant_id: string;
  customer_id?: string | null;
  name: string;
  phone: string;
  service_id?: string | null;
  professional_id?: string | null;
  status: 'waiting' | 'scheduled' | 'expired' | 'canceled';
  created_at: string;
}

export class SupabaseEsperaAdapter implements IEsperaAdapter {
  private client: SupabaseClient;

  constructor(client: SupabaseClient = defaultClient) {
    this.client = client;
  }

  private mapStatusToDb(status: WaitingListStatus): 'waiting' | 'scheduled' | 'canceled' {
    switch (status) {
      case 'atendido':
        return 'scheduled';
      case 'cancelado':
        return 'canceled';
      case 'aguardando':
      default:
        return 'waiting';
    }
  }

  private mapStatusFromDb(status: string): WaitingListStatus {
    switch (status) {
      case 'scheduled':
        return 'atendido';
      case 'canceled':
      case 'expired':
        return 'cancelado';
      case 'waiting':
      default:
        return 'aguardando';
    }
  }

  private mapRowToEntry(row: DbWaitingListRow): WaitingListEntry {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      customer_id: row.customer_id,
      customer_name: row.name,
      customer_phone: row.phone,
      service_id: row.service_id,
      professional_id: row.professional_id,
      status: this.mapStatusFromDb(row.status),
      created_at: row.created_at,
    };
  }

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
    return (data || []).map((row) => this.mapRowToEntry(row as DbWaitingListRow));
  }

  async adicionar(
    entrada: Omit<WaitingListEntry, 'id' | 'created_at' | 'updated_at'>
  ): Promise<WaitingListEntry> {
    const payload = {
      tenant_id: entrada.tenant_id,
      customer_id: entrada.customer_id || null,
      name: entrada.customer_name,
      phone: entrada.customer_phone,
      service_id: entrada.service_id || null,
      professional_id: entrada.professional_id || null,
      status: this.mapStatusToDb(entrada.status),
    };

    const { data, error } = await this.client
      .from('waiting_list')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return this.mapRowToEntry(data as DbWaitingListRow);
  }

  async atualizarStatus(id: string, status: WaitingListStatus): Promise<WaitingListEntry> {
    const dbStatus = this.mapStatusToDb(status);
    const { data, error } = await this.client
      .from('waiting_list')
      .update({ status: dbStatus })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapRowToEntry(data as DbWaitingListRow);
  }

  async remover(id: string): Promise<void> {
    const { error } = await this.client
      .from('waiting_list')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
