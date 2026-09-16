import { PlanoContasConflictError, PlanoContasValidationError } from '../PlanoContasRepository';
import type { CategoriaDespesa, DadosFornecedor, Fornecedor, IPlanoContasAdapter } from '../types';

const MSG_NOME_EXISTENTE = 'Já existe uma categoria de despesa com este nome.';
const MSG_ARQUIVADA_NAO_RENOMEIA = 'Categoria arquivada não pode ser renomeada. Reative-a antes.';
const MSG_JA_ARQUIVADA = 'Esta categoria já está arquivada.';
const MSG_JA_ATIVA = 'Esta categoria já está ativa.';
const MSG_NAO_ENCONTRADA = 'Categoria de despesa não encontrada.';

const MSG_FORNECEDOR_NOME_EXISTENTE = 'Já existe um fornecedor com este nome.';
const MSG_FORNECEDOR_DOCUMENTO_EXISTENTE = 'Já existe um fornecedor com este documento.';
const MSG_FORNECEDOR_ARQUIVADO_NAO_ATUALIZA = 'Fornecedor arquivado não pode ser atualizado. Reative-o antes.';
const MSG_FORNECEDOR_JA_ARQUIVADO = 'Este fornecedor já está arquivado.';
const MSG_FORNECEDOR_JA_ATIVO = 'Este fornecedor já está ativo.';
const MSG_FORNECEDOR_NAO_ENCONTRADO = 'Fornecedor não encontrado.';
const MSG_CATEGORIA_PADRAO_INVALIDA = 'Categoria de despesa padrão informada não existe ou está arquivada.';

/**
 * Adaptador em memória do Plano de Contas: existe para os testes da aba e
 * para o cadastro rápido da 036, exercitando fluxos inteiros sem simular o
 * cliente Supabase chamada a chamada. Reproduz o CONTRATO de erro do banco
 * (conflito de nome identificando o registro existente e se está arquivado;
 * recusa de renomear/arquivar/reativar registro no estado errado), não a
 * implementação (sem SQL, sem índice único -- a checagem é feita em memória).
 */
export class InMemoryPlanoContasAdapter implements IPlanoContasAdapter {
  private categorias: CategoriaDespesa[];
  private fornecedores: Fornecedor[];
  private nextId = 1;
  private nextFornecedorId = 1;

  constructor(initialCategorias: CategoriaDespesa[] = [], initialFornecedores: Fornecedor[] = []) {
    this.categorias = [...initialCategorias];
    this.fornecedores = [...initialFornecedores];
  }

  async listarCategoriasDespesa(tenantId: string): Promise<CategoriaDespesa[]> {
    return this.categorias.filter((c) => c.tenant_id === tenantId && c.nature === 'expense');
  }

  async criarCategoriaDespesa(tenantId: string, name: string): Promise<CategoriaDespesa> {
    this.recusarConflito(tenantId, name, null);

    const agora = new Date().toISOString();
    const categoria: CategoriaDespesa = {
      id: `mem-categoria-${this.nextId++}`,
      tenant_id: tenantId,
      nature: 'expense',
      name,
      seed_key: null,
      archived_at: null,
      archived_by: null,
      created_at: agora,
      created_by: 'mem-user',
      updated_at: agora,
      updated_by: null,
    };
    this.categorias.push(categoria);
    return { ...categoria };
  }

  async renomearCategoriaDespesa(
    tenantId: string,
    categoriaId: string,
    name: string
  ): Promise<CategoriaDespesa> {
    const categoria = this.encontrar(tenantId, categoriaId);
    if (categoria.archived_at !== null) {
      throw new PlanoContasValidationError(MSG_ARQUIVADA_NAO_RENOMEIA);
    }
    this.recusarConflito(tenantId, name, categoriaId);

    categoria.name = name;
    categoria.updated_at = new Date().toISOString();
    categoria.updated_by = 'mem-user';
    return { ...categoria };
  }

