import {
  CanalClienteTokenError,
  AgendamentoConflitoError,
  AgendamentoRegraCancelamentoError,
} from '../errors';
import type {
  AgendamentoCanal,
  ContextoPublicoCanal,
  DadosSessaoPublica,
  HorarioGradeCanal,
  IdentidadeClientePublica,
  ICanalClienteAdapter,
  ConfirmacaoAgendamentoPublico,
  InputConfirmarAgendamentoPublico,
  InputCriarAgendamento,
  InputPromoverCadastroCliente,
  InputReagendarAgendamento,
  PerfilClienteCanal,
  ProfissionalCanal,
  ServicoCanal,
} from '../types';

export class InMemoryCanalClienteAdapter implements ICanalClienteAdapter {
  private activeToken: string | null = null;
  private publicSessionProfile: PerfilClienteCanal | null = null;
  public perfis: Map<string, PerfilClienteCanal> = new Map();
  public contextosPublicos: Map<string, ContextoPublicoCanal> = new Map();
  public servicos: ServicoCanal[] = [];
  public profissionais: ProfissionalCanal[] = [];
  public profissionaisPorServico: Map<string, string[]> = new Map();
  public agendamentos: AgendamentoCanal[] = [];
  public slotsDisponiveis: Map<string, string[]> = new Map();
  public gradesPublicas: Map<string, HorarioGradeCanal[]> = new Map();

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

  async buscarContextoPublicoPorSlug(slug: string): Promise<ContextoPublicoCanal | null> {
    if (!slug || slug === 'invalid') {
      return null;
    }
    return this.contextosPublicos.get(slug) || null;
  }

  async buscarIdentidadePublica(
    slug: string,
    name: string,
    phone: string,
  ): Promise<IdentidadeClientePublica | null> {
    const contexto = this.contextosPublicos.get(slug);
    if (!contexto) return null;

    const normalizedPhone = phone.replace(/\D/g, '');
    const entry = Array.from(this.perfis.values()).find((perfil) =>
      perfil.tenant_id === contexto.tenant_id &&
      perfil.cadastro_completo &&
      perfil.customer_name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase() &&
      perfil.customer_phone?.replace(/\D/g, '') === normalizedPhone
    );

    return {
      found: Boolean(entry),
      customer_id: entry?.customer_id,
      customer_name: entry?.customer_name,
      customer_phone: entry?.customer_phone,
      cadastro_completo: entry?.cadastro_completo,
      tenant_id: contexto.tenant_id,
      tenant_name: contexto.tenant_name,
      tenant_phone: contexto.tenant_phone,
      tenant_slug: contexto.tenant_slug,
    };
  }

  async iniciarSessaoPublica(
    slug: string,
    name: string,
    phone: string,
  ): Promise<DadosSessaoPublica | null> {
    const identity = await this.buscarIdentidadePublica(slug, name, phone);
    if (!identity) return null;

    if (identity.found && identity.customer_id && identity.customer_name) {
      this.publicSessionProfile = {
        customer_id: identity.customer_id,
        customer_name: identity.customer_name,
        customer_phone: identity.customer_phone,
        tenant_id: identity.tenant_id,
        tenant_name: identity.tenant_name,
        tenant_phone: identity.tenant_phone,
        tenant_slug: identity.tenant_slug,
        cadastro_completo: true,
      };
    }

    return {
      ...identity,
      tenant_timezone: this.contextosPublicos.get(slug)?.timezone,
      min_cancellation_lead_time_minutes: this.contextosPublicos.get(slug)?.min_cancellation_lead_time_minutes,
      min_booking_lead_time_minutes: this.contextosPublicos.get(slug)?.min_booking_lead_time_minutes,
      slot_interval_minutes: this.contextosPublicos.get(slug)?.slot_interval_minutes,
    };
  }

  async obterPerfilPublicoSessao(): Promise<PerfilClienteCanal | null> {
    return this.publicSessionProfile;
  }

  async encerrarSessaoPublica(): Promise<void> {
    this.publicSessionProfile = null;
  }

  async listarAgendamentosPublicoSessao(): Promise<AgendamentoCanal[]> {
    if (!this.publicSessionProfile) throw new CanalClienteTokenError('Sessão pública inexistente.');
    return this.agendamentos.filter((appointment) =>
      appointment.customer_name === this.publicSessionProfile?.customer_name &&
      appointment.tenant_id === this.publicSessionProfile?.tenant_id
    );
  }

  private tokenDaSessaoPublica(): string {
    const profile = this.publicSessionProfile;
    const entry = profile && Array.from(this.perfis.entries()).find(([, item]) => item.customer_id === profile.customer_id);
    if (!entry) throw new CanalClienteTokenError('Sessão pública inexistente.');
    return entry[0];
  }

  async cancelarAgendamentoPublicoSessao(appointmentId: string, motivo?: string): Promise<void> {
    await this.cancelarAgendamentoPorToken(this.tokenDaSessaoPublica(), appointmentId, motivo);
  }

