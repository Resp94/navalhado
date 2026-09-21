import { supabase } from '../../../lib/supabase';
import { AgendaOperationError } from '../AgendaRepository';
import type { BlockedSlot } from '../../bloqueios/types';
import type {
  AgendaCreateResult,
  AgendaDoDia,
  AgendaDoDiaInput,
  AgendaRescheduleResult,
  AgendaTransitionResult,
  AgendamentoDoDia,
  CadastrosDoProfissional,
  CriarAgendamentoInput,
  HorariosLivresInput,
  IAgendaAdapter,
  ReagendarInput,
} from '../types';

type RpcError = { code?: string; message?: string };

// P0001/22023: recusa de regra com mensagem própria do banco; 42501: papel ou unidade.
const toOperationError = (error: RpcError): AgendaOperationError => {
  const message = error.message || 'Erro ao atualizar o agendamento.';
  if (error.code === '42501') return new AgendaOperationError(message, 'acesso');
  if (error.code === 'P0001' || error.code === '22023') return new AgendaOperationError(message, 'regra');
  return new AgendaOperationError(message, 'desconhecido');
};

export class SupabaseAgendaAdapter implements IAgendaAdapter {
  async iniciarAtendimento(tenantId: string, appointmentId: string): Promise<AgendaTransitionResult> {
    return await this.call('start_appointment_service', {
      p_appointment_id: appointmentId,
      p_tenant_id: tenantId,
    });
  }

  async cancelar(tenantId: string, appointmentId: string, motivo: string): Promise<AgendaTransitionResult> {
    return await this.call('cancel_appointment_by_manager', {
      p_appointment_id: appointmentId,
      p_tenant_id: tenantId,
      p_reason: motivo,
    });
  }

  async reagendar(tenantId: string, appointmentId: string, input: ReagendarInput): Promise<AgendaRescheduleResult> {
    const data = await this.rpc('reschedule_appointment_by_manager', {
      p_appointment_id: appointmentId,
      p_tenant_id: tenantId,
      p_new_start_time: input.startTimeIso,
      p_new_professional_id: input.professionalId ?? null,
    });
    return {
      appointment_id: data.appointment_id,
      status: data.status,
      start_time: data.start_time,
      end_time: data.end_time,
      professional_id: data.professional_id,
    };
  }

  async criarAgendamento(tenantId: string, input: CriarAgendamentoInput): Promise<AgendaCreateResult> {
    const novo = input.cliente.tipo === 'novo' ? input.cliente : null;
    const data = await this.rpc('create_appointment_by_manager', {
      p_tenant_id: tenantId,
      p_service_id: input.serviceId,
      p_start_time: input.startTimeIso,
      p_professional_id: input.professionalId ?? null,
      p_customer_id: input.cliente.tipo === 'existente' ? input.cliente.id : null,
      p_new_customer_name: novo ? novo.nome : null,
      p_new_customer_phone: novo ? novo.telefone : null,
      p_is_fitting: input.isFitting ?? false,
      p_notes: input.notes ?? null,
      p_waiting_list_id: input.waitingListId ?? null,
    });
    return {
      appointment_id: data.appointment_id,
      status: data.status,
      customer_id: data.customer_id ?? null,
      professional_id: data.professional_id,
      start_time: data.start_time,
      end_time: data.end_time,
      is_fitting: Boolean(data.is_fitting),
    };
  }

  async listarHorariosLivres(tenantId: string, input: HorariosLivresInput): Promise<string[]> {
    const { data, error } = await supabase.rpc('get_available_slots', {
      p_tenant_id: tenantId,
      p_professional_id: input.professionalId,
      p_service_id: input.serviceId,
      p_date: input.date,
      p_exclude_appointment_id: input.excludeAppointmentId ?? null,
    });
    if (error) throw toOperationError(error);
    return ((data as unknown[]) || []).map((slot) => {
      if (typeof slot === 'object' && slot !== null) {
        const row = slot as { slot_time?: string; slot?: string };
        return String(row.slot_time ?? row.slot ?? '');
      }
      return String(slot);
    });
  }

  async marcarFalta(tenantId: string, appointmentId: string): Promise<AgendaTransitionResult> {
    return await this.call('mark_appointment_no_show', {
      p_appointment_id: appointmentId,
      p_tenant_id: tenantId,
    });
  }

