export type AgendamentoStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'canceled'
  | 'no_show';

export interface AgendaTransitionResult {
  appointment_id: string;
  status: AgendamentoStatus;
}

/** regra: recusa de negócio do banco; acesso: papel/unidade; desconhecido: falha inesperada. */
export type AgendaOperationErrorKind = 'regra' | 'acesso' | 'desconhecido';

/**
 * Transições de estado do Agendamento feitas pelo gestor e pelo barbeiro. A regra
 * (estado de origem, horário, papel, unidade) mora no banco; o adaptador só chama
 * a RPC e devolve o resultado ou lança AgendaOperationError.
 */
export interface IAgendaAdapter {
  iniciarAtendimento(tenantId: string, appointmentId: string): Promise<AgendaTransitionResult>;
  cancelar(tenantId: string, appointmentId: string, motivo: string): Promise<AgendaTransitionResult>;
  marcarFalta(tenantId: string, appointmentId: string): Promise<AgendaTransitionResult>;
}
