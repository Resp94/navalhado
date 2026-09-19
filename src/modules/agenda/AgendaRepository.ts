import type { AgendaOperationErrorKind, AgendaTransitionResult, IAgendaAdapter } from './types';

export class AgendaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgendaValidationError';
  }
}

export class AgendaOperationError extends Error {
  kind: AgendaOperationErrorKind;

  constructor(message: string, kind: AgendaOperationErrorKind = 'desconhecido') {
    super(message);
    this.name = 'AgendaOperationError';
    this.kind = kind;
  }
}

/**
 * Porta única das transições de estado do Agendamento (gestor e barbeiro). Valida
 * a entrada e delega ao adaptador; expediente, estado de origem, horário e papel
 * são decididos pelo banco.
 */
export class AgendaRepository {
  private adapter: IAgendaAdapter;

  constructor(adapter: IAgendaAdapter) {
    this.adapter = adapter;
  }

  async iniciarAtendimento(tenantId: string, appointmentId: string): Promise<AgendaTransitionResult> {
    this.requireIds(tenantId, appointmentId);
    return await this.adapter.iniciarAtendimento(tenantId, appointmentId);
  }

  async cancelar(tenantId: string, appointmentId: string, motivo: string): Promise<AgendaTransitionResult> {
    this.requireIds(tenantId, appointmentId);
    const motivoLimpo = motivo?.trim();
    if (!motivoLimpo) {
      throw new AgendaValidationError('Informe o motivo do cancelamento.');
    }
    return await this.adapter.cancelar(tenantId, appointmentId, motivoLimpo);
  }

  async marcarFalta(tenantId: string, appointmentId: string): Promise<AgendaTransitionResult> {
    this.requireIds(tenantId, appointmentId);
    return await this.adapter.marcarFalta(tenantId, appointmentId);
  }

  private requireIds(tenantId: string, appointmentId: string) {
    if (!tenantId || !tenantId.trim()) {
      throw new AgendaValidationError('ID da barbearia é obrigatório.');
    }
    if (!appointmentId || !appointmentId.trim()) {
      throw new AgendaValidationError('ID do agendamento é obrigatório.');
    }
  }
}
