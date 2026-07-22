import type { Cliente, ClienteInputData, HistoricoVisitasCliente, IClienteAdapter } from '../types';

export class InMemoryClienteAdapter implements IClienteAdapter {
  private clientes: Cliente[] = [];
  private appointmentsMap: Record<string, HistoricoVisitasCliente[]> = {};

  constructor(initialCustomers: Cliente[] = [], initialAppointments: Record<string, HistoricoVisitasCliente[]> = {}) {
    this.clientes = [...initialCustomers];
    this.appointmentsMap = { ...initialAppointments };
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
          email: input.email ?? existing.email,
          notes: input.notes ?? existing.notes,
          cadastro_completo: input.cadastro_completo ?? true,
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
}
