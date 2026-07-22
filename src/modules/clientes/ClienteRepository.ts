import type { Customer, CustomerAppointmentHistory, CustomerInputData, CustomerStats, IClienteAdapter } from './types';

export class ClienteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClienteValidationError';
  }
}

export class ClienteRepository {
  constructor(private adapter: IClienteAdapter) {}

  async getCustomers(tenantId: string): Promise<Customer[]> {
    const list = await this.adapter.fetchCustomersByTenant(tenantId);
    return list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  filterCustomers(customers: Customer[], searchTerm: string, filterStatus: 'todos' | 'completos' | 'provisorios'): Customer[] {
    const term = searchTerm.toLowerCase().trim();

    return customers.filter((customer) => {
      const matchesSearch =
        !term ||
        customer.name.toLowerCase().includes(term) ||
        customer.phone.includes(term) ||
        (customer.email && customer.email.toLowerCase().includes(term));

      if (!matchesSearch) return false;

      if (filterStatus === 'completos') return customer.cadastro_completo;
      if (filterStatus === 'provisorios') return !customer.cadastro_completo;

      return true;
    });
  }

  calculateStats(customers: Customer[]): CustomerStats {
    const totalCount = customers.length;
    const completosCount = customers.filter((c) => c.cadastro_completo).length;
    const provisoriosCount = customers.filter((c) => !c.cadastro_completo).length;

    return { totalCount, completosCount, provisoriosCount };
  }

  async saveCustomer(tenantId: string, input: CustomerInputData): Promise<Customer> {
    if (!input.name || !input.name.trim()) {
      throw new ClienteValidationError('O nome do cliente é obrigatório.');
    }
    if (!input.phone || !input.phone.trim()) {
      throw new ClienteValidationError('O telefone é obrigatório.');
    }

    const payload: CustomerInputData = {
      ...input,
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email ? input.email.trim() : null,
      notes: input.notes ? input.notes.trim() : null,
      cadastro_completo: true, // Garante a promoção para cadastro completo ao salvar
    };

    return await this.adapter.saveCustomer(tenantId, payload);
  }

  async deleteCustomer(tenantId: string, customerId: string): Promise<void> {
    if (!customerId) {
      throw new ClienteValidationError('ID do cliente é obrigatório para exclusão.');
    }
    await this.adapter.deleteCustomer(tenantId, customerId);
  }

  async getHistoricoVisitas(customerId: string): Promise<CustomerAppointmentHistory[]> {
    if (!customerId) return [];
    return await this.adapter.fetchAppointmentHistory(customerId);
  }
}
