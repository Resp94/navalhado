import {
  CanalClienteTokenError,
  AgendamentoConflitoError,
  AgendamentoRegraCancelamentoError,
} from '../errors';
import type {
  AgendamentoCanal,
  ICanalClienteAdapter,
  InputCriarAgendamento,
  InputPromoverCadastroCliente,
  InputReagendarAgendamento,
  PerfilClienteCanal,
  ProfissionalCanal,
  ServicoCanal,
} from '../types';

export class InMemoryCanalClienteAdapter implements ICanalClienteAdapter {
  private activeToken: string | null = null;
  public perfis: Map<string, PerfilClienteCanal> = new Map();
  public servicos: ServicoCanal[] = [];
  public profissionais: ProfissionalCanal[] = [];
  public agendamentos: AgendamentoCanal[] = [];
  public slotsDisponiveis: Map<string, string[]> = new Map();

  obterTokenAtual(): string | null {
    return this.activeToken;
  }

  definirToken(token: string): void {
    this.activeToken = token;
  }

  limparToken(): void {
    this.activeToken = null;
  }

  async buscarPerfilPorToken(token: string): Promise<PerfilClienteCanal | null> {
    if (!token || token === 'invalid') {
      throw new CanalClienteTokenError();
    }
    return this.perfis.get(token) || null;
  }

  async listarServicosPorToken(token: string): Promise<ServicoCanal[]> {
    if (!token || token === 'invalid') throw new CanalClienteTokenError();
    return this.servicos.filter((s) => s.is_active);
  }

  async listarProfissionaisPorToken(token: string): Promise<ProfissionalCanal[]> {
    if (!token || token === 'invalid') throw new CanalClienteTokenError();
    return this.profissionais.filter((p) => p.is_active);
  }

  async buscarHorariosDisponiveisPorToken(
    token: string,
    dataStr: string,
    serviceId: string,
    professionalId?: string | null
  ): Promise<string[]> {
    if (!token || token === 'invalid') throw new CanalClienteTokenError();
    const key = `${dataStr}_${serviceId}_${professionalId || 'any'}`;
    return this.slotsDisponiveis.get(key) || ['09:00', '10:00', '11:00', '14:00', '15:00'];
  }

  async criarAgendamentoPorToken(
    token: string,
    input: InputCriarAgendamento
  ): Promise<{ appointmentId: string }> {
    if (!token || token === 'invalid') throw new CanalClienteTokenError();
    const perfil = this.perfis.get(token);
    if (!perfil) throw new CanalClienteTokenError();

    const conflito = this.agendamentos.some(
      (a) => a.start_time === input.startTime && a.status !== 'canceled'
    );
    if (conflito) throw new AgendamentoConflitoError();

    const id = `app_${Date.now()}`;
    const novoAgendamento: AgendamentoCanal = {
      appointment_id: id,
      start_time: input.startTime,
      end_time: input.startTime,
      status: 'confirmed',
      payment_status: 'pending',
      cancellation_reason: null,
      professional_id: input.professionalId || 'p1',
      professional_name: 'Barbeiro Teste',
      service_id: input.serviceId,
      service_name: 'Corte Teste',
      service_price: 50,
      service_duration: 30,
      tenant_id: perfil.tenant_id,
      tenant_name: perfil.tenant_name,
      tenant_phone: perfil.tenant_phone,
      customer_name: perfil.customer_name,
    };

    this.agendamentos.push(novoAgendamento);
    return { appointmentId: id };
  }

  async reagendarAgendamentoPorToken(
    token: string,
    input: InputReagendarAgendamento
  ): Promise<void> {
    if (!token || token === 'invalid') throw new CanalClienteTokenError();
    const agendamento = this.agendamentos.find((a) => a.appointment_id === input.appointmentId);
    if (!agendamento) throw new Error('Agendamento não encontrado');

    agendamento.start_time = input.newStartTime;
  }

  async cancelarAgendamentoPorToken(
    token: string,
    appointmentId: string,
    motivo?: string
  ): Promise<void> {
    if (!token || token === 'invalid') throw new CanalClienteTokenError();
    const agendamento = this.agendamentos.find((a) => a.appointment_id === appointmentId);
    if (!agendamento) throw new Error('Agendamento não encontrado');

    if (agendamento.status === 'canceled') {
      throw new AgendamentoRegraCancelamentoError('Agendamento já está cancelado');
    }

    agendamento.status = 'canceled';
    agendamento.cancellation_reason = motivo || 'Cancelado pelo cliente';
  }

  async listarAgendamentosPorToken(token: string): Promise<AgendamentoCanal[]> {
    if (!token || token === 'invalid') throw new CanalClienteTokenError();
    return this.agendamentos;
  }

  async promoverCadastroPorToken(
    token: string,
    input: InputPromoverCadastroCliente
  ): Promise<void> {
    if (!token || token === 'invalid') throw new CanalClienteTokenError();
    const perfil = this.perfis.get(token);
    if (perfil) {
      perfil.customer_name = input.name;
      perfil.cadastro_completo = true;
    }
  }
}
