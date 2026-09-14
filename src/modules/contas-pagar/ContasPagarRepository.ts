import type {
  AlertaContasPagar,
  Baixa,
  ContaPagar,
  ContaPagarDetalhe,
  DadosBaixa,
  DadosContaPagarAvulsa,
  DadosEdicaoContaPagar,
  FiltroListaContasPagar,
  FiltroTotaisContasPagar,
  IContasPagarAdapter,
  ListaContasPagarResultado,
  TotaisContasPagar,
} from './types';

/** Erro de validação de entrada do módulo Contas a Pagar, com mensagem em português. */
export class ContasPagarValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContasPagarValidationError';
  }
}

const DESCRICAO_MIN = 2;
const DESCRICAO_MAX = 200;
const DOCUMENTO_MAX = 60;
const NOTES_MAX = 500;
const PAGE_SIZE_PADRAO = 20;
const PAGE_SIZE_MAX = 100;
const MOTIVO_MIN = 5;
const FORMAS_PAGAMENTO_BAIXA = [
  'cash',
  'pix',
  'transfer',
  'boleto',
  'credit_card',
  'debit_card',
  'automatic_debit',
  'other',
] as const;

/**
 * Repositório de Contas a Pagar (ticket 06/036): valida entrada, normaliza
 * texto (aparo de pontas, colapso de espaços internos na descrição — mesmo
 * padrão do Plano de Contas) e delega ao adaptador injetado. A RPC do banco é
 * a autoridade final (categoria ativa, fornecedor ativo, competência),
 * então este repositório valida só o que evita uma viagem ao servidor com
 * dado obviamente inválido.
 */
export class ContasPagarRepository {
  private readonly adapter: IContasPagarAdapter;

  constructor(adapter: IContasPagarAdapter) {
    this.adapter = adapter;
  }

  /** Validação comum a lançamento avulso e edição: descrição, categoria, valor, vencimento, documento e observação. */
  private validarCamposComuns(dados: DadosContaPagarAvulsa | DadosEdicaoContaPagar) {
    const description = (dados.description || '').replace(/\s+/g, ' ').trim();
    if (description.length < DESCRICAO_MIN || description.length > DESCRICAO_MAX) {
      throw new ContasPagarValidationError(
        `A descrição deve ter entre ${DESCRICAO_MIN} e ${DESCRICAO_MAX} caracteres.`
      );
    }

    if (!dados.categoryId) {
      throw new ContasPagarValidationError('Categoria de despesa é obrigatória.');
    }

    if (dados.amount == null || Number.isNaN(dados.amount) || dados.amount <= 0) {
      throw new ContasPagarValidationError('O valor deve ser maior que zero.');
    }

    if (!dados.dueDate) {
      throw new ContasPagarValidationError('Vencimento é obrigatório.');
    }

    const documentNumber = (dados.documentNumber || '').trim();
    if (documentNumber.length > DOCUMENTO_MAX) {
      throw new ContasPagarValidationError(
        `Número do documento deve ter no máximo ${DOCUMENTO_MAX} caracteres.`
      );
    }

    const notes = (dados.notes || '').trim();
    if (notes.length > NOTES_MAX) {
      throw new ContasPagarValidationError(`Observação deve ter no máximo ${NOTES_MAX} caracteres.`);
    }

    return {
      description,
      amount: Math.round(dados.amount * 100) / 100,
      documentNumber: documentNumber || null,
      notes: notes || null,
    };
  }

  async criarContaAvulsa(tenantId: string, dados: DadosContaPagarAvulsa): Promise<ContaPagar> {
    if (!tenantId) {
      throw new ContasPagarValidationError('Unidade é obrigatória.');
    }

    const { description, amount, documentNumber, notes } = this.validarCamposComuns(dados);

    return this.adapter.criarContaAvulsa(tenantId, {
      description,
      categoryId: dados.categoryId,
      amount,
      dueDate: dados.dueDate,
      supplierId: dados.supplierId || null,
      competenceDate: dados.competenceDate || null,
      documentNumber,
      notes,
    });
  }

  async listarContas(
    tenantId: string,
    filtro: FiltroListaContasPagar = {}
  ): Promise<ListaContasPagarResultado> {
    if (!tenantId) {
      throw new ContasPagarValidationError('Unidade é obrigatória.');
    }

    const page = filtro.page && filtro.page > 0 ? Math.floor(filtro.page) : 1;
    const pageSize = filtro.pageSize
      ? Math.min(Math.max(Math.floor(filtro.pageSize), 1), PAGE_SIZE_MAX)
      : PAGE_SIZE_PADRAO;

    return this.adapter.listarContas(tenantId, {
      dueDateFrom: filtro.dueDateFrom || null,
      dueDateTo: filtro.dueDateTo || null,
      status: filtro.status || 'not_cancelled',
      page,
      pageSize,
      categoryId: filtro.categoryId || null,
      supplierId: filtro.supplierId || null,
    });
  }

  async obterConta(tenantId: string, payableId: string): Promise<ContaPagarDetalhe> {
    if (!tenantId) {
      throw new ContasPagarValidationError('Unidade é obrigatória.');
    }
    if (!payableId) {
      throw new ContasPagarValidationError('Conta a pagar é obrigatória.');
    }

    return this.adapter.obterConta(tenantId, payableId);
  }

