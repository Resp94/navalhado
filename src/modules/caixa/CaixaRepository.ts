import type {
  AbrirCaixaInput,
  CashMovement,
  CashSession,
  DailyFinancialSummary,
  DailyFinancialSummaryQuery,
  FecharCaixaInput,
  ICaixaAdapter,
  RegistrarMovimentacaoInput,
  TurnPaymentsSummary,
} from './types';

export class CaixaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CaixaValidationError';
  }
}

export class CaixaRepository {
  private adapter: ICaixaAdapter;

  constructor(adapter: ICaixaAdapter) {
    this.adapter = adapter;
  }

  async getActiveSession(tenantId: string): Promise<CashSession | null> {
    if (!tenantId || !tenantId.trim()) {
      throw new CaixaValidationError('ID da barbearia (tenant) é obrigatório.');
    }
    return await this.adapter.obterSessaoAtiva(tenantId);
  }

  async isCashierOpen(tenantId: string): Promise<boolean> {
    const session = await this.getActiveSession(tenantId);
    return session !== null && session.status === 'open';
  }

  async openSession(input: AbrirCaixaInput): Promise<CashSession> {
    if (!input.tenant_id || !input.tenant_id.trim()) {
      throw new CaixaValidationError('ID da barbearia (tenant) é obrigatório.');
    }
    if (input.initial_amount < 0) {
      throw new CaixaValidationError('O fundo de troco inicial não pode ser negativo.');
    }

    const active = await this.adapter.obterSessaoAtiva(input.tenant_id);
    if (active) {
      throw new CaixaValidationError('Já existe uma sessão de caixa aberta para esta barbearia.');
    }

    return await this.adapter.abrirCaixa(input);
  }

  async closeSession(input: FecharCaixaInput): Promise<CashSession> {
    if (!input.session_id || !input.session_id.trim()) {
      throw new CaixaValidationError('ID da sessão de caixa é obrigatório.');
    }
    if (input.closing_amount < 0) {
      throw new CaixaValidationError('O valor de fechamento não pode ser negativo.');
    }

    return await this.adapter.fecharCaixa(input);
  }

  async listHistory(tenantId: string, limit = 20): Promise<CashSession[]> {
    if (!tenantId || !tenantId.trim()) {
      throw new CaixaValidationError('ID da barbearia (tenant) é obrigatório.');
    }

    return await this.adapter.listarHistorico(tenantId, limit);
  }

  async getCashReceiptsSince(tenantId: string, sinceDate: string, sessionId?: string): Promise<number> {
    if (!tenantId || !tenantId.trim()) {
      throw new CaixaValidationError('ID da barbearia (tenant) é obrigatório.');
    }
    if (!sinceDate && !sessionId) {
      return 0;
    }
    return await this.adapter.obterEntradasDinheiro(tenantId, sinceDate, sessionId);
  }

  async getTurnPaymentsSummary(tenantId: string, sinceDate: string, sessionId?: string): Promise<TurnPaymentsSummary> {
    if (!tenantId || !tenantId.trim()) {
      throw new CaixaValidationError('ID da barbearia (tenant) é obrigatório.');
    }
    if (!sinceDate && !sessionId) {
      return { total: 0, dinheiro: 0, pix: 0, cartao: 0, outros: 0, count: 0 };
    }
    return await this.adapter.obterResumoTurno(tenantId, sinceDate, sessionId);
  }

  async getDailyFinancialSummary(query: DailyFinancialSummaryQuery): Promise<DailyFinancialSummary[]> {
    if (!query.tenantId || !query.tenantId.trim()) {
      throw new CaixaValidationError('ID da barbearia (tenant) é obrigatório.');
    }
    if (!query.startDate || !query.endDate || query.startDate > query.endDate) {
      throw new CaixaValidationError('O período financeiro diário é inválido.');
    }
    if (!query.timeZone || !query.timeZone.trim()) {
      throw new CaixaValidationError('O fuso horário da barbearia é obrigatório.');
    }

    return await this.adapter.obterResumoFinanceiroDiario(query);
  }

  async registerMovement(input: RegistrarMovimentacaoInput): Promise<CashMovement> {
    if (!input.tenant_id || !input.tenant_id.trim()) {
      throw new CaixaValidationError('ID da barbearia (tenant) é obrigatório.');
    }
    if (!input.cash_session_id || !input.cash_session_id.trim()) {
      throw new CaixaValidationError('ID da sessão de caixa é obrigatório.');
    }
    if (input.amount <= 0) {
      throw new CaixaValidationError('O valor da movimentação deve ser maior que zero.');
    }
    if (!input.reason || !input.reason.trim()) {
      throw new CaixaValidationError('O motivo da movimentação é obrigatório.');
    }

    return await this.adapter.registrarMovimentacao(input);
  }

  async listMovements(sessionId: string): Promise<CashMovement[]> {
    if (!sessionId || !sessionId.trim()) {
      throw new CaixaValidationError('ID da sessão de caixa é obrigatório.');
    }
    return await this.adapter.listarMovimentacoes(sessionId);
  }

  async getMovementsSummary(sessionId: string): Promise<{ suprimentos: number; sangrias: number }> {
    if (!sessionId || !sessionId.trim()) {
      return { suprimentos: 0, sangrias: 0 };
    }
    return await this.adapter.obterResumoMovimentacoes(sessionId);
  }

  // Aliases para compatibilidade total (pt-BR e en)
  async obterSessaoAtiva(tenantId: string): Promise<CashSession | null> {
    return await this.getActiveSession(tenantId);
  }

  async abrirCaixa(input: AbrirCaixaInput): Promise<CashSession> {
    return await this.openSession(input);
  }

  async fecharCaixa(input: FecharCaixaInput): Promise<CashSession> {
    return await this.closeSession(input);
  }

  async listarHistorico(tenantId: string, limit = 20): Promise<CashSession[]> {
    return await this.listHistory(tenantId, limit);
  }

  async isCaixaAberto(tenantId: string): Promise<boolean> {
    return await this.isCashierOpen(tenantId);
  }

  async obterEntradasDinheiro(tenantId: string, sinceDate: string, sessionId?: string): Promise<number> {
    return await this.getCashReceiptsSince(tenantId, sinceDate, sessionId);
  }

  async registrarMovimentacao(input: RegistrarMovimentacaoInput): Promise<CashMovement> {
    return await this.registerMovement(input);
  }

  async listarMovimentacoes(sessionId: string): Promise<CashMovement[]> {
    return await this.listMovements(sessionId);
  }

  async obterResumoMovimentacoes(sessionId: string): Promise<{ suprimentos: number; sangrias: number }> {
    return await this.getMovementsSummary(sessionId);
  }

  async obterResumoFinanceiroDiario(query: DailyFinancialSummaryQuery): Promise<DailyFinancialSummary[]> {
    return await this.getDailyFinancialSummary(query);
  }
}

/**
 * Função de domínio pura para calcular o saldo esperado em gaveta física de dinheiro.
 */
export function calculateExpectedDrawerCash(
  initialAmount: number,
  cashReceipts: number,
  suprimentos: number = 0,
  sangrias: number = 0
): number {
  return Number(initialAmount || 0) + Number(cashReceipts || 0) + Number(suprimentos || 0) - Number(sangrias || 0);
}

