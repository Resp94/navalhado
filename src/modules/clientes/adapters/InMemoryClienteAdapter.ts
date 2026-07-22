import type { Customer, CustomerAppointmentHistory, CustomerInputData, IClienteAdapter } from '../types';

export class InMemoryClienteAdapter implements IClienteAdapter {
  private customers: Customer[] = [];
  private appointmentsMap: Record<string, CustomerAppointmentHistory[]> = {};

  constructor(initialCustomers: Customer[] = [], initialAppointments: Record<string, CustomerAppointmentHistory[]> = {}) {
    this.customers = [...initialCustomers];
    this.appointmentsMap = { ...initialAppointments };
  }

  async fetchCustomersByTenant(tenantId: string): Promise<Customer[]> {
    return this.customers.filter((c) => c.tenant_id === tenantId);
  }

  async saveCustomer(tenantId: string, input: CustomerInputData): Promise<Customer> {
    if (input.id) {
      const index = this.customers.findIndex((c) => c.id === input.id);
      if (index >= 0) {
        const existing = this.customers[index];
        const updated: Customer = {
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

    const newCustomer: Customer = {
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

  async fetchAppointmentHistory(customerId: string): Promise<CustomerAppointmentHistory[]> {
    return this.appointmentsMap[customerId] || [];
  }
}
