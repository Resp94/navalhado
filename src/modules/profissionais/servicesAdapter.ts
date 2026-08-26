import type { SupabaseClient } from '@supabase/supabase-js';
import type { IProfessionalServicesAdapter, ProfessionalServiceItem } from './types';

export class SupabaseProfessionalServicesAdapter implements IProfessionalServicesAdapter {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async getProfessionalServices(tenantId: string, professionalId: string): Promise<ProfessionalServiceItem[]> {
    // 1. Buscar todos os serviços ativos da barbearia
    const { data: allServices, error: sError } = await this.supabase
      .from('services')
      .select('id, name, category, duration_minutes, price, is_active')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('name');

    if (sError) throw sError;

    // 2. Buscar associações existentes
    const { data: assocData, error: aError } = await this.supabase
      .from('professional_services')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('professional_id', professionalId);

    if (aError) throw aError;

    const assocMap = new Map<string, any>();
    (assocData || []).forEach((row: any) => {
      assocMap.set(row.service_id, row);
    });

    return (allServices || []).map((s: any) => {
      const existing = assocMap.get(s.id);
      return {
        id: existing?.id,
        tenant_id: tenantId,
        professional_id: professionalId,
        service_id: s.id,
        service_name: s.name,
        service_category: s.category,
        base_duration_minutes: s.duration_minutes || 40,
        base_price: Number(s.price || 0),
        custom_duration_minutes: existing?.custom_duration_minutes ?? s.duration_minutes ?? 40,
        custom_commission_percentage: existing?.custom_commission_percentage ?? null,
        is_enabled: existing ? existing.is_enabled : true,
      };
    });
  }

  async saveProfessionalServices(
    tenantId: string,
    professionalId: string,
    services: Array<{
      service_id: string;
      custom_duration_minutes: number;
      custom_commission_percentage?: number | null;
      is_enabled: boolean;
    }>
  ): Promise<void> {
    const payload = services.map((s) => ({
      tenant_id: tenantId,
      professional_id: professionalId,
      service_id: s.service_id,
      custom_duration_minutes: s.custom_duration_minutes || 40,
      custom_commission_percentage: s.custom_commission_percentage ?? null,
      is_enabled: s.is_enabled,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await this.supabase
      .from('professional_services')
      .upsert(payload, { onConflict: 'tenant_id,professional_id,service_id' });

    if (error) throw error;
  }

  async enableAllServicesDefault(tenantId: string, professionalId: string, defaultMinutes = 40): Promise<void> {
    const { data: allServices, error: sError } = await this.supabase
      .from('services')
      .select('id, duration_minutes')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (sError) throw sError;

    const payload = (allServices || []).map((s: any) => ({
      tenant_id: tenantId,
      professional_id: professionalId,
      service_id: s.id,
      custom_duration_minutes: s.duration_minutes || defaultMinutes,
      is_enabled: true,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await this.supabase
      .from('professional_services')
      .upsert(payload, { onConflict: 'tenant_id,professional_id,service_id' });

    if (error) throw error;
  }
}
