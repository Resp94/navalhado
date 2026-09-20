import { AgendaOperationError } from '../AgendaRepository';
import type {
  AgendaCreateResult,
  AgendaDoDia,
  AgendaDoDiaInput,
  AgendaRescheduleResult,
  AgendaTransitionResult,
  AgendamentoStatus,
  CadastrosDoProfissional,
  CriarAgendamentoInput,
  HorariosLivresInput,
  IAgendaAdapter,
  ReagendarInput,
} from '../types';

interface AgendamentoEmMemoria {
  id: string;
  tenant_id: string;
  status: AgendamentoStatus;
  start_time: string;
  end_time?: string;
  professional_id?: string;
  duration_minutes?: number;
  cancellation_reason?: string | null;
}

/** Fake usado em testes: aplica a mesma tabela de transições que as RPCs do banco. */
export class InMemoryAgendaAdapter implements IAgendaAdapter {
  private agendamentos = new Map<string, AgendamentoEmMemoria>();
  private slots: string[] = [];
  private slotsError: Error | null = null;
  private createError: Error | null = null;
  private nextId = 1;
  private agendaDoDia: AgendaDoDia = { appointments: [], blockedSlots: [] };
  private cadastros: CadastrosDoProfissional = { professional: null, services: [], customers: [] };

  failCreateWith(error: Error) {
    this.createError = error;
  }

  async criarAgendamento(tenantId: string, input: CriarAgendamentoInput): Promise<AgendaCreateResult> {
    if (this.createError) throw this.createError;
    const id = `ap-novo-${this.nextId++}`;
    const start = new Date(input.startTimeIso);
    const end = new Date(start.getTime() + 40 * 60_000);
    const professionalId = input.professionalId ?? 'prof-resolvido';
    const customerId = input.cliente.tipo === 'existente' ? input.cliente.id : input.cliente.tipo === 'novo' ? `cust-${id}` : null;
    this.agendamentos.set(id, {
      id,
      tenant_id: tenantId,
      status: 'confirmed',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      professional_id: professionalId,
    });
    return {
      appointment_id: id,
      status: 'confirmed',
      customer_id: customerId,
      professional_id: professionalId,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      is_fitting: input.isFitting ?? false,
    };
  }

  seedSlots(slots: string[]) {
    this.slots = [...slots];
  }

  failSlotsWith(error: Error) {
    this.slotsError = error;
  }

  async listarHorariosLivres(_tenantId: string, _input: HorariosLivresInput): Promise<string[]> {
    if (this.slotsError) throw this.slotsError;
    return [...this.slots];
  }

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

  async reagendar(tenantId: string, appointmentId: string, input: ReagendarInput): Promise<AgendaRescheduleResult> {
    const ap = this.find(tenantId, appointmentId);
    if (!['pending', 'confirmed'].includes(ap.status)) {
      throw new AgendaOperationError('Somente atendimentos pendentes ou confirmados podem ser reagendados.', 'regra');
    }
    const start = new Date(input.startTimeIso);
    ap.start_time = start.toISOString();
    ap.end_time = new Date(start.getTime() + (ap.duration_minutes ?? 40) * 60_000).toISOString();
    ap.professional_id = input.professionalId ?? ap.professional_id ?? '';
    return {
      appointment_id: ap.id,
      status: ap.status,
      start_time: ap.start_time,
      end_time: ap.end_time,
      professional_id: ap.professional_id,
    };
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

  seedAgendaDoDia(agenda: AgendaDoDia) {
    this.agendaDoDia = { appointments: [...agenda.appointments], blockedSlots: [...agenda.blockedSlots] };
  }

  seedCadastros(cadastros: CadastrosDoProfissional) {
    this.cadastros = { ...cadastros };
  }

  async carregarAgendaDoDia(_tenantId: string, input: AgendaDoDiaInput): Promise<AgendaDoDia> {
    const start = Date.parse(input.startIso);
    const end = Date.parse(input.endExclusiveIso);
    const dentro = (iso: string) => Date.parse(iso) >= start && Date.parse(iso) < end;

    return {
      appointments: this.agendaDoDia.appointments
        .filter((a) => a.professional_id === input.professionalId && a.status !== 'canceled' && dentro(a.start_time))
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
      blockedSlots: this.agendaDoDia.blockedSlots.filter((b) => dentro(b.start_time)),
    };
  }

  async carregarCadastrosDoProfissional(_tenantId: string, _professionalId: string): Promise<CadastrosDoProfissional> {
    return { ...this.cadastros };
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
