import type { IEsperaAdapter, WaitingListEntry, WaitingListStatus } from './types';

export class EsperaRepository {
  private adapter: IEsperaAdapter;

  constructor(adapter: IEsperaAdapter) {
    this.adapter = adapter;
  }

  async listByDate(tenantId: string, dataIso: string, timeZone: string): Promise<WaitingListEntry[]> {
    return this.adapter.listarPorData(tenantId, dataIso, timeZone);
  }

  async addEntry(
    entrada: Omit<WaitingListEntry, 'id' | 'created_at'>
  ): Promise<WaitingListEntry> {
    if (!entrada.customer_name.trim()) {
      throw new Error('Nome do cliente é obrigatório para a lista de espera.');
    }
    return this.adapter.adicionar(entrada);
  }

  async setStatus(id: string, status: WaitingListStatus): Promise<WaitingListEntry> {
    return this.adapter.atualizarStatus(id, status);
  }

  async removeEntry(id: string): Promise<void> {
    return this.adapter.remover(id);
  }

  /**
   * Nota do Agendamento criado pelo encaixe: a observação que a recepção anotou na entrada
   * precisa chegar ao barbeiro que vai atender. Que o Agendamento veio da fila não vai na nota:
   * é uma coluna própria, que a RPC grava quando baixa a entrada.
   */
  notaDeEncaixe(entrada: Pick<WaitingListEntry, 'notes'>): string {
    return entrada.notes?.trim() ?? '';
  }

  /**
   * Rodízio de Balcão a partir dos agendamentos do dia: conta por profissional (ignorando
   * cancelados e com falta) e sugere quem tem menos. Empate mantém o primeiro da lista.
   */
  suggestRotationFromAppointments(
    professionals: Array<{ id: string; name: string }>,
    appointments: Array<{ professional_id: string; status?: string }>
  ): { id: string; name: string } | null {
    const counts: Record<string, number> = {};
    for (const appointment of appointments) {
      if (appointment.status === 'canceled' || appointment.status === 'no_show') continue;
      counts[appointment.professional_id] = (counts[appointment.professional_id] || 0) + 1;
    }
    return this.suggestRotationProfessional(professionals, counts);
  }

  /**
   * Sugestão de Rodízio de Balcão:
   * Retorna o profissional ativo com menor número de atendimentos no dia (para balanceamento justo de comissões).
   */
  suggestRotationProfessional(
    professionals: Array<{ id: string; name: string }>,
    appointmentsCountByProf: Record<string, number>
  ): { id: string; name: string } | null {
    if (professionals.length === 0) return null;

    let bestProf = professionals[0];
    let minCount = appointmentsCountByProf[bestProf.id] || 0;

    for (let i = 1; i < professionals.length; i++) {
      const p = professionals[i];
      const count = appointmentsCountByProf[p.id] || 0;
      if (count < minCount) {
        minCount = count;
        bestProf = p;
      }
    }

    return bestProf;
  }
}
