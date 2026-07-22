import type { Cliente, ClienteInputData, HistoricoVisitasCliente, IClienteAdapter } from '../types';

export class InMemoryClienteAdapter implements IClienteAdapter {
  private customers: Cliente[] = [];
  private appointmentsMap: Record<string, HistoricoVisitasCliente[]> = {};

  constructor(initialCustomers: Cliente[] = [], initialAppointments: Record<string, HistoricoVisitasCliente[]> = {}) {
    this.customers = [...initialCustomers];
    this.appointmentsMap = { ...initialAppointments };
  }

  async fetchCustomersByTenant(tenantId: string): Promise<Cliente[]> {
    return this.customers.filter((c) => c.tenant_id === tenantId);
  }

  async saveCustomer(tenantId: string, input: ClienteInputData): Promise<Cliente> {
    if (input.id) {
      const index = this.customers.findIndex((c) => c.id === input.id);
      if (index >= 0) {
        const existing = this.customers[index];
        const updated: Cliente = {
          ...existing,
          name: input.name,
          phone: input.phone,
          email: input.email ?? existing.email,
          notes: input.notes ?? existing.notes,
          cadastro_completo: input.cadastro_completo ?? true,
        };
        this.customers[index] = updated;
        return updated;
      }
    }

    const newCustomer: Cliente = {
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

    this.customers.push(newCustomer);
    return newCustomer;
  }

  async deleteCustomer(tenantId: string, customerId: string): Promise<void> {
    this.customers = this.customers.filter((c) => !(c.id === customerId && c.tenant_id === tenantId));
  }

  async fetchAppointmentHistory(customerId: string): Promise<HistoricoVisitasCliente[]> {
    return this.appointmentsMap[customerId] || [];
  }
}
