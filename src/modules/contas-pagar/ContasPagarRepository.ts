import type {
  ContaPagar,
  DadosContaPagarAvulsa,
  FiltroListaContasPagar,
  IContasPagarAdapter,
  ListaContasPagarResultado,
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

  async criarContaAvulsa(tenantId: string, dados: DadosContaPagarAvulsa): Promise<ContaPagar> {
    if (!tenantId) {
      throw new ContasPagarValidationError('Unidade é obrigatória.');
    }

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

    return this.adapter.criarContaAvulsa(tenantId, {
      description,
      categoryId: dados.categoryId,
      amount: Math.round(dados.amount * 100) / 100,
      dueDate: dados.dueDate,
      supplierId: dados.supplierId || null,
      competenceDate: dados.competenceDate || null,
      documentNumber: documentNumber || null,
      notes: notes || null,
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
    });
  }
}
