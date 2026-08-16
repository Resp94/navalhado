import type { AbrirCaixaInput, CashSession, FecharCaixaInput, ICaixaAdapter } from './types';

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
}
