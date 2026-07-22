import type { Cliente, ClienteInputData, HistoricoVisitasCliente, IClienteAdapter } from './types';

export class ClienteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClienteValidationError';
  }
}

export class ClienteConstraintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClienteConstraintError';
  }
}

export class ClienteRepository {
  constructor(private adapter: IClienteAdapter) {}

  async listByTenant(tenantId: string): Promise<Cliente[]> {
    const list = await this.adapter.fetchCustomersByTenant(tenantId);
    return list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  // Alias para compatibilidade com código existente
  async getCustomers(tenantId: string): Promise<Cliente[]> {
    return this.listByTenant(tenantId);
  }

  async saveCustomer(tenantId: string, input: ClienteInputData): Promise<Cliente> {
    if (!input.name || !input.name.trim()) {
      throw new ClienteValidationError('O nome do cliente é obrigatório.');
    }
    if (!input.phone || !input.phone.trim()) {
      throw new ClienteValidationError('O telefone é obrigatório.');
    }

    const payload: ClienteInputData = {
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
    try {
      await this.adapter.deleteCustomer(tenantId, customerId);
    } catch (error: any) {
      if (error?.code === '23503') {
        throw new ClienteConstraintError('Este cliente não pode ser excluído porque possui agendamentos registrados no histórico.');
      }
      throw error;
    }
  }

  async getHistoricoVisitas(customerId: string): Promise<HistoricoVisitasCliente[]> {
    if (!customerId) return [];
    return await this.adapter.fetchAppointmentHistory(customerId);
  }
}
