export type ProductType = 'retail' | 'internal_use';

export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  product_type: ProductType;
  unit_type: string;
  price: number;
  cost_price: number;
  stock_quantity: number;
  min_stock_alert: number;
  commission_percentage?: number | null;
  is_active: boolean;
  created_at?: string;
}

export type ProductInputData = {
  id?: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  product_type?: ProductType;
  unit_type?: string;
  price: number;
  cost_price?: number;
  stock_quantity?: number;
  min_stock_alert?: number;
  commission_percentage?: number | null;
  is_active?: boolean;
};

export type CriarProdutoInput = ProductInputData & {
  tenant_id: string;
};

export type MovementType =
  | 'entry_manual'
  | 'entry_purchase'
  | 'exit_manual'
  | 'exit_sale_comanda'
  | 'exit_internal_use'
  | 'adjustment';

export interface ProductMovement {
  id: string;
  tenant_id: string;
  product_id: string;
  movement_type: MovementType;
  quantity?: number;
  quantity_change?: number;
  new_stock_level?: number | null;
  notes?: string | null;
  reason?: string | null;
  unit_cost?: number | null;
  comanda_id?: string | null;
  created_at: string;
}

export interface IProdutoAdapter {
  listar(tenantId: string): Promise<Product[]>;
  listarAtivos(tenantId: string): Promise<Product[]>;
  salvarProduto(tenantId: string, input: ProductInputData): Promise<Product>;
  ajustarEstoque(
    tenantId: string,
    productId: string,
    quantityChange: number,
    movementType: MovementType,
    notes?: string
  ): Promise<{ new_stock: number }>;
  buscarMovimentacoes(tenantId: string, productId?: string): Promise<ProductMovement[]>;
}

