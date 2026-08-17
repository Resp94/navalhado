import type { IProdutoAdapter, MovementType, Product, ProductInputData, ProductMovement } from './types';

export class ProdutoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProdutoValidationError';
  }
}

export class ProdutoRepository {
  private adapter: IProdutoAdapter;

  constructor(adapter: IProdutoAdapter) {
    this.adapter = adapter;
  }

  async listAll(tenantId: string): Promise<Product[]> {
    if (!tenantId || !tenantId.trim()) {
      throw new ProdutoValidationError('ID da barbearia (tenant) é obrigatório.');
    }
    const list = await this.adapter.listar(tenantId);
    return (list || []).sort((a: Product, b: Product) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  async listActive(tenantId: string): Promise<Product[]> {
    const list = await this.listAll(tenantId);
    return list.filter((p) => p.is_active);
  }

  async saveProduct(
    tenantIdOrInput: string | (ProductInputData & { tenant_id?: string }),
    maybeInput?: ProductInputData
  ): Promise<Product> {
    let tenantId: string;
    let input: ProductInputData;

    if (typeof tenantIdOrInput === 'string') {
      tenantId = tenantIdOrInput;
      input = maybeInput || { name: '', price: 0 };
    } else {
      tenantId = tenantIdOrInput.tenant_id || '';
      input = tenantIdOrInput;
    }

    if (!tenantId || !tenantId.trim()) {
      throw new ProdutoValidationError('ID da barbearia (tenant) é obrigatório.');
    }
    if (!input.name || !input.name.trim()) {
      throw new ProdutoValidationError('O nome do produto é obrigatório.');
    }
    if (input.price < 0) {
      throw new ProdutoValidationError('O preço do produto não pode ser negativo.');
    }

    const payload: ProductInputData = {
      ...input,
      name: input.name.trim(),
      brand: input.brand ? input.brand.trim() : null,
      category: input.category ? input.category.trim() : 'Geral',
      product_type: input.product_type || 'retail',
      unit_type: input.unit_type || 'unidade',
      cost_price: input.cost_price ?? 0,
      stock_quantity: input.stock_quantity ?? 0,
      min_stock_alert: input.min_stock_alert ?? 5,
      commission_percentage: input.commission_percentage ?? null,
      is_active: input.is_active ?? true,
    };

    return await this.adapter.salvarProduto(tenantId, payload);
  }


  async adjustStock(
    tenantId: string,
    productId: string,
    quantityChange: number,
    movementType: MovementType,
    notes?: string
  ): Promise<{ new_stock: number }> {
    if (!tenantId || !productId) {
      throw new ProdutoValidationError('Tenant ID e Product ID são obrigatórios.');
    }
    if (quantityChange === 0) {
      throw new ProdutoValidationError('A quantidade de movimentação não pode ser zero.');
    }
    return await this.adapter.ajustarEstoque(tenantId, productId, quantityChange, movementType, notes);
  }

  async getMovements(tenantId: string, productId?: string): Promise<ProductMovement[]> {
    if (!tenantId) return [];
    return await this.adapter.buscarMovimentacoes(tenantId, productId);
  }
}
