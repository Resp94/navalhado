import { normalizarNome } from './nome';
import { documentoValido, normalizarDocumento } from './documento';
import type { CategoriaDespesa, DadosFornecedor, Fornecedor, IPlanoContasAdapter } from './types';
import { isValidEmailFormat } from '../../lib/email';

const NOME_MIN = 2;
const NOME_MAX = 60;

const NOME_FORNECEDOR_MIN = 2;
const NOME_FORNECEDOR_MAX = 120;
const NOTES_MAX = 500;

export class PlanoContasValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanoContasValidationError';
  }
}

/**
 * Erro de conflito de nome (ticket 04): carrega o identificador da categoria
 * existente e se ela está arquivada, para que a tela ofereça "Reativar" em
 * vez de só "já existe". Traduzido a partir do erro de banco (violação do
 * índice único, explícita ou sob concorrência) atrás do repositório -- pelos
 * adaptadores, não aqui.
 */
export class PlanoContasConflictError extends Error {
  readonly existingId: string;
  readonly existingName: string;
  readonly archived: boolean;

  constructor(message: string, existingId: string, existingName: string, archived: boolean) {
    super(message);
    this.name = 'PlanoContasConflictError';
    this.existingId = existingId;
    this.existingName = existingName;
    this.archived = archived;
  }
}

/**
 * Repositório do Plano de Contas: valida a entrada e delega ao adaptador.
 * Ticket 04 acrescenta criar, renomear, arquivar e reativar Categoria de
 * Despesa; Fornecedores chegam no ticket 06.
 */
export class PlanoContasRepository {
  private adapter: IPlanoContasAdapter;

  constructor(adapter: IPlanoContasAdapter) {
    this.adapter = adapter;
  }

