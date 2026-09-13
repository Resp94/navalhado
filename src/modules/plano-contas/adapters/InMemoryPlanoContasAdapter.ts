import { PlanoContasConflictError, PlanoContasValidationError } from '../PlanoContasRepository';
import type { CategoriaDespesa, IPlanoContasAdapter } from '../types';

const MSG_NOME_EXISTENTE = 'Já existe uma categoria de despesa com este nome.';
const MSG_ARQUIVADA_NAO_RENOMEIA = 'Categoria arquivada não pode ser renomeada. Reative-a antes.';
const MSG_JA_ARQUIVADA = 'Esta categoria já está arquivada.';
const MSG_JA_ATIVA = 'Esta categoria já está ativa.';
const MSG_NAO_ENCONTRADA = 'Categoria de despesa não encontrada.';

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
  private nextId = 1;

  constructor(initialCategorias: CategoriaDespesa[] = []) {
    this.categorias = [...initialCategorias];
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
