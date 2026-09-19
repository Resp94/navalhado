import { AgendaOperationError } from '../AgendaRepository';
import type { AgendaTransitionResult, AgendamentoStatus, IAgendaAdapter } from '../types';

interface AgendamentoEmMemoria {
  id: string;
  tenant_id: string;
  status: AgendamentoStatus;
  start_time: string;
  cancellation_reason?: string | null;
}

/** Fake usado em testes: aplica a mesma tabela de transições que as RPCs do banco. */
export class InMemoryAgendaAdapter implements IAgendaAdapter {
  private agendamentos = new Map<string, AgendamentoEmMemoria>();

  seed(agendamento: AgendamentoEmMemoria) {
    this.agendamentos.set(agendamento.id, { ...agendamento });
  }

  get(id: string) {
    return this.agendamentos.get(id);
  }

  async iniciarAtendimento(tenantId: string, appointmentId: string): Promise<AgendaTransitionResult> {
    const ap = this.find(tenantId, appointmentId);
    if (!['pending', 'confirmed'].includes(ap.status)) {
      throw new AgendaOperationError('Somente atendimentos pendentes ou confirmados podem ser iniciados.', 'regra');
    }
    return this.move(ap, 'in_progress');
  }

  async cancelar(tenantId: string, appointmentId: string, motivo: string): Promise<AgendaTransitionResult> {
    const ap = this.find(tenantId, appointmentId);
    if (!['pending', 'confirmed', 'in_progress'].includes(ap.status)) {
      throw new AgendaOperationError(
        'Somente atendimentos pendentes, confirmados ou em andamento podem ser cancelados.',
        'regra'
      );
    }
    ap.cancellation_reason = motivo;
    return this.move(ap, 'canceled');
  }

  async marcarFalta(tenantId: string, appointmentId: string): Promise<AgendaTransitionResult> {
    const ap = this.find(tenantId, appointmentId);
    if (!['pending', 'confirmed'].includes(ap.status)) {
      throw new AgendaOperationError(
        'Somente atendimentos pendentes ou confirmados podem ser marcados como não compareceu.',
        'regra'
      );
    }
    if (new Date(ap.start_time).getTime() > Date.now()) {
      throw new AgendaOperationError('O atendimento ainda não começou.', 'regra');
    }
    return this.move(ap, 'no_show');
  }

  private find(tenantId: string, appointmentId: string) {
    const ap = this.agendamentos.get(appointmentId);
    if (!ap || ap.tenant_id !== tenantId) {
      throw new AgendaOperationError('Agendamento não encontrado.', 'regra');
    }
    return ap;
  }

  private move(ap: AgendamentoEmMemoria, status: AgendamentoStatus): AgendaTransitionResult {
    ap.status = status;
    return { appointment_id: ap.id, status };
  }
}