  async carregarAgendaDoDia(tenantId: string, input: AgendaDoDiaInput): Promise<AgendaDoDia> {
    const agendamentosDoDia = () => {
      let consulta = supabase
        .from('appointments')
        .select(`
          id,
          start_time,
          end_time,
          status,
          payment_status,
          is_fitting,
          notes,
          origin,
          cancellation_reason,
          canceled_by,
          professional_id,
          customer:customers (id, name, phone),
          service:services (id, name, price, duration_minutes)
        `)
        .eq('tenant_id', tenantId);
      if (input.professionalId !== undefined) {
        consulta = consulta.eq('professional_id', input.professionalId);
      }
      return consulta.gte('start_time', input.startIso).lt('start_time', input.endExclusiveIso);
    };

    const [apptRes, cancelRes, blockRes] = await Promise.all([
      agendamentosDoDia().neq('status', 'canceled').order('start_time', { ascending: true }),
      input.incluirCancelados
        ? agendamentosDoDia().eq('status', 'canceled').order('start_time', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('blocked_slots')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('start_time', input.startIso)
        .lt('start_time', input.endExclusiveIso)
        .order('start_time', { ascending: true }),
    ]);

    if (apptRes.error) throw this.readError(apptRes.error, 'Não foi possível carregar os atendimentos.');
    if (cancelRes.error) throw this.readError(cancelRes.error, 'Não foi possível carregar os cancelamentos.');
    if (blockRes.error) throw this.readError(blockRes.error, 'Não foi possível carregar os bloqueios.');

    return {
      appointments: (apptRes.data || []).map((item: any) => this.mapAgendamentoDoDia(item)),
      canceledAppointments: (cancelRes.data || []).map((item: any) => this.mapAgendamentoDoDia(item)),
      blockedSlots: (blockRes.data || []) as BlockedSlot[],
    };
  }

  private mapAgendamentoDoDia(item: any): AgendamentoDoDia {
    return {
      id: item.id,
      start_time: item.start_time,
      end_time: item.end_time,
      status: item.status,
      payment_status: item.payment_status,
      is_fitting: Boolean(item.is_fitting),
      notes: item.notes,
      origin: item.origin,
      cancellation_reason: item.cancellation_reason?.trim() || null,
      canceled_by: item.canceled_by ?? null,
      professional_id: item.professional_id,
      customer: Array.isArray(item.customer) ? item.customer[0] : item.customer,
      service: Array.isArray(item.service) ? item.service[0] : item.service,
    };
  }

  async carregarCadastrosDoProfissional(tenantId: string, professionalId: string): Promise<CadastrosDoProfissional> {
    const [profRes, servsRes, custsRes, profServicesRes] = await Promise.all([
      supabase
        .from('professionals')
        .select('id, name, is_active, phone, weekly_schedule')
        .eq('id', professionalId)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .maybeSingle(),
      supabase
        .from('services')
        .select('id, name, price, duration_minutes')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name'),
      supabase.from('customers').select('id, name, phone').eq('tenant_id', tenantId).order('name'),
      supabase
        .from('professional_services')
        .select('professional_id, service_id, custom_duration_minutes, is_enabled')
        .eq('tenant_id', tenantId)
        .eq('professional_id', professionalId),
    ]);

    if (profRes.error) throw this.readError(profRes.error, 'Não foi possível carregar o profissional.');
    if (servsRes.error) throw this.readError(servsRes.error, 'Não foi possível carregar os serviços.');
    if (custsRes.error) throw this.readError(custsRes.error, 'Não foi possível carregar os clientes.');
    if (profServicesRes.error) {
      throw this.readError(profServicesRes.error, 'Não foi possível carregar os serviços do profissional.');
    }

    const professionalServices = (profServicesRes.data || []).map((item) => ({
      service_id: item.service_id,
      custom_duration_minutes: item.custom_duration_minutes,
      is_enabled: item.is_enabled,
    }));

    return {
      professional: profRes.data ? { ...profRes.data, professional_services: professionalServices } : null,
      services: servsRes.data || [],
      customers: custsRes.data || [],
    };
  }

  private readError(error: RpcError, fallback: string): AgendaOperationError {
    return new AgendaOperationError(error.message || fallback, error.code === '42501' ? 'acesso' : 'desconhecido');
  }

  private async call(fn: string, params: Record<string, string>): Promise<AgendaTransitionResult> {
    const data = await this.rpc(fn, params);
    return { appointment_id: data.appointment_id, status: data.status };
  }

  private async rpc(fn: string, params: Record<string, string | boolean | null>) {
    const { data, error } = await supabase.rpc(fn, params);
    if (error) throw toOperationError(error);
    if (!data) throw new AgendaOperationError('Resposta vazia ao atualizar o agendamento.');
    return data;
  }
}
