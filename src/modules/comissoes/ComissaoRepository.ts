import type {
  ConsultarSaldoInput,
  IComissaoAdapter,
  QuitacaoRegistrada,
  RegistrarQuitacaoInput,
  SaldoComissaoProfissional,
} from './types';

export class ComissaoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ComissaoValidationError';
  }
}

export class ComissaoRepository {
  private adapter: IComissaoAdapter;

  constructor(adapter: IComissaoAdapter) {
    this.adapter = adapter;
  }

  async registerPayout(input: RegistrarQuitacaoInput): Promise<QuitacaoRegistrada> {
    if (!input.professional_id || !input.professional_id.trim()) {
      throw new ComissaoValidationError('ID do profissional é obrigatório.');
    }
    if (!input.amount || input.amount <= 0) {
      throw new ComissaoValidationError('O valor do repasse deve ser maior que zero.');
    }
    if (!input.payment_method) {
      throw new ComissaoValidationError('A forma de pagamento é obrigatória.');
    }

    return await this.adapter.registrarQuitacao(input);
  }

  async getProfessionalBalance(input: ConsultarSaldoInput): Promise<SaldoComissaoProfissional> {
    if (!input.professional_id || !input.professional_id.trim()) {
      throw new ComissaoValidationError('ID do profissional é obrigatório.');
    }

    return await this.adapter.obterSaldoProfissional(input);
  }

  // Aliases para compatibilidade (pt-BR e en)
  async registrarQuitacao(input: RegistrarQuitacaoInput): Promise<QuitacaoRegistrada> {
    return await this.registerPayout(input);
  }

  async obterSaldoProfissional(input: ConsultarSaldoInput): Promise<SaldoComissaoProfissional> {
    return await this.getProfessionalBalance(input);
  }
}
