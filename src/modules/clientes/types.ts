export interface Cliente {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  cadastro_completo: boolean;
  token_acesso: string;
  birth_date: string | null;
  tags: string[];
  acquisition_channel: string | null;
  cpf: string | null;
  created_at: string;
}

export interface ClienteInputData {
  id?: string;
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  cadastro_completo?: boolean;
  birth_date?: string | null;
  tags?: string[];
  acquisition_channel?: string | null;
  cpf?: string | null;
}

export interface HistoricoVisitasCliente {
  id: string;
  start_time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'canceled';
  payment_status: 'pending' | 'paid';
  service_name: string;
  service_price: number;
  professional_name: string;
}

export interface ComandaItemHistorico {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  item_type: 'service' | 'product';
}

export interface ComandaHistoricoCliente {
  id: string;
  comanda_number: number;
  status: string;
  total_final: number;
  closed_at: string | null;
  created_at: string;
  items: ComandaItemHistorico[];
}

export interface MetricasLTVCliente {
  totalSpend: number;
  averageTicket: number;
  totalVisits: number;
  averageDaysBetweenVisits: number;
  lastVisitDate: string | null;
}

export interface EstatisticasCliente {
  totalCount: number;
  completosCount: number;
  provisoriosCount: number;
}

export type StatusFiltroCliente = 'todos' | 'completos' | 'provisorios';

export interface IClienteAdapter {
  listarPorTenant(tenantId: string): Promise<Cliente[]>;
  salvarCliente(tenantId: string, input: ClienteInputData): Promise<Cliente>;
  excluirCliente(tenantId: string, clienteId: string): Promise<void>;
  buscarHistoricoVisitas(clienteId: string): Promise<HistoricoVisitasCliente[]>;
  buscarHistoricoComandas(tenantId: string, clienteId: string): Promise<ComandaHistoricoCliente[]>;
  calcularMetricasLTV(clienteId: string, appointments: HistoricoVisitasCliente[], comandas: ComandaHistoricoCliente[]): MetricasLTVCliente;
}