  async reagendarAgendamentoPublicoSessao(input: InputReagendarAgendamento): Promise<void> {
    await this.reagendarAgendamentoPorToken(this.tokenDaSessaoPublica(), input);
  }

  async listarServicosPorSlug(slug: string): Promise<ServicoCanal[]> {
    if (!this.contextosPublicos.has(slug)) return [];
    return this.servicos.filter((service) => service.is_active);
  }

  async listarProfissionaisPorSlug(slug: string, serviceId: string): Promise<ProfissionalCanal[]> {
    if (!this.contextosPublicos.has(slug)) return [];
    const professionalIds = this.profissionaisPorServico.get(serviceId);
    return this.profissionais.filter((professional) =>
      professional.is_active && (!professionalIds || professionalIds.includes(professional.id))
    );
  }

  async buscarGradeHorariosPorSlug(
    slug: string,
    data: string,
    serviceId: string,
    professionalId?: string | null
  ): Promise<HorarioGradeCanal[]> {
    if (!this.contextosPublicos.has(slug)) return [];
    return this.gradesPublicas.get(`${data}_${serviceId}_${professionalId || 'any'}`) || [];
  }

  async confirmarAgendamentoPublico(
    input: InputConfirmarAgendamentoPublico
  ): Promise<ConfirmacaoAgendamentoPublico> {
    const contexto = this.contextosPublicos.get(input.slug);
    if (!contexto) throw new CanalClienteTokenError('Estabelecimento não encontrado.');

    if (input.token) {
      const tokenProfile = this.perfis.get(input.token);
      if (!tokenProfile || tokenProfile.tenant_id !== contexto.tenant_id || !tokenProfile.cadastro_completo) {
        throw new CanalClienteTokenError('Token inválido para este estabelecimento.');
      }
    }

    const service = this.servicos.find((item) => item.id === input.serviceId && item.is_active);
    const professional = input.professionalId
      ? this.profissionais.find((item) => item.id === input.professionalId && item.is_active)
      : undefined;
    if (!service || (input.professionalId && !professional)) {
      throw new Error('ServiÃ§o ou profissional indisponÃ­vel.');
    }

    const normalizedPhone = input.phone.replace(/\D/g, '');
    let entry = Array.from(this.perfis.entries()).find(([, perfil]) =>
      perfil.tenant_id === contexto.tenant_id && perfil.customer_phone?.replace(/\D/g, '') === normalizedPhone
    );
    let token = entry?.[0];
    let perfil = entry?.[1];

    if (!perfil || !token) {
      token = `token_public_${Date.now()}`;
      perfil = {
        customer_id: `cust_public_${Date.now()}`,
        customer_name: input.name,
        customer_phone: input.phone,
        tenant_id: contexto.tenant_id,
        tenant_name: contexto.tenant_name,
        tenant_phone: contexto.tenant_phone,
        tenant_slug: contexto.tenant_slug,
        cadastro_completo: true,
        token_acesso: token,
      };
      this.perfis.set(token, perfil);
    }

    const appointmentId = `app_public_${Date.now()}`;
    this.agendamentos.push({
      appointment_id: appointmentId,
      start_time: `${input.date}T${input.slot}:00`,
      end_time: `${input.date}T${input.slot}:00`,
      status: 'confirmed',
      payment_status: 'pending',
      cancellation_reason: null,
      professional_id: input.professionalId || 'p1',
      professional_name: professional?.name || 'Barbeiro Teste',
      professional_phone: professional?.phone,
      service_id: service.id,
      service_name: service.name,
      service_price: service.price,
      service_duration: service.duration_minutes,
      tenant_id: contexto.tenant_id,
      tenant_name: contexto.tenant_name,
      tenant_phone: contexto.tenant_phone,
      customer_name: perfil.customer_name,
      min_cancellation_lead_time_minutes: contexto.min_cancellation_lead_time_minutes,
      min_booking_lead_time_minutes: contexto.min_booking_lead_time_minutes,
      slot_interval_minutes: contexto.slot_interval_minutes,
    });

    this.definirToken(token);
    return {
      appointmentId,
      customerId: perfil.customer_id,
      token,
      customerName: perfil.customer_name,
      customerPhone: perfil.customer_phone || input.phone,
    };
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
    professionalId?: string | null,
    _excludeAppointmentId?: string | null
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

  async buscarClientePorTelefone(
    token: string,
    telefone: string
  ): Promise<{ found: boolean; customer_id?: string; customer_name?: string; customer_phone?: string; cadastro_completo?: boolean } | null> {
    if (!token || token === 'invalid') throw new CanalClienteTokenError();
    const cleanPhone = telefone.replace(/\D/g, '');
    for (const perfil of this.perfis.values()) {
      const pPhone = perfil.customer_phone ? perfil.customer_phone.replace(/\D/g, '') : '';
      if (pPhone && (pPhone.includes(cleanPhone) || cleanPhone.includes(pPhone))) {
        return {
          found: true,
          customer_id: perfil.customer_id,
          customer_name: perfil.customer_name,
          customer_phone: perfil.customer_phone,
          cadastro_completo: perfil.cadastro_completo,
        };
      }
    }
    return { found: false };
  }
}
