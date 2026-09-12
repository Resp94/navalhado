import type {
  EstornarValeInput,
  IContaProfissionalAdapter,
  ProfessionalAccountEntry,
  RegistrarValeInput,
  ValeEstornado,
  ValeRegistrado,
} from './types';

export class ContaProfissionalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContaProfissionalValidationError';
  }
}

/**
 * Módulo profundo da Conta do Profissional (spec 034): extrato de créditos e
 * débitos por profissional, separado da comissão automática de atendimentos.
 * Gorjeta (crédito) nasce de um trigger na Comanda (ticket 04); vale (débito) é
 * lançado aqui pelo gestor (ticket 05).
 */
export class ContaProfissionalRepository {
  private adapter: IContaProfissionalAdapter;

  constructor(adapter: IContaProfissionalAdapter) {
    this.adapter = adapter;
  }

  async registerAdvance(input: RegistrarValeInput): Promise<ValeRegistrado> {
    if (!input.professional_id || !input.professional_id.trim()) {
      throw new ContaProfissionalValidationError('ID do profissional é obrigatório.');
    }
    if (!input.amount || input.amount <= 0) {
      throw new ContaProfissionalValidationError('O valor do vale deve ser maior que zero.');
    }
    if (!input.reason || input.reason.trim().length < 5) {
      throw new ContaProfissionalValidationError('Informe um motivo com pelo menos cinco caracteres.');
    }
    if (!input.payment_method) {
      throw new ContaProfissionalValidationError('A forma de pagamento é obrigatória.');
    }
    if (input.payment_method === 'cash' && !input.cash_session_id) {
      throw new ContaProfissionalValidationError('Informe a sessão de caixa para vale em dinheiro.');
    }
    if (input.payment_method !== 'cash' && input.cash_session_id) {
      throw new ContaProfissionalValidationError('Sessão de caixa só pode ser informada para vale em dinheiro.');
    }

    return await this.adapter.registrarVale(input);
  }

  async reverseAdvance(input: EstornarValeInput): Promise<ValeEstornado> {
    if (!input.entry_id || !input.entry_id.trim()) {
      throw new ContaProfissionalValidationError('ID do vale é obrigatório.');
    }
    if (!input.reason || input.reason.trim().length < 5) {
      throw new ContaProfissionalValidationError('Informe uma justificativa com pelo menos cinco caracteres.');
    }

    return await this.adapter.estornarVale(input);
  }

  async listEntries(professionalId: string, tenantId: string): Promise<ProfessionalAccountEntry[]> {
    if (!professionalId || !professionalId.trim()) {
      throw new ContaProfissionalValidationError('ID do profissional é obrigatório.');
    }
    if (!tenantId || !tenantId.trim()) {
      throw new ContaProfissionalValidationError('ID da barbearia é obrigatório.');
    }

    return await this.adapter.listarLancamentos(professionalId, tenantId);
  }
}
