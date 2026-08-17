import type {
  Cliente,
  ClienteInputData,
  HistoricoVisitasCliente,
  ComandaHistoricoCliente,
  IClienteAdapter,
} from '../types';

export class InMemoryClienteAdapter implements IClienteAdapter {
  private clientes: Cliente[] = [];
  private appointmentsMap: Record<string, HistoricoVisitasCliente[]> = {};
  private comandasMap: Record<string, ComandaHistoricoCliente[]> = {};

  constructor(
    initialCustomers: Cliente[] = [],
    initialAppointments: Record<string, HistoricoVisitasCliente[]> = {},
    initialComandas: Record<string, ComandaHistoricoCliente[]> = {}
  ) {
    this.clientes = [...initialCustomers];
    this.appointmentsMap = { ...initialAppointments };
    this.comandasMap = { ...initialComandas };
  }

  async listarPorTenant(tenantId: string): Promise<Cliente[]> {
    return this.clientes.filter((c) => c.tenant_id === tenantId);
  }

  async salvarCliente(tenantId: string, input: ClienteInputData): Promise<Cliente> {
    if (input.id) {
      const index = this.clientes.findIndex((c) => c.id === input.id);
      if (index >= 0) {
        const existing = this.clientes[index];
        const updated: Cliente = {
          ...existing,
          name: input.name,
          phone: input.phone,
          email: input.email !== undefined ? input.email : existing.email,
          notes: input.notes !== undefined ? input.notes : existing.notes,
          cadastro_completo: input.cadastro_completo ?? existing.cadastro_completo,
          birth_date: input.birth_date !== undefined ? input.birth_date : existing.birth_date,
          tags: input.tags !== undefined ? input.tags : existing.tags,
          acquisition_channel: input.acquisition_channel !== undefined ? input.acquisition_channel : existing.acquisition_channel,
          cpf: input.cpf !== undefined ? input.cpf : existing.cpf,
        };
        this.clientes[index] = updated;
        return updated;
      }
    }

    const newCliente: Cliente = {
      id: input.id || `cust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: tenantId,
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      notes: input.notes || null,
      cadastro_completo: input.cadastro_completo ?? true,
      token_acesso: `token_${Math.random().toString(36).substring(2, 9)}`,
      birth_date: input.birth_date || null,
      tags: input.tags || [],
      acquisition_channel: input.acquisition_channel || null,
      cpf: input.cpf || null,
      created_at: new Date().toISOString(),
    };

    this.clientes.push(newCliente);
    return newCliente;
  }

  async excluirCliente(tenantId: string, clienteId: string): Promise<void> {
    this.clientes = this.clientes.filter((c) => !(c.id === clienteId && c.tenant_id === tenantId));
  }

  async buscarHistoricoVisitas(clienteId: string): Promise<HistoricoVisitasCliente[]> {
    return this.appointmentsMap[clienteId] || [];
  }

  async buscarHistoricoComandas(_tenantId: string, clienteId: string): Promise<ComandaHistoricoCliente[]> {
    return this.comandasMap[clienteId] || [];
  }
}

