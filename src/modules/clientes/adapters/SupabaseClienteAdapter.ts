import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Cliente,
  ClienteInputData,
  HistoricoVisitasCliente,
  ComandaHistoricoCliente,
  IClienteAdapter,
} from '../types';

export class SupabaseClienteAdapter implements IClienteAdapter {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  private preparePayload(input: ClienteInputData) {
    return {
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      notes: input.notes || null,
      cadastro_completo: input.cadastro_completo ?? true,
      birth_date: input.birth_date || null,
      tags: input.tags || [],
      acquisition_channel: input.acquisition_channel || null,
      cpf: input.cpf || null,
    };
  }

  async listarPorTenant(tenantId: string): Promise<Cliente[]> {
    const { data, error } = await this.supabase
      .from('customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name');

    if (error) throw error;
    return (data || []).map((row: any) => ({
      ...row,
      tags: row.tags || [],
    }));
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
      return { ...data, tags: data.tags || [] };
    } else {
      const { data, error } = await this.supabase
        .from('customers')
        .insert({
          tenant_id: tenantId,
          registration_origin: input.registration_origin || 'balcao',
          ...payload,
        })
        .select()
        .single();

      if (error) throw error;
      return { ...data, tags: data.tags || [] };
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
        service_price: Number(service?.price ?? 0),
        professional_name: professional?.name || 'Barbeiro',
      };
    });
  }

  async buscarHistoricoComandas(tenantId: string, clienteId: string): Promise<ComandaHistoricoCliente[]> {
    const { data, error } = await this.supabase
      .from('comandas')
      .select(`
        id,
        status,
        total_amount,
        discount_amount,
        tip_amount,
        closed_at,
        created_at,
        comanda_itens (
          id,
          quantity,
          unit_price,
          item_type,
          services ( name ),
          products ( name )
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('customer_id', clienteId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any, index: number) => {
      const totalFinal =
        Number(row.total_amount || 0) - Number(row.discount_amount || 0) + Number(row.tip_amount || 0);

      return {
        id: row.id,
        comanda_number: index + 1,
        status: row.status,
        total_final: totalFinal,
        closed_at: row.closed_at,
        created_at: row.created_at,
        items: (row.comanda_itens || []).map((item: any) => {
          const svc = Array.isArray(item.services) ? item.services[0] : item.services;
          const prd = Array.isArray(item.products) ? item.products[0] : item.products;
          return {
            id: item.id,
            name: svc?.name || prd?.name || 'Item',
            quantity: item.quantity,
            unit_price: Number(item.unit_price || 0),
            item_type: item.item_type,
          };
        }),
      };
    });
  }
}

