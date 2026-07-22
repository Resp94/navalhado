import { supabase } from '../../../lib/supabase';
import {
  CanalClienteTokenError,
  AgendamentoConflitoError,
  AgendamentoRegraCancelamentoError,
  CanalClienteValidationError,
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

const TOKEN_STORAGE_KEY = 'navalhado_customer_token';

export class SupabaseCanalClienteAdapter implements ICanalClienteAdapter {
  obterTokenAtual(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  definirToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch (e) {
      console.warn('Não foi possível salvar o token no localStorage:', e);
    }
  }

  limparToken(): void {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (e) {
      console.warn('Não foi possível remover o token do localStorage:', e);
    }
  }

  async buscarPerfilPorToken(token: string): Promise<PerfilClienteCanal | null> {
    const { data, error } = await supabase.rpc('get_customer_details_by_token', {
      p_token: token,
    });

    if (error) {
      throw new CanalClienteTokenError(error.message);
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return null;
    }

    const row = data[0];
    return {
      customer_id: row.customer_id,
      customer_name: row.customer_name,
      customer_phone: row.customer_phone || row.phone,
      tenant_id: row.tenant_id,
      tenant_name: row.tenant_name,
      tenant_phone: row.tenant_phone,
      cadastro_completo: Boolean(row.cadastro_completo),
    };
  }

  async listarServicosPorToken(token: string): Promise<ServicoCanal[]> {
    const { data, error } = await supabase.rpc('get_services_by_customer_token', {
      p_token: token,
    });

    if (error) {
      if (error.message.includes('token') || error.code === 'P0001') {
        throw new CanalClienteTokenError();
      }
      throw error;
    }

    return (data || []) as ServicoCanal[];
  }

  async listarProfissionaisPorToken(token: string): Promise<ProfissionalCanal[]> {
    const { data, error } = await supabase.rpc('get_professionals_by_customer_token', {
      p_token: token,
    });

    if (error) {
      if (error.message.includes('token') || error.code === 'P0001') {
        throw new CanalClienteTokenError();
      }
      throw error;
    }

    return (data || []) as ProfissionalCanal[];
  }

  async buscarHorariosDisponiveisPorToken(
    token: string,
    dataStr: string,
    serviceId: string,
    professionalId?: string | null
  ): Promise<string[]> {
    let res = await supabase.rpc('get_available_slots_by_token', {
      p_token: token,
      p_service_id: serviceId,
      p_professional_id: professionalId || null,
      p_date: dataStr,
      p_exclude_appointment_id: null,
    });

    if (res.error) {
      res = await supabase.rpc('get_available_slots_by_customer_token', {
        p_token: token,
        p_date: dataStr,
        p_service_id: serviceId,
        p_professional_id: professionalId || null,
      });
    }


    if (res.error) {
      if (res.error.message.includes('token') || res.error.code === 'P0001') {
        throw new CanalClienteTokenError();
      }
      throw res.error;
    }

    const data = res.data;
    if (!data) return [];

    return (data as any[]).map((d) => (typeof d === 'object' && d !== null ? d.slot_time || d.slot : String(d)));
  }

  async criarAgendamentoPorToken(
    token: string,
    input: InputCriarAgendamento
  ): Promise<{ appointmentId: string }> {
    let res = await supabase.rpc('create_appointment_by_token', {
      p_token: token,
      p_service_id: input.serviceId,
      p_professional_id: input.professionalId || null,
      p_date: input.startTime.split('T')[0] || input.startTime,
      p_slot: input.startTime.includes('T') ? input.startTime.split('T')[1].substring(0, 5) : input.startTime,
    });

    if (res.error) {
      res = await supabase.rpc('create_appointment_by_customer_token', {
        p_token: token,
        p_service_id: input.serviceId,
        p_professional_id: input.professionalId || null,
        p_start_time: input.startTime,
      });
    }

    if (res.error) {
      if (res.error.code === '23505' || res.error.message.includes('conflito') || res.error.message.includes('indisponível')) {
        throw new AgendamentoConflitoError();
      }
      if (res.error.message.includes('token') || res.error.code === 'P0001') {
        throw new CanalClienteTokenError();
      }
      throw new CanalClienteValidationError(res.error.message);
    }

    const data = res.data;
    return { appointmentId: typeof data === 'string' ? data : (data?.appointment_id || data?.id || '') };
  }

  async reagendarAgendamentoPorToken(
    token: string,
    input: InputReagendarAgendamento
  ): Promise<void> {
    let res = await supabase.rpc('reschedule_appointment_by_token', {
      p_token: token,
      p_old_appointment_id: input.appointmentId,
      p_new_service_id: input.appointmentId, // fallback
      p_new_slot: input.newStartTime,
    });

    if (res.error) {
      res = await supabase.rpc('reschedule_appointment_by_customer_token', {
        p_token: token,
        p_appointment_id: input.appointmentId,
        p_start_time: input.newStartTime,
      });
    }

    if (res.error) {
      if (res.error.code === '23505' || res.error.message.includes('conflito') || res.error.message.includes('indisponível')) {
        throw new AgendamentoConflitoError();
      }
      if (res.error.message.includes('token') || res.error.code === 'P0001') {
        throw new CanalClienteTokenError();
      }
      throw new CanalClienteValidationError(res.error.message);
    }
  }

  async cancelarAgendamentoPorToken(
    token: string,
    appointmentId: string,
    motivo?: string
  ): Promise<void> {
    const { error } = await supabase.rpc('cancel_appointment_by_customer_token', {
      p_token: token,
      p_appointment_id: appointmentId,
      p_cancellation_reason: motivo || 'Cancelado pelo cliente',
    });

    if (error) {
      if (error.message.includes('prazo') || error.message.includes('regras')) {
        throw new AgendamentoRegraCancelamentoError(error.message);
      }
      if (error.message.includes('token') || error.code === 'P0001') {
        throw new CanalClienteTokenError();
      }
      throw new CanalClienteValidationError(error.message);
    }
  }

  async listarAgendamentosPorToken(token: string): Promise<AgendamentoCanal[]> {
    const { data, error } = await supabase.rpc('get_customer_appointments_by_token', {
      p_token: token,
    });

    if (error) {
      if (error.message.includes('token') || error.code === 'P0001') {
        throw new CanalClienteTokenError();
      }
      throw error;
    }

    return (data || []) as AgendamentoCanal[];
  }

  async promoverCadastroPorToken(
    token: string,
    input: InputPromoverCadastroCliente
  ): Promise<PerfilClienteCanal | void> {
    let res = await supabase.rpc('complete_customer_registration', {
      p_token: token,
      p_name: input.name,
    });

    if (res.error) {
      res = await supabase.rpc('promote_customer_registration_by_token', {
        p_token: token,
        p_name: input.name,
        p_email: input.email || null,
        p_phone: input.phone || null,
      });
    }

    if (res.error) {
      if (res.error.message.includes('token') || res.error.code === 'P0001') {
        throw new CanalClienteTokenError();
      }
      throw new CanalClienteValidationError(res.error.message);
    }

    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      const row = res.data[0];
      return {
        customer_id: row.customer_id,
        customer_name: row.customer_name,
        customer_phone: row.customer_phone || row.phone,
        tenant_id: row.tenant_id,
        tenant_name: row.tenant_name,
        tenant_phone: row.tenant_phone,
        cadastro_completo: Boolean(row.cadastro_completo),
      };
    }
  }


}
