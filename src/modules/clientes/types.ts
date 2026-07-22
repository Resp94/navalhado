export interface Customer {
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

export interface CustomerInputData {
  id?: string;
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  cadastro_completo?: boolean;
}

export interface CustomerAppointmentHistory {
  id: string;
  start_time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'canceled';
  payment_status: 'pending' | 'paid';
  service_name: string;
  service_price: number;
  professional_name: string;
}

export interface CustomerStats {
  totalCount: number;
  completosCount: number;
  provisoriosCount: number;
}

export interface IClienteAdapter {
  fetchCustomersByTenant(tenantId: string): Promise<Customer[]>;
  saveCustomer(tenantId: string, input: CustomerInputData): Promise<Customer>;
  deleteCustomer(tenantId: string, customerId: string): Promise<void>;
  fetchAppointmentHistory(customerId: string): Promise<CustomerAppointmentHistory[]>;
}
