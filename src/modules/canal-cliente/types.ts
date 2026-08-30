export interface PerfilClienteCanal {
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  tenant_id: string;
  tenant_name: string;
  tenant_phone: string;
  tenant_slug?: string;
  cadastro_completo: boolean;
  token_acesso?: string;
  min_cancellation_lead_time_minutes?: number;
  min_booking_lead_time_minutes?: number;
  slot_interval_minutes?: number;
  tenant_timezone?: string;
  business_hours?: Record<string, { active: boolean; open: string; close: string }>;
}

export interface ContextoPublicoCanal {
  tenant_id: string;
  tenant_name: string;
  tenant_phone: string;
  tenant_slug: string;
  logo_url?: string | null;
  timezone: string;
  business_hours?: Record<string, { active: boolean; open: string; close: string }>;
  slot_interval_minutes: number;
  min_booking_lead_time_minutes: number;
  min_cancellation_lead_time_minutes: number;
}

export interface HorarioGradeCanal {
  slot_time: string;
  available: boolean;
}

export interface IdentidadeClientePublica {
  found: boolean;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  cadastro_completo?: boolean;
  tenant_id: string;
  tenant_name: string;
  tenant_phone: string;
  tenant_slug: string;
}

export interface DadosSessaoPublica {
  found: boolean;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  cadastro_completo?: boolean;
  tenant_id: string;
  tenant_name: string;
  tenant_phone: string;
  tenant_slug: string;
  tenant_timezone?: string;
  business_hours?: Record<string, { active: boolean; open: string; close: string }>;
  min_cancellation_lead_time_minutes?: number;
  min_booking_lead_time_minutes?: number;
  slot_interval_minutes?: number;
}

export interface ServicoCanal {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  category: string;
  is_active: boolean;
  display_order?: number;
}

export interface ProfissionalCanal {
  id: string;
  name: string;
  phone?: string;
  is_active: boolean;
}

export interface AgendamentoCanal {
  appointment_id: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'canceled';
  payment_status: 'pending' | 'paid';
  cancellation_reason: string | null;
  professional_name: string;
  professional_id: string;
  professional_phone?: string;
  service_name: string;
  service_id: string;
  service_price: number;
  service_duration: number;
  tenant_name: string;
  tenant_id: string;
  tenant_phone: string;
  customer_name: string;
  min_cancellation_lead_time_minutes?: number;
  min_booking_lead_time_minutes?: number;
  slot_interval_minutes?: number;
}

export interface InputCriarAgendamento {
  serviceId: string;
  professionalId: string | null;
  startTime: string;
}

export interface InputConfirmarAgendamentoPublico {
  slug: string;
  token?: string | null;
  serviceId: string;
  professionalId: string | null;
  date: string;
  slot: string;
  name: string;
  phone: string;
}

export interface ConfirmacaoAgendamentoPublico {
  appointmentId: string;
  customerId: string;
  token: string;
  customerName: string;
  customerPhone: string;
}

export interface InputReagendarAgendamento {
  appointmentId: string;
  newStartTime?: string;
  newServiceId?: string;
  newProfessionalId?: string | null;
  newDate?: string;
  newSlot?: string;
}


export interface InputPromoverCadastroCliente {
  name: string;
  email?: string | null;
  phone?: string | null;
}

export interface ICanalClienteAdapter {
  obterTokenAtual(): string | null;
  definirToken(token: string): void;
  limparToken(): void;
  buscarPerfilPorToken(token: string): Promise<PerfilClienteCanal | null>;
  buscarContextoPublicoPorSlug(slug: string): Promise<ContextoPublicoCanal | null>;
  buscarIdentidadePublica(
    slug: string,
    name: string,
    phone: string
  ): Promise<IdentidadeClientePublica | null>;
  iniciarSessaoPublica(
    slug: string,
    name: string,
    phone: string,
    captchaToken?: string,
  ): Promise<DadosSessaoPublica | null>;
  obterPerfilPublicoSessao(): Promise<PerfilClienteCanal | null>;
  encerrarSessaoPublica(): Promise<void>;
  listarAgendamentosPublicoSessao(): Promise<AgendamentoCanal[]>;
  cancelarAgendamentoPublicoSessao(appointmentId: string, motivo?: string): Promise<void>;
  reagendarAgendamentoPublicoSessao(input: InputReagendarAgendamento): Promise<void>;
  listarServicosPorSlug(slug: string): Promise<ServicoCanal[]>;
  listarProfissionaisPorSlug(slug: string, serviceId: string): Promise<ProfissionalCanal[]>;
  buscarGradeHorariosPorSlug(
    slug: string,
    data: string,
    serviceId: string,
    professionalId?: string | null
  ): Promise<HorarioGradeCanal[]>;
  confirmarAgendamentoPublico(
    input: InputConfirmarAgendamentoPublico
  ): Promise<ConfirmacaoAgendamentoPublico>;
  inicializarPorSlug(slug: string, existingToken?: string | null): Promise<{ token: string; perfil: PerfilClienteCanal }>;
  listarServicosPorToken(token: string): Promise<ServicoCanal[]>;
  listarProfissionaisPorToken(token: string): Promise<ProfissionalCanal[]>;
  buscarHorariosDisponiveisPorToken(
    token: string,
    data: string,
    serviceId: string,
    professionalId?: string | null,
    excludeAppointmentId?: string | null
  ): Promise<string[]>;
  criarAgendamentoPorToken(
    token: string,
    input: InputCriarAgendamento
  ): Promise<{ appointmentId: string }>;
  reagendarAgendamentoPorToken(
    token: string,
    input: InputReagendarAgendamento
  ): Promise<void>;
  cancelarAgendamentoPorToken(
    token: string,
    appointmentId: string,
    motivo?: string
  ): Promise<void>;
  listarAgendamentosPorToken(token: string): Promise<AgendamentoCanal[]>;
  promoverCadastroPorToken(
    token: string,
    input: InputPromoverCadastroCliente
  ): Promise<PerfilClienteCanal | void>;
  buscarClientePorTelefone(
    token: string,
    telefone: string
  ): Promise<{ found: boolean; customer_id?: string; customer_name?: string; customer_phone?: string; cadastro_completo?: boolean } | null>;
}
