import type { SupabaseClient } from '@supabase/supabase-js';
import type { CategoriaDespesa, IPlanoContasAdapter } from '../types';

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
}