  async arquivarCategoriaDespesa(tenantId: string, categoriaId: string): Promise<CategoriaDespesa> {
    const categoria = this.encontrar(tenantId, categoriaId);
    if (categoria.archived_at !== null) {
      throw new PlanoContasValidationError(MSG_JA_ARQUIVADA);
    }

    const agora = new Date().toISOString();
    categoria.archived_at = agora;
    categoria.archived_by = 'mem-user';
    categoria.updated_at = agora;
    categoria.updated_by = 'mem-user';
    return { ...categoria };
  }

  async reativarCategoriaDespesa(tenantId: string, categoriaId: string): Promise<CategoriaDespesa> {
    const categoria = this.encontrar(tenantId, categoriaId);
    if (categoria.archived_at === null) {
      throw new PlanoContasValidationError(MSG_JA_ATIVA);
    }

    categoria.archived_at = null;
    categoria.archived_by = null;
    categoria.updated_at = new Date().toISOString();
    categoria.updated_by = 'mem-user';
    return { ...categoria };
  }

  async listarFornecedores(tenantId: string): Promise<Fornecedor[]> {
    return this.fornecedores.filter((f) => f.tenant_id === tenantId);
  }

  async criarFornecedor(tenantId: string, dados: DadosFornecedor): Promise<Fornecedor> {
    const defaultCategoryId = dados.defaultCategoryId || null;
    if (defaultCategoryId) {
      this.exigirCategoriaAtiva(tenantId, defaultCategoryId);
    }
    this.recusarConflitoFornecedor(tenantId, dados.name, dados.document || null, null);

    const agora = new Date().toISOString();
    const fornecedor: Fornecedor = {
      id: `mem-fornecedor-${this.nextFornecedorId++}`,
      tenant_id: tenantId,
      name: dados.name,
      document: dados.document || null,
      phone: dados.phone || null,
      email: dados.email || null,
      notes: dados.notes || null,
      default_category_id: defaultCategoryId,
      default_category: defaultCategoryId ? this.resumoCategoria(tenantId, defaultCategoryId) : null,
      archived_at: null,
      archived_by: null,
      created_at: agora,
      created_by: 'mem-user',
      updated_at: agora,
      updated_by: null,
    };
    this.fornecedores.push(fornecedor);
    return { ...fornecedor };
  }

  async atualizarFornecedor(
    tenantId: string,
    fornecedorId: string,
    dados: DadosFornecedor
  ): Promise<Fornecedor> {
    const fornecedor = this.encontrarFornecedor(tenantId, fornecedorId);
    if (fornecedor.archived_at !== null) {
      throw new PlanoContasValidationError(MSG_FORNECEDOR_ARQUIVADO_NAO_ATUALIZA);
    }

    const novaCategoriaId = dados.defaultCategoryId || null;
    // Categoria padrão arquivada depois de definida continua aceita se não mudou.
    if (novaCategoriaId !== fornecedor.default_category_id && novaCategoriaId) {
      this.exigirCategoriaAtiva(tenantId, novaCategoriaId);
    }
    this.recusarConflitoFornecedor(tenantId, dados.name, dados.document || null, fornecedorId);

    fornecedor.name = dados.name;
    fornecedor.document = dados.document || null;
    fornecedor.phone = dados.phone || null;
    fornecedor.email = dados.email || null;
    fornecedor.notes = dados.notes || null;
    fornecedor.default_category_id = novaCategoriaId;
    fornecedor.default_category = novaCategoriaId ? this.resumoCategoria(tenantId, novaCategoriaId) : null;
    fornecedor.updated_at = new Date().toISOString();
    fornecedor.updated_by = 'mem-user';
    return { ...fornecedor };
  }

  async arquivarFornecedor(tenantId: string, fornecedorId: string): Promise<Fornecedor> {
    const fornecedor = this.encontrarFornecedor(tenantId, fornecedorId);
    if (fornecedor.archived_at !== null) {
      throw new PlanoContasValidationError(MSG_FORNECEDOR_JA_ARQUIVADO);
    }

    const agora = new Date().toISOString();
    fornecedor.archived_at = agora;
    fornecedor.archived_by = 'mem-user';
    fornecedor.updated_at = agora;
    fornecedor.updated_by = 'mem-user';
    return { ...fornecedor };
  }

