// Módulo Plano de Contas (spec 035). Ticket 03: só a leitura de Categorias de
// Despesa. Criar, renomear, arquivar e reativar chegam no ticket 04.

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
 * Interface do adaptador do Plano de Contas, com métodos em português. Neste
 * ticket expõe só a listagem de Categorias de Despesa; criar, renomear,
 * arquivar e reativar chegam no ticket 04, e listar/gerenciar Fornecedores no
 * ticket 06.
 */
export interface IPlanoContasAdapter {
  listarCategoriasDespesa(tenantId: string): Promise<CategoriaDespesa[]>;
}
