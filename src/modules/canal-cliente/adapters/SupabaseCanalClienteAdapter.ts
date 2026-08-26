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
    if (typeof window !== 'undefined' && window.localStorage) {
      if (row.tenant_name) localStorage.setItem('navalhado_tenant_name', row.tenant_name);
      if (row.tenant_phone) localStorage.setItem('navalhado_tenant_phone', row.tenant_phone);
    }


    return {
      customer_id: row.customer_id,
      customer_name: row.customer_name,
      customer_phone: row.customer_phone || row.phone,
      tenant_id: row.tenant_id,
      tenant_name: row.tenant_name,
      tenant_phone: row.tenant_phone,
      tenant_slug: row.tenant_slug,
      cadastro_completo: Boolean(row.cadastro_completo),
      min_cancellation_lead_time_minutes: row.min_cancellation_lead_time_minutes ? Number(row.min_cancellation_lead_time_minutes) : undefined,
      min_booking_lead_time_minutes: row.min_booking_lead_time_minutes ? Number(row.min_booking_lead_time_minutes) : undefined,
      slot_interval_minutes: row.slot_interval_minutes ? Number(row.slot_interval_minutes) : undefined,
      tenant_timezone: row.tenant_timezone || 'America/Sao_Paulo',
      business_hours: row.business_hours || undefined,
    };
  }

  async inicializarPorSlug(slug: string, existingToken?: string | null): Promise<{ token: string; perfil: PerfilClienteCanal }> {
    const isUuid = (val?: string | null): boolean =>
      Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim()));

    const validToken = isUuid(existingToken) ? existingToken!.trim() : null;

    const { data, error } = await supabase.rpc('get_or_create_provisional_customer_by_slug', {
      p_slug: slug,
      p_existing_token: validToken,
    });

    if (error) {
      throw new CanalClienteTokenError(error.message);
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new CanalClienteTokenError('Estabelecimento não encontrado.');
    }

    const row = data[0];
    const token = row.token_acesso;
    this.definirToken(token);

    if (typeof window !== 'undefined' && window.localStorage) {
      if (row.tenant_name) localStorage.setItem('navalhado_tenant_name', row.tenant_name);
      if (row.tenant_phone) localStorage.setItem('navalhado_tenant_phone', row.tenant_phone);
    }

    const perfil: PerfilClienteCanal = {
      customer_id: row.customer_id,
      customer_name: row.customer_name,
      customer_phone: row.customer_phone || row.phone,
      tenant_id: row.tenant_id,
      tenant_name: row.tenant_name,
      tenant_phone: row.tenant_phone,
      tenant_slug: row.tenant_slug,
      cadastro_completo: Boolean(row.cadastro_completo),
      min_cancellation_lead_time_minutes: row.min_cancellation_lead_time_minutes ? Number(row.min_cancellation_lead_time_minutes) : undefined,
      min_booking_lead_time_minutes: row.min_booking_lead_time_minutes ? Number(row.min_booking_lead_time_minutes) : undefined,
      slot_interval_minutes: row.slot_interval_minutes ? Number(row.slot_interval_minutes) : undefined,
      tenant_timezone: row.tenant_timezone || 'America/Sao_Paulo',
      business_hours: row.business_hours || undefined,
    };

    return { token, perfil };
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

    if (res.error && (res.error.code === 'PGRST202' || res.error.message?.includes('function'))) {
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
      p_new_service_id: input.newServiceId || null,
      p_new_professional_id: input.newProfessionalId || null,
      p_new_date: input.newDate || null,
      p_new_slot: input.newSlot || null,
    });

    if (res.error && (res.error.code === 'PGRST202' || res.error.message?.includes('function'))) {
      res = await supabase.rpc('reschedule_appointment_by_customer_token', {
        p_token: token,
        p_appointment_id: input.appointmentId,
        p_start_time: input.newStartTime || (input.newDate && input.newSlot ? `${input.newDate}T${input.newSlot}:00` : null),
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
    let res = await supabase.rpc('cancel_appointment_by_token', {
      p_token: token,
      p_appointment_id: appointmentId,
      p_reason: motivo || 'Cancelado pelo cliente',
    });

    if (res.error && (res.error.code === 'PGRST202' || res.error.message?.includes('function'))) {
      res = await supabase.rpc('cancel_appointment_by_customer_token', {
        p_token: token,
        p_appointment_id: appointmentId,
        p_cancellation_reason: motivo || 'Cancelado pelo cliente',
      });
    }

    if (res.error) {
      if (
        res.error.message.includes('APPOINTMENT_CANCELLATION_DEADLINE_EXPIRED') ||
        res.error.message.includes('prazo') ||
        res.error.message.includes('regras') ||
        res.error.message.includes('expirou')
      ) {
        throw new AgendamentoRegraCancelamentoError(res.error.message);
      }
      if (res.error.message.includes('token') || res.error.code === 'P0001') {
        throw new CanalClienteTokenError();
      }
      throw new CanalClienteValidationError(res.error.message);
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
      p_phone: input.phone || null,
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
        token_acesso: row.token_acesso,
      };
    }
  }

  async buscarClientePorTelefone(
    token: string,
    telefone: string
  ): Promise<{ found: boolean; customer_id?: string; customer_name?: string; customer_phone?: string; cadastro_completo?: boolean } | null> {
    const { data, error } = await supabase.rpc('lookup_customer_by_phone', {
      p_token: token,
      p_phone: telefone,
    });

    if (error) {
      if (error.message.includes('token') || error.code === 'P0001') {
        throw new CanalClienteTokenError();
      }
      return null;
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return null;
    }

    const row = data[0];
    return {
      found: Boolean(row.found),
      customer_id: row.customer_id || undefined,
      customer_name: row.customer_name || undefined,
      customer_phone: row.customer_phone || undefined,
      cadastro_completo: row.cadastro_completo !== undefined ? Boolean(row.cadastro_completo) : undefined,
    };
  }
}
