export interface ProfessionalServiceItem {
  id?: string;
  tenant_id: string;
  professional_id: string;
  service_id: string;
  service_name: string;
  service_category?: string | null;
  base_duration_minutes: number;
  base_price: number;
  custom_duration_minutes: number;
  custom_commission_percentage?: number | null;
  is_enabled: boolean;
}

export interface IProfessionalServicesAdapter {
  getProfessionalServices(tenantId: string, professionalId: string): Promise<ProfessionalServiceItem[]>;
  saveProfessionalServices(
    tenantId: string,
    professionalId: string,
    services: Array<{
      service_id: string;
      custom_duration_minutes: number;
      custom_commission_percentage?: number | null;
      is_enabled: boolean;
    }>
  ): Promise<void>;
  enableAllServicesDefault(tenantId: string, professionalId: string, defaultMinutes?: number): Promise<void>;
}
