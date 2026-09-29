import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabasePlanosAdapter } from '../SupabasePlanosAdapter';

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock('../../../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

// Monta a cadeia select().eq().order().limit().maybeSingle() da leitura do plano da barbearia.
const cadeiaDoPlanoDaBarbearia = (resultado: { data: unknown; error: unknown }) => {
  const maybeSingle = vi.fn().mockResolvedValue(resultado);
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const order = vi.fn().mockReturnValue({ limit });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  mockFrom.mockReturnValue({ select });
  return { select, eq, order, limit };
};

describe('SupabasePlanosAdapter.obterDoTenant (spec 052, ticket 02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lê a assinatura mais recente da barbearia, a mesma que o gatilho do banco usa', async () => {
    const cadeia = cadeiaDoPlanoDaBarbearia({
      data: { plans: { id: 'p1', name: 'Máquina', price: '89.90', max_professionals: 5 } },
      error: null,
    });

    const plano = await new SupabasePlanosAdapter().obterDoTenant('tenant-a');

    expect(mockFrom).toHaveBeenCalledWith('tenant_subscriptions');
    expect(cadeia.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    expect(cadeia.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(cadeia.limit).toHaveBeenCalledWith(1);
    expect(plano).toEqual({ id: 'p1', name: 'Máquina', price: 89.9, max_professionals: 5 });
  });

  it('aceita o plano vindo como lista de um elemento', async () => {
    cadeiaDoPlanoDaBarbearia({
      data: { plans: [{ id: 'p1', name: 'Tesoura', price: 59.9, max_professionals: 1 }] },
      error: null,
    });

    expect((await new SupabasePlanosAdapter().obterDoTenant('tenant-a'))?.name).toBe('Tesoura');
  });

  it('devolve nulo quando a barbearia não tem assinatura', async () => {
    cadeiaDoPlanoDaBarbearia({ data: null, error: null });

    expect(await new SupabasePlanosAdapter().obterDoTenant('tenant-a')).toBeNull();
  });

  it('propaga o erro do banco', async () => {
    cadeiaDoPlanoDaBarbearia({ data: null, error: { message: 'permission denied' } });

    await expect(new SupabasePlanosAdapter().obterDoTenant('tenant-a')).rejects.toThrow(/permission denied/);
  });
});
