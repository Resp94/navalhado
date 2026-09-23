import { localDayUtcRange } from '../../../lib/timezone';
import type { IEsperaAdapter, WaitingListEntry, WaitingListStatus } from '../types';

/**
 * Espelha as colunas realmente persistidas em public.waiting_list e traduz o
 * vocabulário de status na fronteira, como o adaptador real. Guardar aqui um
 * campo que a tabela não tem foi o que manteve a suíte verde enquanto a
 * observação se perdia; este dublê só conhece o que o banco guarda.
 */
interface DbWaitingListRow {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  name: string;
  phone: string;
  service_id: string | null;
  professional_id: string | null;
  status: 'waiting' | 'scheduled' | 'expired' | 'canceled';
  notes: string | null;
  created_at: string;
}

export class InMemoryEsperaAdapter implements IEsperaAdapter {
  private rows: DbWaitingListRow[];
  private now: () => Date;
  private sequence = 0;

  constructor(seed: DbWaitingListRow[] = [], now: () => Date = () => new Date()) {
    this.rows = [...seed];
    this.now = now;
  }

  private mapStatusToDb(status: WaitingListStatus): 'waiting' | 'scheduled' | 'canceled' {
    switch (status) {
      case 'atendido':
        return 'scheduled';
      case 'cancelado':
        return 'canceled';
      case 'aguardando':
      default:
        return 'waiting';
    }
  }

  private mapStatusFromDb(status: string): WaitingListStatus {
    switch (status) {
      case 'scheduled':
        return 'atendido';
      case 'canceled':
      case 'expired':
        return 'cancelado';
      case 'waiting':
      default:
        return 'aguardando';
    }
  }

  private mapRowToEntry(row: DbWaitingListRow): WaitingListEntry {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      customer_id: row.customer_id,
      customer_name: row.name,
      customer_phone: row.phone,
      service_id: row.service_id,
      professional_id: row.professional_id,
      status: this.mapStatusFromDb(row.status),
      notes: row.notes,
      created_at: row.created_at,
    };
  }

  async listarPorData(tenantId: string, dataIso: string, timeZone: string): Promise<WaitingListEntry[]> {
    const { start, endExclusive } = localDayUtcRange(dataIso, timeZone);
    return this.rows
      .filter(
        (row) => row.tenant_id === tenantId && row.created_at >= start && row.created_at < endExclusive
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((row) => this.mapRowToEntry(row));
  }

  async adicionar(
    entrada: Omit<WaitingListEntry, 'id' | 'created_at'>
  ): Promise<WaitingListEntry> {
    this.sequence += 1;
    const row: DbWaitingListRow = {
      id: `espera-${this.sequence}`,
      tenant_id: entrada.tenant_id,
      customer_id: entrada.customer_id || null,
      name: entrada.customer_name,
      phone: entrada.customer_phone,
      service_id: entrada.service_id || null,
      professional_id: entrada.professional_id || null,
      status: this.mapStatusToDb(entrada.status),
      notes: entrada.notes || null,
      created_at: this.now().toISOString(),
    };
    this.rows.push(row);
    return this.mapRowToEntry(row);
  }

  async atualizarStatus(id: string, status: WaitingListStatus): Promise<WaitingListEntry> {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (!row) throw new Error(`Entrada ${id} não encontrada na lista de espera.`);
    row.status = this.mapStatusToDb(status);
    return this.mapRowToEntry(row);
  }

  async remover(id: string): Promise<void> {
    this.rows = this.rows.filter((row) => row.id !== id);
  }
}
