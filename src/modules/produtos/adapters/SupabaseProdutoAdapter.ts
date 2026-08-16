import { supabase } from '../../../lib/supabase';
import type { CriarProdutoInput, IProdutoAdapter, Product } from '../types';

export class SupabaseProdutoAdapter implements IProdutoAdapter {
  async listarAtivos(tenantId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Erro ao listar produtos: ${error.message}`);
    }

    return (data || []) as Product[];
  }

  async salvarProduto(input: CriarProdutoInput): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .insert({
        tenant_id: input.tenant_id,
        name: input.name,
        price: input.price,
        cost_price: input.cost_price ?? 0,
        stock_quantity: input.stock_quantity ?? 0,
        is_active: input.is_active ?? true,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Erro ao salvar produto: ${error?.message}`);
    }

    return data as Product;
  }
}
