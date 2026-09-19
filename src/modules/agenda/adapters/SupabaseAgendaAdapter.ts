import { supabase } from '../../../lib/supabase';
import { AgendaOperationError } from '../AgendaRepository';
import type { AgendaTransitionResult, IAgendaAdapter } from '../types';

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

  async marcarFalta(tenantId: string, appointmentId: string): Promise<AgendaTransitionResult> {
    return await this.call('mark_appointment_no_show', {
      p_appointment_id: appointmentId,
      p_tenant_id: tenantId,
    });
  }

  private async call(fn: string, params: Record<string, string>): Promise<AgendaTransitionResult> {
    const { data, error } = await supabase.rpc(fn, params);
    if (error) throw toOperationError(error);
    if (!data) throw new AgendaOperationError('Resposta vazia ao atualizar o agendamento.');
    return { appointment_id: data.appointment_id, status: data.status };
  }
}
