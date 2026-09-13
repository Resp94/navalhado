import type { CategoriaDespesa, IPlanoContasAdapter } from '../types';

/**
 * Adaptador em memória do Plano de Contas: existe para os testes da aba e
 * para o cadastro rápido da 036, exercitando fluxos inteiros sem simular o
 * cliente Supabase chamada a chamada. Reproduz o contrato de erro do banco,
 * não a implementação.
 */
export class InMemoryPlanoContasAdapter implements IPlanoContasAdapter {
  private categorias: CategoriaDespesa[];

  constructor(initialCategorias: CategoriaDespesa[] = []) {
    this.categorias = [...initialCategorias];
  }

  async listarCategoriasDespesa(tenantId: string): Promise<CategoriaDespesa[]> {
    return this.categorias.filter((c) => c.tenant_id === tenantId && c.nature === 'expense');
  }
}
