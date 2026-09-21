import type {
  AgendaCreateResult,
  AgendaDoDiaInput,
  AgendaOperationErrorKind,
  AgendaRescheduleResult,
  AgendaTransitionResult,
  AgendamentosDoDia,
  CadastrosDoProfissional,
  CriarAgendamentoInput,
  HorariosLivresInput,
  IAgendaAdapter,
  IntervaloDaAgenda,
  ReagendarInput,
} from './types';
import type { BlockedSlot } from '../bloqueios/types';

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

  /**
   * Agendamentos do dia. Sem profissional, devolve tudo o que o usuário pode ver; o recorte vem do banco
   * (o gerente, a barbearia; o barbeiro, só os próprios Agendamentos), então omitir o profissional não
   * amplia acesso. Em branco não é omitido: é recusado. Os Bloqueios de Horário têm leitura própria
   * (`carregarBloqueiosDoDia`): a falha de uma leitura não esconde a outra.
   */
  async carregarAgendamentosDoDia(tenantId: string, input: AgendaDoDiaInput): Promise<AgendamentosDoDia> {
    this.requireTenant(tenantId);
    if (input.professionalId !== undefined && !input.professionalId.trim()) {
      throw new AgendaValidationError('ID do profissional não pode ficar em branco.');
    }
    this.requireIntervalo(input);
    return await this.adapter.carregarAgendamentosDoDia(tenantId, input);
  }

  /** Bloqueios de Horário da barbearia no intervalo. */
  async carregarBloqueiosDoDia(tenantId: string, input: IntervaloDaAgenda): Promise<BlockedSlot[]> {
    this.requireTenant(tenantId);
    this.requireIntervalo(input);
    return await this.adapter.carregarBloqueiosDoDia(tenantId, input);
  }

  /** Cadastros de apoio da agenda. Serviço que o profissional não executa fica fora da lista. */
  async carregarCadastrosDoProfissional(tenantId: string, professionalId: string): Promise<CadastrosDoProfissional> {
    this.requireTenant(tenantId);
    if (!professionalId || !professionalId.trim()) {
      throw new AgendaValidationError('ID do profissional é obrigatório.');
    }
    const cadastros = await this.adapter.carregarCadastrosDoProfissional(tenantId, professionalId);
    const desabilitados = new Set(
      (cadastros.professional?.professional_services ?? [])
        .filter((item) => item.is_enabled === false)
        .map((item) => item.service_id)
    );
    return { ...cadastros, services: cadastros.services.filter((service) => !desabilitados.has(service.id)) };
  }

  private requireIntervalo(input: IntervaloDaAgenda) {
    const start = Date.parse(input.startIso);
    const end = Date.parse(input.endExclusiveIso);
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      throw new AgendaValidationError('Informe um intervalo de datas válido.');
    }
  }

  private requireTenant(tenantId: string) {
    if (!tenantId || !tenantId.trim()) {
      throw new AgendaValidationError('ID da barbearia é obrigatório.');
    }
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
