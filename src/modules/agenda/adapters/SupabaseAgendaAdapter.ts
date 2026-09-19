import { supabase } from '../../../lib/supabase';
import { AgendaOperationError } from '../AgendaRepository';
import type {
  AgendaRescheduleResult,
  AgendaTransitionResult,
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

  private async call(fn: string, params: Record<string, string>): Promise<AgendaTransitionResult> {
    const data = await this.rpc(fn, params);
    return { appointment_id: data.appointment_id, status: data.status };
  }

  private async rpc(fn: string, params: Record<string, string | null>) {
    const { data, error } = await supabase.rpc(fn, params);
    if (error) throw toOperationError(error);
    if (!data) throw new AgendaOperationError('Resposta vazia ao atualizar o agendamento.');
    return data;
  }
}