  async reativarFornecedor(tenantId: string, fornecedorId: string): Promise<Fornecedor> {
    const fornecedor = this.encontrarFornecedor(tenantId, fornecedorId);
    if (fornecedor.archived_at === null) {
      throw new PlanoContasValidationError(MSG_FORNECEDOR_JA_ATIVO);
    }

    fornecedor.archived_at = null;
    fornecedor.archived_by = null;
    fornecedor.updated_at = new Date().toISOString();
    fornecedor.updated_by = 'mem-user';
    return { ...fornecedor };
  }

  private encontrarFornecedor(tenantId: string, fornecedorId: string): Fornecedor {
    const fornecedor = this.fornecedores.find((f) => f.id === fornecedorId && f.tenant_id === tenantId);
    if (!fornecedor) {
      throw new PlanoContasValidationError(MSG_FORNECEDOR_NAO_ENCONTRADO);
    }
    return fornecedor;
  }

  private exigirCategoriaAtiva(tenantId: string, categoriaId: string): void {
    const categoria = this.categorias.find((c) => c.id === categoriaId && c.tenant_id === tenantId);
    if (!categoria || categoria.archived_at !== null) {
      throw new PlanoContasValidationError(MSG_CATEGORIA_PADRAO_INVALIDA);
    }
  }

  private resumoCategoria(tenantId: string, categoriaId: string) {
    const categoria = this.categorias.find((c) => c.id === categoriaId && c.tenant_id === tenantId);
    if (!categoria) return null;
    return { id: categoria.id, name: categoria.name, archived: categoria.archived_at !== null };
  }

  /** Unicidade de nome OU documento, sem diferenciar maiúsculas, inclusive contra arquivado. */
  private recusarConflitoFornecedor(
    tenantId: string,
    name: string,
    document: string | null,
    ignorarFornecedorId: string | null
  ): void {
    const nomeMinusculo = name.toLowerCase();
    const existentePorNome = this.fornecedores.find(
      (f) =>
        f.tenant_id === tenantId &&
        f.id !== ignorarFornecedorId &&
        f.name.toLowerCase() === nomeMinusculo
    );
    if (existentePorNome) {
      throw new PlanoContasConflictError(
        MSG_FORNECEDOR_NOME_EXISTENTE,
        existentePorNome.id,
        existentePorNome.name,
        existentePorNome.archived_at !== null
      );
    }

    if (document) {
      const existentePorDocumento = this.fornecedores.find(
        (f) => f.tenant_id === tenantId && f.id !== ignorarFornecedorId && f.document === document
      );
      if (existentePorDocumento) {
        throw new PlanoContasConflictError(
          MSG_FORNECEDOR_DOCUMENTO_EXISTENTE,
          existentePorDocumento.id,
          existentePorDocumento.name,
          existentePorDocumento.archived_at !== null
        );
      }
    }
  }

  private encontrar(tenantId: string, categoriaId: string): CategoriaDespesa {
    const categoria = this.categorias.find((c) => c.id === categoriaId && c.tenant_id === tenantId);
    if (!categoria) {
      throw new PlanoContasValidationError(MSG_NAO_ENCONTRADA);
    }
    return categoria;
  }

  /** Unicidade sem diferenciar maiúsculas, inclusive contra arquivada -- mesma regra do índice único do banco. */
  private recusarConflito(tenantId: string, name: string, ignorarCategoriaId: string | null): void {
    const nomeMinusculo = name.toLowerCase();
    const existente = this.categorias.find(
      (c) =>
        c.tenant_id === tenantId &&
        c.nature === 'expense' &&
        c.id !== ignorarCategoriaId &&
        c.name.toLowerCase() === nomeMinusculo
    );
    if (existente) {
      throw new PlanoContasConflictError(
        MSG_NOME_EXISTENTE,
        existente.id,
        existente.name,
        existente.archived_at !== null
      );
    }
  }
}
