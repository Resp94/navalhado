import type { WeeklySchedule } from '../../lib/schedule';
import type { BlockedSlot } from '../bloqueios/types';

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

export type ClienteDoAgendamento =
  | { tipo: 'existente'; id: string }
  | { tipo: 'novo'; nome: string; telefone: string }
  | { tipo: 'nenhum' };

export interface CriarAgendamentoInput {
  serviceId: string;
  /** Início em ISO 8601. O fim é calculado no banco pela duração do profissional. */
  startTimeIso: string;
  /** Omitido ou nulo é "Tanto faz": o banco resolve o profissional. */
  professionalId?: string | null;
  cliente: ClienteDoAgendamento;
  isFitting?: boolean;
  notes?: string | null;
  /** Entrada da Lista de Espera a consumir na mesma operação. */
  waitingListId?: string | null;
}

export interface AgendaCreateResult extends AgendaTransitionResult {
  customer_id: string | null;
  professional_id: string;
  start_time: string;
  end_time: string;
  is_fitting: boolean;
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

/** Agendamento como a agenda o mostra: com o cliente e o serviço já resolvidos. */
export interface AgendamentoDoDia {
  id: string;
  start_time: string;
  end_time: string;
  status: AgendamentoStatus;
  payment_status: 'pending' | 'paid';
  is_fitting: boolean;
  notes?: string | null;
  origin?: string;
  /** Só preenchido nos Agendamentos cancelados. */
  cancellation_reason?: string | null;
  /** Quem cancelou; nulo quando desconhecido (cancelamento anterior à autoria) ou não cancelado. */
  canceled_by?: 'shop' | 'customer' | null;
  professional_id: string;
  customer: { id: string; name: string; phone: string };
  service: { id: string; name: string; price: number; duration_minutes?: number };
}

export interface AgendaDoDiaInput {
  /** Omitido: tudo o que o usuário pode ver (o gerente, a barbearia; o barbeiro, só os próprios). */
  professionalId?: string;
  /** Início do dia local, em ISO 8601. */
  startIso: string;
  /** Início do dia seguinte, em ISO 8601 (exclusivo). */
  endExclusiveIso: string;
  /** Desligado por padrão: pede também os Agendamentos cancelados, em coleção própria. */
  incluirCancelados?: boolean;
}

export interface AgendaDoDia {
  appointments: AgendamentoDoDia[];
  /** Vazia quando não pedidos; nunca se mistura com `appointments`, que alimenta a grade. */
  canceledAppointments: AgendamentoDoDia[];
  /** Bloqueios de Horário da barbearia no intervalo. */
  blockedSlots: BlockedSlot[];
}

export interface ServicoDaAgenda {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

export interface ClienteDaAgenda {
  id: string;
  name: string;
  phone: string;
}

export interface ProfissionalDaAgenda {
  id: string;
  name: string;
  is_active: boolean;
  phone?: string;
  weekly_schedule?: WeeklySchedule | null;
  professional_services: Array<{
    service_id: string;
    custom_duration_minutes?: number | null;
    is_enabled?: boolean | null;
  }>;
}

/** Cadastros que a agenda de um profissional precisa para criar e reagendar. */
export interface CadastrosDoProfissional {
  /** Nulo quando o cadastro não existe na barbearia. */
  professional: ProfissionalDaAgenda | null;
  services: ServicoDaAgenda[];
  customers: ClienteDaAgenda[];
}

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
  criarAgendamento(tenantId: string, input: CriarAgendamentoInput): Promise<AgendaCreateResult>;
  marcarFalta(tenantId: string, appointmentId: string): Promise<AgendaTransitionResult>;
  /** Agendamentos ativos do profissional no intervalo e Bloqueios de Horário da barbearia. */
  carregarAgendaDoDia(tenantId: string, input: AgendaDoDiaInput): Promise<AgendaDoDia>;
  /** Profissional, serviços ativos e clientes da barbearia. */
  carregarCadastrosDoProfissional(tenantId: string, professionalId: string): Promise<CadastrosDoProfissional>;
}
