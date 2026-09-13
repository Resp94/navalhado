import { normalizarNome } from './nome';
import type { CategoriaDespesa, IPlanoContasAdapter } from './types';

const NOME_MIN = 2;
const NOME_MAX = 60;

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
}
