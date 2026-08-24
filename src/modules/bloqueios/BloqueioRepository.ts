import type { BlockedSlot, CriarBloqueioInput, IBloqueioAdapter } from './types';

export class BloqueioValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BloqueioValidationError';
  }
}

export class BloqueioRepository {
  private adapter: IBloqueioAdapter;

  constructor(adapter: IBloqueioAdapter) {
    this.adapter = adapter;
  }

  async listByDateRange(tenantId: string, startDateIso: string, endDateIso: string): Promise<BlockedSlot[]> {
    if (!tenantId || !tenantId.trim()) {
      throw new BloqueioValidationError('ID da barbearia (tenant) é obrigatório.');
    }
    return await this.adapter.listarPorData(tenantId, startDateIso, endDateIso);
  }

  async listByDate(tenantId: string, startDateIso: string, endDateIso: string): Promise<BlockedSlot[]> {
    return await this.listByDateRange(tenantId, startDateIso, endDateIso);
  }

  async createBlock(input: CriarBloqueioInput): Promise<BlockedSlot> {
    if (!input.tenant_id || !input.tenant_id.trim()) {
      throw new BloqueioValidationError('ID da barbearia (tenant) é obrigatório.');
    }
    if (!input.professional_id || !input.professional_id.trim()) {
      throw new BloqueioValidationError('ID do profissional é obrigatório.');
    }
    if (!input.start_time || !input.end_time) {
      throw new BloqueioValidationError('Horário de início e fim são obrigatórios.');
    }

    const start = new Date(input.start_time).getTime();
    const end = new Date(input.end_time).getTime();
    if (isNaN(start) || isNaN(end) || end <= start) {
      throw new BloqueioValidationError('O horário de fim deve ser posterior ao horário de início.');
    }

    const payload: CriarBloqueioInput = {
      ...input,
      reason: input.reason?.trim() || 'Bloqueio de Horário',
      is_all_day: input.is_all_day ?? false,
    };

    return await this.adapter.criarBloqueio(payload);
  }

  async deleteBlock(bloqueioId: string, tenantId: string): Promise<void> {
    if (!bloqueioId || !bloqueioId.trim()) {
      throw new BloqueioValidationError('ID do bloqueio é obrigatório.');
    }
    if (!tenantId || !tenantId.trim()) {
      throw new BloqueioValidationError('ID da barbearia (tenant) é obrigatório.');
    }

    return await this.adapter.removerBloqueio(bloqueioId, tenantId);
  }
}
