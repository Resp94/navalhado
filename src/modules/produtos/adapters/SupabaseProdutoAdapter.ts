import { supabase } from '../../../lib/supabase';
import type { IProdutoAdapter, MovementType, Product, ProductInputData, ProductMovement } from '../types';

export class SupabaseProdutoAdapter implements IProdutoAdapter {
  async listar(tenantId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Erro ao listar produtos: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      ...row,
      product_type: row.product_type || 'retail',
      unit_type: row.unit_type || 'un',
      min_stock_alert: row.min_stock_alert ?? 5,
      cost_price: Number(row.cost_price || 0),
      price: Number(row.price || 0),
      stock_quantity: Number(row.stock_quantity || 0),
    })) as Product[];
  }

  async listarAtivos(tenantId: string): Promise<Product[]> {
    const list = await this.listar(tenantId);
    return list.filter((p) => p.is_active);
  }

  async salvarProduto(tenantId: string, input: ProductInputData): Promise<Product> {
    const payload = {
      tenant_id: tenantId,
      name: input.name.trim(),
      brand: input.brand ? input.brand.trim() : null,
      category: input.category ? input.category.trim() : 'Geral',
      product_type: input.product_type || 'retail',
      unit_type: input.unit_type || 'un',
      price: input.price,
      cost_price: input.cost_price ?? 0,
      stock_quantity: input.stock_quantity ?? 0,
      min_stock_alert: input.min_stock_alert ?? 5,
      commission_percentage: input.commission_percentage ?? null,
      is_active: input.is_active ?? true,
    };



    if (input.id) {
      const { data, error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', input.id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error || !data) {
        throw new Error(`Erro ao atualizar produto: ${error?.message}`);
      }

      return data as Product;
    } else {
      const { data, error } = await supabase
        .from('products')
        .insert(payload)
        .select()
        .single();

      if (error || !data) {
        throw new Error(`Erro ao cadastrar produto: ${error?.message}`);
      }

      return data as Product;
    }
  }

  async ajustarEstoque(
    _tenantId: string,
    productId: string,
    quantityChange: number,
    movementType: MovementType,
    notes?: string
  ): Promise<{ new_stock: number }> {
    const { data, error } = await supabase.rpc('adjust_product_stock', {
      p_product_id: productId,
      p_movement_type: movementType,
      p_quantity: Math.abs(quantityChange),
      p_reason: notes || null,
    });

    if (error) {
      throw new Error(`Erro ao ajustar estoque: ${error.message}`);
    }

    return { new_stock: typeof data === 'object' && data?.new_stock !== undefined ? data.new_stock : Number(data) };
  }


  async buscarMovimentacoes(tenantId: string, productId?: string): Promise<ProductMovement[]> {
    let query = supabase
      .from('product_movements')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Erro ao buscar movimentações: ${error.message}`);
    }

    return (data || []) as ProductMovement[];
  }
}
