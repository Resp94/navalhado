import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseProfessionalServicesAdapter } from '../servicesAdapter';

describe('SupabaseProfessionalServicesAdapter', () => {
  let adapter: SupabaseProfessionalServicesAdapter;
  const mockSupabase: any = {
    from: vi.fn(),
  };

  const tenantId = 'tenant_123';
  const professionalId = 'prof_456';

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new SupabaseProfessionalServicesAdapter(mockSupabase);
  });

  it('deve listar todos os serviços da barbearia mesclando com as durações personalizadas do profissional', async () => {
    const mockServices = [
      { id: 's1', name: 'Corte Tradicional', category: 'Cabelo', duration_minutes: 40, price: 50 },
      { id: 's2', name: 'Barba Terapia', category: 'Barba', duration_minutes: 30, price: 40 },
    ];

    const mockAssoc = [
      {
        id: 'ps1',
        service_id: 's1',
        professional_id: professionalId,
        custom_duration_minutes: 45,
        custom_commission_percentage: 50,
        is_enabled: true,
      },
    ];

    mockSupabase.from.mockImplementation((tableName: string) => {
      if (tableName === 'services') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockServices, error: null }),
        };
      }
      if (tableName === 'professional_services') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation((col: string) => {
            if (col === 'professional_id') {
              return Promise.resolve({ data: mockAssoc, error: null });
            }
            return { eq: vi.fn().mockResolvedValue({ data: mockAssoc, error: null }) };
          }),
        };
      }
      return { select: vi.fn().mockReturnThis() };
    });

    const result = await adapter.getProfessionalServices(tenantId, professionalId);
    expect(result.length).toBe(2);

    const corte = result.find((r) => r.service_id === 's1');
    expect(corte?.custom_duration_minutes).toBe(45);
    expect(corte?.is_enabled).toBe(true);

    const barba = result.find((r) => r.service_id === 's2');
    expect(barba?.custom_duration_minutes).toBe(30);
    expect(barba?.is_enabled).toBe(true);
  });

  it('deve salvar associações personalizadas com upsert', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockReturnValue({
      upsert: upsertMock,
    });

    await adapter.saveProfessionalServices(tenantId, professionalId, [
      { service_id: 's1', custom_duration_minutes: 40, is_enabled: true },
      { service_id: 's2', custom_duration_minutes: 25, is_enabled: false },
    ]);

    expect(mockSupabase.from).toHaveBeenCalledWith('professional_services');
    expect(upsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          tenant_id: tenantId,
          professional_id: professionalId,
          service_id: 's1',
          custom_duration_minutes: 40,
          is_enabled: true,
        }),
      ]),
      { onConflict: 'tenant_id,professional_id,service_id' }
    );
  });
});
