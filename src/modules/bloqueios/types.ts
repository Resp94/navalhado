export interface BlockedSlot {
  id: string;
  tenant_id: string;
  professional_id: string;
  start_time: string;
  end_time: string;
  reason: string;
  is_all_day: boolean;
  created_at?: string;
}

export interface CriarBloqueioInput {
  tenant_id: string;
  professional_id: string;
  start_time: string;
  end_time: string;
  reason: string;
  is_all_day?: boolean;
}

export interface IBloqueioAdapter {
  listarPorData(tenantId: string, dataInicioIso: string, dataFimIso: string): Promise<BlockedSlot[]>;
  criarBloqueio(input: CriarBloqueioInput): Promise<BlockedSlot>;
  removerBloqueio(bloqueioId: string, tenantId: string): Promise<void>;
}
