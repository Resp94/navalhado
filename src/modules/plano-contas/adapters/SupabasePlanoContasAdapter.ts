import type { SupabaseClient } from '@supabase/supabase-js';
import { PlanoContasConflictError, PlanoContasValidationError } from '../PlanoContasRepository';
import type { CategoriaDespesa, IPlanoContasAdapter } from '../types';

interface ErroPostgrest {
  code?: string;
  message?: string;
  details?: string | null;
}

/**
 * Detalhe estruturado de conflito de nome, anexado pela RPC via `USING detail
 * = jsonb...::text` no mesmo erro (23505 -- unique_violation) que o índice
 * único levantaria sob concorrência. Cobre os dois caminhos (checagem
 * explícita e corrida) com o mesmo formato.
 */
interface ConflitoDetalhe {
  existingId: string;
  existingName: string;
  archived: boolean;
}

function lerConflito(details: string | null | undefined): ConflitoDetalhe | null {
  if (!details) return null;
  try {
    const dado = JSON.parse(details);
    if (dado && typeof dado.existing_id === 'string') {
      return {
        existingId: dado.existing_id,
        existingName: typeof dado.existing_name === 'string' ? dado.existing_name : '',
        archived: Boolean(dado.archived),
      };
    }
  } catch {
    // Sem detalhe estruturado: cai para erro de validação genérico abaixo.
  }
  return null;
}

/**
 * Traduz o erro do banco para os dois tipos de erro de domínio do módulo.
 * 23505 (unique_violation) com detalhe estruturado vira conflito; qualquer
 * outro erro (papel revalidado, unidade divergente, estado inválido) vira
 * validação com a mensagem em português que a própria RPC já produz.
 */
function traduzirErro(error: ErroPostgrest): Error {
  if (error.code === '23505') {
    const conflito = lerConflito(error.details);
    if (conflito) {
      return new PlanoContasConflictError(
        error.message || 'Já existe uma categoria de despesa com este nome.',
        conflito.existingId,
        conflito.existingName,
        conflito.archived
      );
    }
  }
  return new PlanoContasValidationError(error.message || 'Não foi possível concluir a operação.');
}

export class SupabasePlanoContasAdapter implements IPlanoContasAdapter {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async listarCategoriasDespesa(tenantId: string): Promise<CategoriaDespesa[]> {
    const { data, error } = await this.supabase
      .from('financial_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('nature', 'expense')
      .order('name');

    if (error) throw error;
    return data || [];
  }

  async criarCategoriaDespesa(tenantId: string, name: string): Promise<CategoriaDespesa> {
    const { data, error } = await this.supabase.rpc('create_expense_category', {
      p_name: name,
      p_tenant_id: tenantId,
    });

    if (error) throw traduzirErro(error);
    return data as CategoriaDespesa;
  }

  async renomearCategoriaDespesa(
    tenantId: string,
    categoriaId: string,
    name: string
  ): Promise<CategoriaDespesa> {
    const { data, error } = await this.supabase.rpc('rename_expense_category', {
      p_category_id: categoriaId,
      p_name: name,
      p_tenant_id: tenantId,
    });

    if (error) throw traduzirErro(error);
    return data as CategoriaDespesa;
  }

  async arquivarCategoriaDespesa(tenantId: string, categoriaId: string): Promise<CategoriaDespesa> {
    const { data, error } = await this.supabase.rpc('archive_expense_category', {
      p_category_id: categoriaId,
      p_tenant_id: tenantId,
    });

    if (error) throw traduzirErro(error);
    return data as CategoriaDespesa;
  }

  async reativarCategoriaDespesa(tenantId: string, categoriaId: string): Promise<CategoriaDespesa> {
    const { data, error } = await this.supabase.rpc('reactivate_expense_category', {
      p_category_id: categoriaId,
      p_tenant_id: tenantId,
    });

    if (error) throw traduzirErro(error);
    return data as CategoriaDespesa;
  }
}