  async listarCategoriasDespesa(tenantId: string): Promise<CategoriaDespesa[]> {
    this.validarTenantId(tenantId);
    const categorias = await this.adapter.listarCategoriasDespesa(tenantId);
    return [...categorias].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  async criarCategoriaDespesa(tenantId: string, name: string): Promise<CategoriaDespesa> {
    this.validarTenantId(tenantId);
    const nomeNormalizado = this.validarNome(name);
    return this.adapter.criarCategoriaDespesa(tenantId, nomeNormalizado);
  }

  async renomearCategoriaDespesa(
    tenantId: string,
    categoriaId: string,
    name: string
  ): Promise<CategoriaDespesa> {
    this.validarTenantId(tenantId);
    this.validarCategoriaId(categoriaId);
    const nomeNormalizado = this.validarNome(name);
    return this.adapter.renomearCategoriaDespesa(tenantId, categoriaId, nomeNormalizado);
  }

  async arquivarCategoriaDespesa(tenantId: string, categoriaId: string): Promise<CategoriaDespesa> {
    this.validarTenantId(tenantId);
    this.validarCategoriaId(categoriaId);
    return this.adapter.arquivarCategoriaDespesa(tenantId, categoriaId);
  }

  async reativarCategoriaDespesa(tenantId: string, categoriaId: string): Promise<CategoriaDespesa> {
    this.validarTenantId(tenantId);
    this.validarCategoriaId(categoriaId);
    return this.adapter.reativarCategoriaDespesa(tenantId, categoriaId);
  }

  async listarFornecedores(tenantId: string): Promise<Fornecedor[]> {
    this.validarTenantId(tenantId);
    const fornecedores = await this.adapter.listarFornecedores(tenantId);
    return [...fornecedores].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  async criarFornecedor(tenantId: string, dados: DadosFornecedor): Promise<Fornecedor> {
    this.validarTenantId(tenantId);
    const normalizado = this.normalizarDadosFornecedor(dados);
    return this.adapter.criarFornecedor(tenantId, normalizado);
  }

  async atualizarFornecedor(
    tenantId: string,
    fornecedorId: string,
    dados: DadosFornecedor
  ): Promise<Fornecedor> {
    this.validarTenantId(tenantId);
    this.validarFornecedorId(fornecedorId);
    const normalizado = this.normalizarDadosFornecedor(dados);
    return this.adapter.atualizarFornecedor(tenantId, fornecedorId, normalizado);
  }

  async arquivarFornecedor(tenantId: string, fornecedorId: string): Promise<Fornecedor> {
    this.validarTenantId(tenantId);
    this.validarFornecedorId(fornecedorId);
    return this.adapter.arquivarFornecedor(tenantId, fornecedorId);
  }

  async reativarFornecedor(tenantId: string, fornecedorId: string): Promise<Fornecedor> {
    this.validarTenantId(tenantId);
    this.validarFornecedorId(fornecedorId);
    return this.adapter.reativarFornecedor(tenantId, fornecedorId);
  }

  private validarTenantId(tenantId: string): void {
    if (!tenantId || !tenantId.trim()) {
      throw new PlanoContasValidationError('ID da barbearia (tenant) é obrigatório.');
    }
  }

  private validarCategoriaId(categoriaId: string): void {
    if (!categoriaId || !categoriaId.trim()) {
      throw new PlanoContasValidationError('Categoria de despesa é obrigatória.');
    }
  }

  private validarNome(name: string): string {
    const nomeNormalizado = normalizarNome(name);
    if (nomeNormalizado.length < NOME_MIN || nomeNormalizado.length > NOME_MAX) {
      throw new PlanoContasValidationError(
        `O nome da categoria deve ter entre ${NOME_MIN} e ${NOME_MAX} caracteres.`
      );
    }
    return nomeNormalizado;
  }

  private validarFornecedorId(fornecedorId: string): void {
    if (!fornecedorId || !fornecedorId.trim()) {
      throw new PlanoContasValidationError('Fornecedor é obrigatório.');
    }
  }

  /**
   * Normaliza e valida os dados de Fornecedor antes de delegar ao adaptador.
   * Campos opcionais (documento, telefone, e-mail, observação, categoria
   * padrão) viram `null` quando vazios -- o adaptador nunca recebe string
   * vazia, só valor real ou `null`.
   */
  private normalizarDadosFornecedor(dados: DadosFornecedor): DadosFornecedor {
    const nome = normalizarNome(dados.name);
    if (nome.length < NOME_FORNECEDOR_MIN || nome.length > NOME_FORNECEDOR_MAX) {
      throw new PlanoContasValidationError(
        `O nome do fornecedor deve ter entre ${NOME_FORNECEDOR_MIN} e ${NOME_FORNECEDOR_MAX} caracteres.`
      );
    }

    const documentoBruto = (dados.document || '').trim();
    let documento: string | null = null;
    if (documentoBruto) {
      documento = normalizarDocumento(documentoBruto);
      if (!documentoValido(documento)) {
        throw new PlanoContasValidationError('CPF ou CNPJ inválido.');
      }
    }

    const telefoneBruto = (dados.phone || '').replace(/\D/g, '');
    let telefone: string | null = null;
    if (telefoneBruto) {
      if (telefoneBruto.length !== 10 && telefoneBruto.length !== 11) {
        throw new PlanoContasValidationError('Telefone deve ter 10 ou 11 dígitos.');
      }
      telefone = telefoneBruto;
    }

    const emailBruto = (dados.email || '').trim().toLowerCase();
    let email: string | null = null;
    if (emailBruto) {
      if (!isValidEmailFormat(emailBruto)) {
        throw new PlanoContasValidationError('E-mail inválido.');
      }
      email = emailBruto;
    }

    const notesBruto = (dados.notes || '').trim();
    if (notesBruto.length > NOTES_MAX) {
      throw new PlanoContasValidationError(`Observação deve ter no máximo ${NOTES_MAX} caracteres.`);
    }
    const notes = notesBruto || null;

    return {
      name: nome,
      document: documento,
      phone: telefone,
      email,
      notes,
      defaultCategoryId: dados.defaultCategoryId || null,
    };
  }
}
