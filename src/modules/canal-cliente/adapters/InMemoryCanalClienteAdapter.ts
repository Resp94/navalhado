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

  async inicializarPorSlug(slug: string, existingToken?: string | null): Promise<{ token: string; perfil: PerfilClienteCanal }> {
    if (!slug || slug === 'invalid') {
      throw new CanalClienteTokenError('Estabelecimento não encontrado.');
    }
    const token = existingToken || `token_${slug}`;
    let perfil = this.perfis.get(token);
    if (!perfil) {
      perfil = {
        customer_id: `cust_${slug}`,
        customer_name: 'Cliente Provisório',
        tenant_id: `tenant_${slug}`,
        tenant_name: `Barbearia ${slug}`,
        tenant_phone: '11999999999',
        tenant_slug: slug,
        cadastro_completo: false,
      };
      this.perfis.set(token, perfil);
    }
    this.definirToken(token);
    return { token, perfil };
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

    const targetProfId = input.professionalId || 'p1';
    const conflito = this.agendamentos.some(
      (a) =>
        a.start_time === input.startTime &&
        a.professional_id === targetProfId &&
        a.status !== 'canceled'
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
      professional_id: targetProfId,
      professional_name: 'Barbeiro Teste',
      professional_phone: '92999999999',
      service_id: input.serviceId,
      service_name: 'Corte Teste',
      service_price: 50,
      service_duration: 30,
      tenant_id: perfil.tenant_id,
      tenant_name: perfil.tenant_name,
      tenant_phone: perfil.tenant_phone,
      customer_name: perfil.customer_name,
      min_cancellation_lead_time_minutes: 120,
      min_booking_lead_time_minutes: 15,
      slot_interval_minutes: 30,
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

    const newTime = input.newStartTime || (input.newDate && input.newSlot ? `${input.newDate}T${input.newSlot}:00` : agendamento.start_time);
    agendamento.start_time = newTime;
    if (input.newServiceId) agendamento.service_id = input.newServiceId;
    if (input.newProfessionalId) agendamento.professional_id = input.newProfessionalId;

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
