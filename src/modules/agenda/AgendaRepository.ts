import type {
  AgendaCreateResult,
  AgendaOperationErrorKind,
  AgendaRescheduleResult,
  AgendaTransitionResult,
  CriarAgendamentoInput,
  HorariosLivresInput,
  IAgendaAdapter,
  ReagendarInput,
} from './types';

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

  async reagendar(tenantId: string, appointmentId: string, input: ReagendarInput): Promise<AgendaRescheduleResult> {
    this.requireIds(tenantId, appointmentId);
    if (!input?.startTimeIso || Number.isNaN(Date.parse(input.startTimeIso))) {
      throw new AgendaValidationError('Informe o novo horário.');
    }
    return await this.adapter.reagendar(tenantId, appointmentId, input);
  }

  /**
   * Cria o Agendamento no banco: expediente, escala, conflito, Bloqueio de Horário, "Tanto faz",
   * Cliente novo e entrada da Lista de Espera são resolvidos numa única transação.
   */
  async criarAgendamento(tenantId: string, input: CriarAgendamentoInput): Promise<AgendaCreateResult> {
    if (!tenantId || !tenantId.trim()) {
      throw new AgendaValidationError('ID da barbearia é obrigatório.');
    }
    if (!input.serviceId || !input.serviceId.trim()) {
      throw new AgendaValidationError('Selecione um serviço.');
    }
    if (!input.startTimeIso || Number.isNaN(Date.parse(input.startTimeIso))) {
      throw new AgendaValidationError('Informe o horário do agendamento.');
    }
    if (input.cliente.tipo === 'existente' && !input.cliente.id?.trim()) {
      throw new AgendaValidationError('Selecione ou cadastre um cliente.');
    }
    if (input.cliente.tipo === 'novo') {
      if (!input.cliente.nome?.trim()) {
        throw new AgendaValidationError('Informe o nome do cliente.');
      }
      if ((input.cliente.telefone || '').replace(/\D/g, '').length < 10) {
        throw new AgendaValidationError('Telefone inválido (mínimo DDD + 8 dígitos).');
      }
    }
    return await this.adapter.criarAgendamento(tenantId, { ...input, professionalId: input.professionalId ?? null });
  }

  /** Horários livres vindos do banco; falha na consulta é erro, nunca uma grade inventada. */
  async listarHorariosLivres(tenantId: string, input: HorariosLivresInput): Promise<string[]> {
    if (!tenantId || !tenantId.trim()) {
      throw new AgendaValidationError('ID da barbearia é obrigatório.');
    }
    if (!input.professionalId || !input.serviceId || !input.date) {
      throw new AgendaValidationError('Informe profissional, serviço e data para buscar horários.');
    }
    return await this.adapter.listarHorariosLivres(tenantId, input);
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
