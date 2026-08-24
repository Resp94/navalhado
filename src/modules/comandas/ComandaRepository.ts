import type { Comanda, ComandaItem, CriarComandaInput, IComandaAdapter, LiquidarComandaInput } from './types';

export class ComandaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ComandaValidationError';
  }
}

export class ComandaRepository {
  private adapter: IComandaAdapter;

  constructor(adapter: IComandaAdapter) {
    this.adapter = adapter;
  }

  async getById(comandaId: string): Promise<Comanda | null> {
    if (!comandaId || !comandaId.trim()) {
      throw new ComandaValidationError('ID da comanda é obrigatório.');
    }
    return await this.adapter.obterPorId(comandaId);
  }

  async getByAppointmentId(appointmentId: string): Promise<Comanda | null> {
    if (!appointmentId || !appointmentId.trim()) {
      throw new ComandaValidationError('ID do agendamento é obrigatório.');
    }
    return await this.adapter.obterPorAppointmentId(appointmentId);
  }

  async listOpenComandas(tenantId: string): Promise<Comanda[]> {
    if (!tenantId || !tenantId.trim()) {
      throw new ComandaValidationError('ID da barbearia (tenant) é obrigatório.');
    }
    return await this.adapter.listarAbertas(tenantId);
  }

  async listAll(tenantId: string): Promise<import('./types').ComandaEnriched[]> {
    if (!tenantId || !tenantId.trim()) {
      throw new ComandaValidationError('ID da barbearia (tenant) é obrigatório.');
    }
    return await this.adapter.listarTodas(tenantId);
  }

  async createComanda(input: CriarComandaInput): Promise<Comanda> {
    if (!input.tenant_id || !input.tenant_id.trim()) {
      throw new ComandaValidationError('ID da barbearia (tenant) é obrigatório.');
    }
    if (!input.itens || input.itens.length === 0) {
      throw new ComandaValidationError('A comanda deve conter pelo menos um item.');
    }

    for (const item of input.itens) {
      if (item.quantity <= 0) {
        throw new ComandaValidationError('A quantidade de cada item deve ser maior que zero.');
      }
      if (item.unit_price < 0) {
        throw new ComandaValidationError('O preço unitário do item não pode ser negativo.');
      }
    }

    return await this.adapter.criarComanda(input);
  }

  async addItem(
    comandaId: string,
    tenantId: string,
    item: Omit<ComandaItem, 'id' | 'comanda_id' | 'tenant_id'>
  ): Promise<ComandaItem> {
    if (!comandaId || !comandaId.trim()) {
      throw new ComandaValidationError('ID da comanda é obrigatório.');
    }
    if (!tenantId || !tenantId.trim()) {
      throw new ComandaValidationError('ID da barbearia (tenant) é obrigatório.');
    }
    if (item.quantity <= 0) {
      throw new ComandaValidationError('A quantidade do item deve ser maior que zero.');
    }
    if (item.unit_price < 0) {
      throw new ComandaValidationError('O valor unitário não pode ser negativo.');
    }

    return await this.adapter.adicionarItem(comandaId, tenantId, item);
  }

  async removeItem(itemId: string, comandaId: string): Promise<void> {
    if (!itemId || !itemId.trim() || !comandaId || !comandaId.trim()) {
      throw new ComandaValidationError('IDs de item e comanda são obrigatórios.');
    }
    return await this.adapter.removerItem(itemId, comandaId);
  }

  calculateTotals(
    itens: Array<{ quantity: number; unit_price: number }>,
    discountAmount: number = 0,
    tipAmount: number = 0
  ) {
    const subtotal = itens.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
    const validDiscount = Math.max(0, Math.min(subtotal, discountAmount));
    const validTip = Math.max(0, tipAmount);
    const total = Math.max(0, subtotal - validDiscount + validTip);

    return {
      subtotal: Number(subtotal.toFixed(2)),
      discount: Number(validDiscount.toFixed(2)),
      tip: Number(validTip.toFixed(2)),
      total: Number(total.toFixed(2)),
    };
  }

  calculateChange(amountDue: number, receivedCash: number): number {
    if (receivedCash < amountDue) {
      return 0;
    }
    return Number((receivedCash - amountDue).toFixed(2));
  }

  async settleComanda(input: LiquidarComandaInput): Promise<Comanda> {
    if (!input.comanda_id || !input.comanda_id.trim()) {
      throw new ComandaValidationError('ID da comanda é obrigatório.');
    }
    if (!input.tenant_id || !input.tenant_id.trim()) {
      throw new ComandaValidationError('ID da barbearia é obrigatório.');
    }
    if (!input.pagamentos || input.pagamentos.length === 0) {
      throw new ComandaValidationError('Pelo menos uma forma de pagamento deve ser informada.');
    }

    const totalPago = input.pagamentos.reduce((acc, p) => acc + p.amount, 0);
    if (totalPago <= 0) {
      throw new ComandaValidationError('O valor total pago deve ser maior que zero.');
    }

    return await this.adapter.liquidarComanda(input);
  }

  async reopenComanda(comandaId: string, tenantId: string): Promise<Comanda> {
    if (!comandaId || !comandaId.trim()) {
      throw new ComandaValidationError('ID da comanda é obrigatório.');
    }
    if (!tenantId || !tenantId.trim()) {
      throw new ComandaValidationError('ID da barbearia é obrigatório.');
    }

    return await this.adapter.reabrirComanda(comandaId, tenantId);
  }
}
