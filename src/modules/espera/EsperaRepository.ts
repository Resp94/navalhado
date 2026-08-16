import type { IEsperaAdapter, WaitingListEntry, WaitingListStatus } from './types';

export class EsperaRepository {
  constructor(private adapter: IEsperaAdapter) {}

  async listByDate(tenantId: string, dataIso: string): Promise<WaitingListEntry[]> {
    return this.adapter.listarPorData(tenantId, dataIso);
  }

  async addEntry(
    entrada: Omit<WaitingListEntry, 'id' | 'created_at' | 'updated_at'>
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
