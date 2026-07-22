export interface Cliente {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  cadastro_completo: boolean;
  token_acesso: string;
  created_at: string;
}

export interface ClienteInputData {
  id?: string;
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  cadastro_completo?: boolean;
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
}
