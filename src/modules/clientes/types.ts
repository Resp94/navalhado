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

export type Customer = Cliente;

export interface ClienteInputData {
  id?: string;
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  cadastro_completo?: boolean;
}

export type CustomerInputData = ClienteInputData;

export interface HistoricoVisitasCliente {
  id: string;
  start_time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'canceled';
  payment_status: 'pending' | 'paid';
  service_name: string;
  service_price: number;
  professional_name: string;
}

export type CustomerAppointmentHistory = HistoricoVisitasCliente;

export interface EstatisticasCliente {
  totalCount: number;
  completosCount: number;
  provisoriosCount: number;
}

export type CustomerStats = EstatisticasCliente;

export type StatusFiltroCliente = 'todos' | 'completos' | 'provisorios';

export interface IClienteAdapter {
  fetchCustomersByTenant(tenantId: string): Promise<Cliente[]>;
  saveCustomer(tenantId: string, input: ClienteInputData): Promise<Cliente>;
  deleteCustomer(tenantId: string, customerId: string): Promise<void>;
  fetchAppointmentHistory(customerId: string): Promise<HistoricoVisitasCliente[]>;
}
