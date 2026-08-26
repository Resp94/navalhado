export type ComandaStatus = 'aberta' | 'fechada' | 'cancelada';
export type ItemTipo = 'servico' | 'produto';
export type MetodoPagamento = 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'other';

export interface ComandaItem {
  id: string;
  comanda_id: string;
  tenant_id: string;
  item_type: ItemTipo;
  service_id: string | null;
  product_id: string | null;
  professional_id: string | null;
  name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at?: string;
}

export interface ComandaPagamento {
  id: string;
  comanda_id: string;
  tenant_id: string;
  cash_session_id: string | null;
  payment_method: MetodoPagamento;
  amount: number;
  change_amount: number;
  paid_at?: string;
}

export interface Comanda {
  id: string;
  tenant_id: string;
  comanda_number?: number | string | null;
  appointment_id: string | null;
  customer_id: string | null;
  status: ComandaStatus;
  total_amount: number;
  discount_amount: number;
  tip_amount: number;
  notes: string | null;
  created_at?: string;
  closed_at?: string | null;
  itens?: ComandaItem[];
  pagamentos?: ComandaPagamento[];
}

export interface CriarComandaInput {
  tenant_id: string;
  appointment_id?: string | null;
  customer_id?: string | null;
  notes?: string | null;
  itens: Array<{
    item_type: ItemTipo;
    service_id?: string | null;
    product_id?: string | null;
    professional_id?: string | null;
    quantity: number;
    unit_price: number;
  }>;
}

export interface ComandaItemInput {
  item_type: ItemTipo;
  service_id?: string | null;
  product_id?: string | null;
  professional_id?: string | null;
  quantity: number;
  unit_price: number;
}

export interface LiquidarComandaInput {
  comanda_id: string;
  tenant_id: string;
  discount_amount?: number;
  tip_amount?: number;
  cash_session_id?: string | null;
  itens?: ComandaItemInput[];
  pagamentos: Array<{
    payment_method: MetodoPagamento;
    amount: number;
    received_cash?: number;
  }>;
}

export interface ComandaEnriched extends Comanda {
  customer_name: string;
  customer_phone?: string | null;
  professional_name: string;
  appointment_start_time?: string | null;
  appointment_service_name?: string | null;
  appointment_is_fitting?: boolean | null;
}

export interface IComandaAdapter {
  obterPorId(comandaId: string): Promise<Comanda | null>;
  obterPorAppointmentId(appointmentId: string): Promise<Comanda | null>;
  listarAbertas(tenantId: string): Promise<Comanda[]>;
  listarTodas(tenantId: string): Promise<ComandaEnriched[]>;
  criarComanda(input: CriarComandaInput): Promise<Comanda>;
  adicionarItem(comandaId: string, tenantId: string, item: Omit<ComandaItem, 'id' | 'comanda_id' | 'tenant_id'>): Promise<ComandaItem>;
  removerItem(itemId: string, comandaId: string): Promise<void>;
  liquidarComanda(input: LiquidarComandaInput): Promise<Comanda>;
  reabrirComanda(comandaId: string, tenantId: string): Promise<Comanda>;
}
