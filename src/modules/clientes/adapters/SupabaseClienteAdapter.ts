import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cliente, ClienteInputData, HistoricoVisitasCliente, IClienteAdapter } from '../types';

export class SupabaseClienteAdapter implements IClienteAdapter {
  constructor(private supabase: SupabaseClient) {}

  private preparePayload(input: ClienteInputData) {
    return {
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      notes: input.notes || null,
      cadastro_completo: input.cadastro_completo ?? true,
    };
  }

  async listarPorTenant(tenantId: string): Promise<Cliente[]> {
    const { data, error } = await this.supabase
      .from('customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name');

    if (error) throw error;
    return data || [];
  }

  async salvarCliente(tenantId: string, input: ClienteInputData): Promise<Cliente> {
    const payload = this.preparePayload(input);

    if (input.id) {
      const { data, error } = await this.supabase
        .from('customers')
        .update(payload)
        .eq('id', input.id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      const { data, error } = await this.supabase
        .from('customers')
        .insert({
          tenant_id: tenantId,
          ...payload,
          token_acesso: `token_${Math.random().toString(36).substring(2, 9)}`,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }

  async excluirCliente(tenantId: string, clienteId: string): Promise<void> {
    const { error } = await this.supabase
      .from('customers')
      .delete()
      .eq('id', clienteId)
      .eq('tenant_id', tenantId);

    if (error) throw error;
  }

  async buscarHistoricoVisitas(clienteId: string): Promise<HistoricoVisitasCliente[]> {
    const { data, error } = await this.supabase
      .from('appointments')
      .select(`
        id,
        start_time,
        status,
        payment_status,
        services ( name, price ),
        professionals ( name )
      `)
      .eq('customer_id', clienteId)
      .order('start_time', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => {
      const service = Array.isArray(row.services) ? row.services[0] : row.services;
      const professional = Array.isArray(row.professionals) ? row.professionals[0] : row.professionals;

      return {
        id: row.id,
        start_time: row.start_time,
        status: row.status,
        payment_status: row.payment_status,
        service_name: service?.name || 'Serviço',
        service_price: service?.price ?? 0,
        professional_name: professional?.name || 'Barbeiro',
      };
    });
  }
}
