import type { CriarProdutoInput, IProdutoAdapter, Product } from './types';

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

  async listActive(tenantId: string): Promise<Product[]> {
    if (!tenantId || !tenantId.trim()) {
      throw new ProdutoValidationError('ID da barbearia (tenant) é obrigatório.');
    }
    const list = await this.adapter.listarAtivos(tenantId);
    return list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  async saveProduct(input: CriarProdutoInput): Promise<Product> {
    if (!input.tenant_id || !input.tenant_id.trim()) {
      throw new ProdutoValidationError('ID da barbearia (tenant) é obrigatório.');
    }
    if (!input.name || !input.name.trim()) {
      throw new ProdutoValidationError('O nome do produto é obrigatório.');
    }
    if (input.price < 0) {
      throw new ProdutoValidationError('O preço do produto não pode ser negativo.');
    }

    const payload: CriarProdutoInput = {
      ...input,
      name: input.name.trim(),
      cost_price: input.cost_price ?? 0,
      stock_quantity: input.stock_quantity ?? 0,
      is_active: input.is_active ?? true,
    };

    return await this.adapter.salvarProduto(payload);
  }
}