  async darBaixa(tenantId: string, payableId: string, dados: DadosBaixa): Promise<Baixa> {
    if (!tenantId) {
      throw new ContasPagarValidationError('Unidade é obrigatória.');
    }
    if (!payableId) {
      throw new ContasPagarValidationError('Conta a pagar é obrigatória.');
    }

    if (dados.principal == null || Number.isNaN(dados.principal) || dados.principal <= 0) {
      throw new ContasPagarValidationError('O principal deve ser maior que zero.');
    }

    const interestAmount = dados.interestAmount ?? 0;
    if (Number.isNaN(interestAmount) || interestAmount < 0) {
      throw new ContasPagarValidationError('Juros e multa não podem ser negativos.');
    }

    const discountAmount = dados.discountAmount ?? 0;
    if (Number.isNaN(discountAmount) || discountAmount < 0) {
      throw new ContasPagarValidationError('O desconto não pode ser negativo.');
    }
    if (discountAmount > dados.principal + interestAmount) {
      throw new ContasPagarValidationError('O desconto não pode exceder o principal mais os juros.');
    }

    if (!dados.paymentDate) {
      throw new ContasPagarValidationError('Data do pagamento é obrigatória.');
    }

    if (!FORMAS_PAGAMENTO_BAIXA.includes(dados.paymentMethod)) {
      throw new ContasPagarValidationError('Forma de pagamento inválida.');
    }

    const source = dados.source ?? 'fora_do_caixa';
    if (source === 'gaveta') {
      throw new ContasPagarValidationError('Baixa pela gaveta ainda não está disponível.');
    }

    return this.adapter.darBaixa(tenantId, payableId, {
      principal: Math.round(dados.principal * 100) / 100,
      paymentDate: dados.paymentDate,
      paymentMethod: dados.paymentMethod,
      interestAmount: Math.round(interestAmount * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      source,
      cashSessionId: dados.cashSessionId ?? null,
    });
  }

  async estornarBaixa(tenantId: string, settlementId: string, motivo: string): Promise<Baixa> {
    if (!tenantId) {
      throw new ContasPagarValidationError('Unidade é obrigatória.');
    }
    if (!settlementId) {
      throw new ContasPagarValidationError('Baixa é obrigatória.');
    }

    const motivoNormalizado = (motivo || '').trim();
    if (motivoNormalizado.length < MOTIVO_MIN) {
      throw new ContasPagarValidationError(
        `Informe um motivo com pelo menos ${MOTIVO_MIN} caracteres.`
      );
    }

    return this.adapter.estornarBaixa(tenantId, settlementId, motivoNormalizado);
  }

  async listarBaixas(tenantId: string, payableId: string): Promise<Baixa[]> {
    if (!tenantId) {
      throw new ContasPagarValidationError('Unidade é obrigatória.');
    }
    if (!payableId) {
      throw new ContasPagarValidationError('Conta a pagar é obrigatória.');
    }

    return this.adapter.listarBaixas(tenantId, payableId);
  }

  async editarConta(
    tenantId: string,
    payableId: string,
    dados: DadosEdicaoContaPagar
  ): Promise<ContaPagar> {
    if (!tenantId) {
      throw new ContasPagarValidationError('Unidade é obrigatória.');
    }
    if (!payableId) {
      throw new ContasPagarValidationError('Conta a pagar é obrigatória.');
    }

    const { description, amount, documentNumber, notes } = this.validarCamposComuns(dados);

    return this.adapter.editarConta(tenantId, payableId, {
      description,
      categoryId: dados.categoryId,
      amount,
      dueDate: dados.dueDate,
      supplierId: dados.supplierId || null,
      competenceDate: dados.competenceDate || null,
      documentNumber,
      notes,
    });
  }

  async cancelarConta(tenantId: string, payableId: string, motivo: string): Promise<ContaPagar> {
    if (!tenantId) {
      throw new ContasPagarValidationError('Unidade é obrigatória.');
    }
    if (!payableId) {
      throw new ContasPagarValidationError('Conta a pagar é obrigatória.');
    }

    const motivoNormalizado = (motivo || '').trim();
    if (motivoNormalizado.length < MOTIVO_MIN) {
      throw new ContasPagarValidationError(
        `Informe um motivo com pelo menos ${MOTIVO_MIN} caracteres.`
      );
    }

    return this.adapter.cancelarConta(tenantId, payableId, motivoNormalizado);
  }

  async obterTotais(
    tenantId: string,
    filtro: FiltroTotaisContasPagar = {}
  ): Promise<TotaisContasPagar> {
    if (!tenantId) {
      throw new ContasPagarValidationError('Unidade é obrigatória.');
    }

    return this.adapter.obterTotais(tenantId, {
      dueDateFrom: filtro.dueDateFrom || null,
      dueDateTo: filtro.dueDateTo || null,
      categoryId: filtro.categoryId || null,
      supplierId: filtro.supplierId || null,
    });
  }

  async obterAlerta(tenantId: string): Promise<AlertaContasPagar> {
    if (!tenantId) {
      throw new ContasPagarValidationError('Unidade é obrigatória.');
    }

    return this.adapter.obterAlerta(tenantId);
  }
}
