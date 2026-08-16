export type WaitingListStatus = 'aguardando' | 'atendido' | 'cancelado';

export interface WaitingListEntry {
  id: string;
  tenant_id: string;
  customer_id?: string | null;
  customer_name: string;
  customer_phone: string;
  professional_id?: string | null;
  service_id?: string | null;
  status: WaitingListStatus;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface IEsperaAdapter {
  listarPorData(tenantId: string, dataIso: string): Promise<WaitingListEntry[]>;
  adicionar(entrada: Omit<WaitingListEntry, 'id' | 'created_at' | 'updated_at'>): Promise<WaitingListEntry>;
  atualizarStatus(id: string, status: WaitingListStatus): Promise<WaitingListEntry>;
  remover(id: string): Promise<void>;
}
