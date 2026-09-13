import type { CategoriaDespesa, IPlanoContasAdapter } from './types';

export class PlanoContasValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanoContasValidationError';
  }
}

/**
 * Repositório do Plano de Contas: valida a entrada e delega ao adaptador.
 * Neste ticket expõe só listar Categorias de Despesa (ticket 04 acrescenta
 * criar, renomear, arquivar e reativar; ticket 06, Fornecedores).
 */
export class PlanoContasRepository {
  private adapter: IPlanoContasAdapter;

  constructor(adapter: IPlanoContasAdapter) {
    this.adapter = adapter;
  }

  async listarCategoriasDespesa(tenantId: string): Promise<CategoriaDespesa[]> {
    if (!tenantId || !tenantId.trim()) {
      throw new PlanoContasValidationError('ID da barbearia (tenant) é obrigatório.');
    }
    const categorias = await this.adapter.listarCategoriasDespesa(tenantId);
    return [...categorias].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }
}
