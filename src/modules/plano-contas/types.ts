// Módulo Plano de Contas (spec 035). Ticket 03: só a leitura de Categorias de
// Despesa. Ticket 04: criar, renomear, arquivar e reativar.

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
 * Interface do adaptador do Plano de Contas, com métodos em português. Este
 * ticket (04) acrescenta criar, renomear, arquivar e reativar Categoria de
 * Despesa; listar/gerenciar Fornecedores chega no ticket 06.
 *
 * O repositório normaliza o nome (pontas aparadas, espaços internos
 * colapsados) antes de delegar: os adaptadores recebem o nome já normalizado.
 * A RPC do Supabase normaliza de novo, como autoridade sob concorrência.
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
}
