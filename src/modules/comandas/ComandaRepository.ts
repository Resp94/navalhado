import type {
  Comanda,
  ComandaItem,
  CriarComandaInput,
  DescontoComanda,
  IComandaAdapter,
  LiquidarComandaInput,
} from './types';

// Arredonda a centavo como o round(numeric, 2) do Postgres (meio para cima).
const roundCents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

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

  // Mesma regra de arredondamento de settle_comanda: cada item a centavo antes
  // de somar; desconto percentual convertido em reais a centavo; desconto em
  // reais limitado ao subtotal. Número puro segue significando desconto em reais.
  calculateTotals(
    itens: Array<{ quantity: number; unit_price: number }>,
    discount: number | DescontoComanda = 0,
    tipAmount: number = 0
  ) {
    const subtotal = itens.reduce((acc, item) => acc + roundCents(item.quantity * item.unit_price), 0);
    const { type, value } = typeof discount === 'number' ? { type: 'amount' as const, value: discount } : discount;
    const validDiscount =
      type === 'percent'
        ? roundCents((subtotal * Math.max(0, Math.min(100, value))) / 100)
        : Math.max(0, Math.min(subtotal, roundCents(value)));
    const validTip = Math.max(0, roundCents(tipAmount));
    const total = Math.max(0, roundCents(subtotal - validDiscount + validTip));

    return {
      subtotal: roundCents(subtotal),
      discount: validDiscount,
      tip: validTip,
      total,
    };
  }

  calculateChange(amountDue: number, receivedCash: number): number {
    if (receivedCash < amountDue) {
      return 0;
    }
    return Number((receivedCash - amountDue).toFixed(2));
  }

  async settleComanda(input: LiquidarComandaInput): Promise<Comanda> {
    if (input.comanda_id !== undefined && input.comanda_id !== null && !input.comanda_id.trim()) {
      throw new ComandaValidationError('ID da comanda inválido.');
    }
    if (!input.tenant_id || !input.tenant_id.trim()) {
      throw new ComandaValidationError('ID da barbearia é obrigatório.');
    }

    if (!input.itens || input.itens.length === 0) {
      throw new ComandaValidationError('A comanda deve conter pelo menos um item.');
    }

    // Comanda de cortesia (desconto integral) fecha com total zero e sem
    // forma de pagamento; qualquer outro total exige pagamento(s) que somem
    // exatamente o valor devido.
    const { total } = this.calculateTotals(
      input.itens,
      input.discount_percent != null
        ? { type: 'percent', value: input.discount_percent }
        : (input.discount_amount ?? 0),
      input.tip_amount ?? 0
    );

    if (total === 0) {
      if (input.pagamentos && input.pagamentos.length > 0) {
        throw new ComandaValidationError(
          'Comanda de cortesia com total zero não deve informar forma de pagamento.'
        );
      }
    } else {
      if (!input.pagamentos || input.pagamentos.length === 0) {
        throw new ComandaValidationError('Pelo menos uma forma de pagamento deve ser informada.');
      }
      const totalPago = input.pagamentos.reduce((acc, p) => acc + p.amount, 0);
      if (totalPago <= 0) {
        throw new ComandaValidationError('O valor total pago deve ser maior que zero.');
      }
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
