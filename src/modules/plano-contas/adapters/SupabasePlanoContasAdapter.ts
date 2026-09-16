import type { SupabaseClient } from '@supabase/supabase-js';
import { PlanoContasConflictError, PlanoContasValidationError } from '../PlanoContasRepository';
import type { CategoriaDespesa, DadosFornecedor, Fornecedor, IPlanoContasAdapter } from '../types';

/** Forma bruta da linha de `suppliers` (sem a categoria padrão resolvida). */
interface FornecedorRowBase {
  id: string;
  tenant_id: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  default_category_id: string | null;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

type CategoriaResumo = { id: string; name: string; archived_at: string | null };

/** Linha de `suppliers` com a categoria padrão já resolvida à parte (nunca via embed do PostgREST -- ver `listarFornecedores`). */
interface FornecedorRow extends FornecedorRowBase {
  default_category: CategoriaResumo | null;
}

/**
 * As RPCs de escrita de fornecedor (`create_supplier` e as demais) devolvem
 * `public.suppliers%rowtype` puro, sem a categoria padrão resolvida -- só
 * `listarFornecedores` resolve isso à parte. A aba sempre recarrega a lista
 * depois de cada escrita bem-sucedida, então `default_category: null` aqui
 * nunca chega a aparecer na tela.
 */
function mapearFornecedorSemCategoria(row: FornecedorRowBase): Fornecedor {
  return mapearFornecedor({ ...row, default_category: null });
}

function mapearFornecedor(row: FornecedorRow): Fornecedor {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    document: row.document,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    default_category_id: row.default_category_id,
    default_category: row.default_category
      ? {
          id: row.default_category.id,
          name: row.default_category.name,
          archived: row.default_category.archived_at !== null,
        }
      : null,
    archived_at: row.archived_at,
    archived_by: row.archived_by,
    created_at: row.created_at,
    created_by: row.created_by,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  };
}

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
        error.message || 'Já existe um registro com este nome.',
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

  async listarFornecedores(tenantId: string): Promise<Fornecedor[]> {
    // Sem embed do PostgREST: o FK de categoria padrão é composto
    // (tenant_id, default_category_id) -> (tenant_id, id), decisão da spec
    // 035 para isolar entre tenants no próprio schema. O PostgREST não
    // resolve embed por FK composta (erro PGRST200, "no relationship
    // found"), então a categoria é buscada à parte e resolvida no cliente.
    const { data, error } = await this.supabase
      .from('suppliers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name');

    if (error) throw error;
    const rows = (data as unknown as FornecedorRowBase[]) || [];

    const categoriaIds = [...new Set(rows.map((row) => row.default_category_id).filter((id): id is string => id !== null))];
    const categoriasPorId = new Map<string, CategoriaResumo>();
    if (categoriaIds.length > 0) {
      const { data: categorias, error: categoriasError } = await this.supabase
        .from('financial_categories')
        .select('id, name, archived_at')
        .eq('tenant_id', tenantId)
        .in('id', categoriaIds);

      if (categoriasError) throw categoriasError;
      for (const categoria of (categorias as CategoriaResumo[]) || []) {
        categoriasPorId.set(categoria.id, categoria);
      }
    }

    return rows.map((row) =>
      mapearFornecedor({
        ...row,
        default_category: row.default_category_id ? categoriasPorId.get(row.default_category_id) ?? null : null,
      })
    );
  }

  async criarFornecedor(tenantId: string, dados: DadosFornecedor): Promise<Fornecedor> {
    const { data, error } = await this.supabase.rpc('create_supplier', {
      p_name: dados.name,
      p_document: dados.document ?? null,
      p_phone: dados.phone ?? null,
      p_email: dados.email ?? null,
      p_notes: dados.notes ?? null,
      p_default_category_id: dados.defaultCategoryId ?? null,
      p_tenant_id: tenantId,
    });

    if (error) throw traduzirErro(error);
    return mapearFornecedorSemCategoria(data as unknown as FornecedorRowBase);
  }

  async atualizarFornecedor(
    tenantId: string,
    fornecedorId: string,
    dados: DadosFornecedor
  ): Promise<Fornecedor> {
    const { data, error } = await this.supabase.rpc('update_supplier', {
      p_supplier_id: fornecedorId,
      p_name: dados.name,
      p_document: dados.document ?? null,
      p_phone: dados.phone ?? null,
      p_email: dados.email ?? null,
      p_notes: dados.notes ?? null,
      p_default_category_id: dados.defaultCategoryId ?? null,
      p_tenant_id: tenantId,
    });

    if (error) throw traduzirErro(error);
    return mapearFornecedorSemCategoria(data as unknown as FornecedorRowBase);
  }

  async arquivarFornecedor(tenantId: string, fornecedorId: string): Promise<Fornecedor> {
    const { data, error } = await this.supabase.rpc('archive_supplier', {
      p_supplier_id: fornecedorId,
      p_tenant_id: tenantId,
    });

    if (error) throw traduzirErro(error);
    return mapearFornecedorSemCategoria(data as unknown as FornecedorRowBase);
  }

  async reativarFornecedor(tenantId: string, fornecedorId: string): Promise<Fornecedor> {
    const { data, error } = await this.supabase.rpc('reactivate_supplier', {
      p_supplier_id: fornecedorId,
      p_tenant_id: tenantId,
    });

    if (error) throw traduzirErro(error);
    return mapearFornecedorSemCategoria(data as unknown as FornecedorRowBase);
  }
}
