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

export interface ReagendarInput {
  /** Novo início, em ISO 8601. O fim é calculado no banco pela duração do profissional. */
  startTimeIso: string;
  /** Novo profissional; omitido, mantém o atual. */
  professionalId?: string | null;
}

export interface HorariosLivresInput {
  professionalId: string;
  serviceId: string;
  /** Data local no formato AAAA-MM-DD. */
  date: string;
  /** Agendamento a ignorar na busca (o que está sendo reagendado). */
  excludeAppointmentId?: string | null;
}

export interface AgendaRescheduleResult extends AgendaTransitionResult {
  start_time: string;
  end_time: string;
  professional_id: string;
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
  reagendar(tenantId: string, appointmentId: string, input: ReagendarInput): Promise<AgendaRescheduleResult>;
  listarHorariosLivres(tenantId: string, input: HorariosLivresInput): Promise<string[]>;
  marcarFalta(tenantId: string, appointmentId: string): Promise<AgendaTransitionResult>;
}
