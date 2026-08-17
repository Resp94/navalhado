import type {
  Cliente,
  ClienteInputData,
  IClienteAdapter,
  HistoricoVisitasCliente,
  ComandaHistoricoCliente,
  MetricasLTVCliente,
} from './types';

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
  private adapter: IClienteAdapter;

  constructor(adapter: IClienteAdapter) {
    this.adapter = adapter;
  }

  async listByTenant(tenantId: string): Promise<Cliente[]> {
    if (!tenantId || !tenantId.trim()) {
      throw new ClienteValidationError('ID da barbearia (tenant) é obrigatório.');
    }
    const list = await this.adapter.listarPorTenant(tenantId);
    return list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  async list(tenantId: string): Promise<Cliente[]> {
    return this.listByTenant(tenantId);
  }

  async saveCustomer(tenantId: string, input: ClienteInputData): Promise<Cliente> {
    if (!tenantId || !tenantId.trim()) {
      throw new ClienteValidationError('ID da barbearia (tenant) é obrigatório.');
    }
    if (!input.name || !input.name.trim()) {
      throw new ClienteValidationError('O nome do cliente é obrigatório.');
    }
    if (!input.phone || !input.phone.trim()) {
      throw new ClienteValidationError('O telefone é obrigatório.');
    }

    const digitsOnly = input.phone.replace(/\D/g, '');
    if (digitsOnly.length < 8) {
      throw new ClienteValidationError('O formato do telefone informado é inválido.');
    }

    if (input.email && input.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(input.email.trim())) {
        throw new ClienteValidationError('O formato do e-mail informado é inválido.');
      }
    }

    const payload: ClienteInputData = {
      ...input,
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email ? input.email.trim().toLowerCase() : null,
      notes: input.notes ? input.notes.trim() : null,
      cadastro_completo: input.cadastro_completo ?? true,
      birth_date: input.birth_date ? input.birth_date.trim() : null,
      tags: Array.isArray(input.tags) ? input.tags : [],
      acquisition_channel: input.acquisition_channel ? input.acquisition_channel.trim() : null,
      cpf: input.cpf ? input.cpf.trim() : null,
    };

    return await this.adapter.salvarCliente(tenantId, payload);
  }

  async save(tenantId: string, input: ClienteInputData): Promise<Cliente> {
    return this.saveCustomer(tenantId, input);
  }

  async saveProvisionalCustomer(tenantId: string, input: { name: string; phone: string }): Promise<Cliente> {
    if (!tenantId || !tenantId.trim()) {
      throw new ClienteValidationError('ID da barbearia (tenant) é obrigatório.');
    }
    if (!input.name || !input.name.trim()) {
      throw new ClienteValidationError('O nome do cliente é obrigatório.');
    }
    if (!input.phone || !input.phone.trim()) {
      throw new ClienteValidationError('O telefone é obrigatório.');
    }

    const digitsOnly = input.phone.replace(/\D/g, '');
    if (digitsOnly.length < 8) {
      throw new ClienteValidationError('O formato do telefone informado é inválido.');
    }

    return await this.adapter.salvarCliente(tenantId, {
      name: input.name.trim(),
      phone: input.phone.trim(),
      cadastro_completo: false, // Cliente provisório de balcão
    });
  }

  async deleteCustomer(tenantId: string, customerId: string): Promise<void> {
    if (!customerId) {
      throw new ClienteValidationError('ID do cliente é obrigatório para exclusão.');
    }
    try {
      await this.adapter.excluirCliente(tenantId, customerId);
    } catch (error: any) {
      if (error?.code === '23503') {
        throw new ClienteConstraintError('Este cliente não pode ser excluído porque possui agendamentos registrados no histórico.');
      }
      throw error;
    }
  }

  async getHistoricoVisitas(customerId: string): Promise<HistoricoVisitasCliente[]> {
    if (!customerId) return [];
    return await this.adapter.buscarHistoricoVisitas(customerId);
  }

  async getHistoricoComandas(tenantId: string, customerId: string): Promise<ComandaHistoricoCliente[]> {
    if (!customerId) return [];
    return await this.adapter.buscarHistoricoComandas(tenantId, customerId);
  }

  calculateLTV(
    customerId: string,
    appointments: HistoricoVisitasCliente[],
    comandas: ComandaHistoricoCliente[]
  ): MetricasLTVCliente {
    if (!customerId) {
      return { totalSpend: 0, averageTicket: 0, totalVisits: 0, averageDaysBetweenVisits: 0, lastVisitDate: null };
    }
    return this.adapter.calcularMetricasLTV(customerId, appointments || [], comandas || []);
  }
}
