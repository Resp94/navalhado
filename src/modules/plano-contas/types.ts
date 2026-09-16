// Módulo Plano de Contas (spec 035). Ticket 03: só a leitura de Categorias de
// Despesa. Ticket 04: criar, renomear, arquivar e reativar. Ticket 06:
// Fornecedor (listar, criar, atualizar, arquivar, reativar).

/** Nesta spec (035) o domínio aceita só 'expense'. Receita alarga o domínio no futuro. */
export type NaturezaCategoria = 'expense';

export interface CategoriaDespesa {
  id: string;
  tenant_id: string;
  nature: NaturezaCategoria;
  name: string;
  /** Chave estável da categoria padrão semeada; nula para categoria criada pelo gestor. */
  seed_key: string | null;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/**
 * Categoria padrão de um Fornecedor, com o estado dela (ticket 06: "a leitura
 * de fornecedor devolve a categoria padrão com o estado dela"). Nula quando o
 * fornecedor não tem categoria padrão.
 */
export interface CategoriaPadraoResumo {
  id: string;
  name: string;
  archived: boolean;
}

export interface Fornecedor {
  id: string;
  tenant_id: string;
  name: string;
  /** CPF ou CNPJ sem máscara, letras maiúsculas. Nulo: fornecedor sem documento cadastrado. */
  document: string | null;
  /** Só dígitos, 10 ou 11. */
  phone: string | null;
  email: string | null;
  notes: string | null;
  default_category_id: string | null;
  default_category: CategoriaPadraoResumo | null;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface DadosFornecedor {
  name: string;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  defaultCategoryId?: string | null;
}

/**
 * Interface do adaptador do Plano de Contas, com métodos em português. Ticket
 * 04 acrescenta criar, renomear, arquivar e reativar Categoria de Despesa.
 * Ticket 06 acrescenta o mesmo contrato para Fornecedor.
 *
 * O repositório normaliza o nome (pontas aparadas, espaços internos
 * colapsados) antes de delegar: os adaptadores recebem o nome já normalizado.
 * A RPC do Supabase normaliza de novo, como autoridade sob concorrência. O
 * mesmo vale para documento, telefone e e-mail do Fornecedor.
 */
export interface IPlanoContasAdapter {
  listarCategoriasDespesa(tenantId: string): Promise<CategoriaDespesa[]>;
  criarCategoriaDespesa(tenantId: string, name: string): Promise<CategoriaDespesa>;
  renomearCategoriaDespesa(
    tenantId: string,
    categoriaId: string,
    name: string
  ): Promise<CategoriaDespesa>;
  arquivarCategoriaDespesa(tenantId: string, categoriaId: string): Promise<CategoriaDespesa>;
  reativarCategoriaDespesa(tenantId: string, categoriaId: string): Promise<CategoriaDespesa>;

  listarFornecedores(tenantId: string): Promise<Fornecedor[]>;
  criarFornecedor(tenantId: string, dados: DadosFornecedor): Promise<Fornecedor>;
  atualizarFornecedor(
    tenantId: string,
    fornecedorId: string,
    dados: DadosFornecedor
  ): Promise<Fornecedor>;
  arquivarFornecedor(tenantId: string, fornecedorId: string): Promise<Fornecedor>;
  reativarFornecedor(tenantId: string, fornecedorId: string): Promise<Fornecedor>;
}
