import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cliente, ClienteInputData, HistoricoVisitasCliente, IClienteAdapter } from '../types';

export class SupabaseClienteAdapter implements IClienteAdapter {
  constructor(private supabase: SupabaseClient) {}

  async fetchCustomersByTenant(tenantId: string): Promise<Cliente[]> {
    const { data, error } = await this.supabase
      .from('customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name');

    if (error) throw error;
    return data || [];
  }

  async saveCustomer(tenantId: string, input: ClienteInputData): Promise<Cliente> {
    if (input.id) {
      const { data, error } = await this.supabase
        .from('customers')
        .update({
          name: input.name,
          phone: input.phone,
          email: input.email || null,
          notes: input.notes || null,
          cadastro_completo: input.cadastro_completo ?? true,
        })
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
          name: input.name,
          phone: input.phone,
          email: input.email || null,
          notes: input.notes || null,
          cadastro_completo: input.cadastro_completo ?? true,
          token_acesso: `token_${Math.random().toString(36).substring(2, 9)}`,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }

  async deleteCustomer(tenantId: string, customerId: string): Promise<void> {
    const { error } = await this.supabase
      .from('customers')
      .delete()
      .eq('id', customerId)
      .eq('tenant_id', tenantId);

    if (error) throw error;
  }

  async fetchAppointmentHistory(customerId: string): Promise<HistoricoVisitasCliente[]> {
    const res: any = await this.supabase
      .from('appointments')
      .select(`
        id,
        start_time,
        status,
        payment_status,
        services ( name, price ),
        professionals ( name )
      `)
      .eq('customer_id', customerId)
      .order('start_time', { ascending: false });

    if (res?.error) throw res.error;

    const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);

    return data.map((row: any) => {
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
