export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  price: number;
  cost_price: number;
  stock_quantity: number;
  is_active: boolean;
  created_at?: string;
}

export interface CriarProdutoInput {
  tenant_id: string;
  name: string;
  price: number;
  cost_price?: number;
  stock_quantity?: number;
  is_active?: boolean;
}

export interface IProdutoAdapter {
  listarAtivos(tenantId: string): Promise<Product[]>;
  salvarProduto(input: CriarProdutoInput): Promise<Product>;
}
