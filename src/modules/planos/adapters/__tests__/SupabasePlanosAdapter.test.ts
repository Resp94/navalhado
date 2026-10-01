import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabasePlanosAdapter } from '../SupabasePlanosAdapter';

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock('../../../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

// Monta a cadeia select().eq().maybeSingle() da leitura do plano da barbearia.
const cadeiaDoPlanoDaBarbearia = (resultado: { data: unknown; error: unknown }) => {
  const maybeSingle = vi.fn().mockResolvedValue(resultado);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  mockFrom.mockReturnValue({ select });
  return { select, eq, maybeSingle };
};

describe('SupabasePlanosAdapter.obterDoTenant (spec 052, tickets 02 e 03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Desde o ticket 03 a barbearia tem uma única assinatura (unique por tenant_id): não há
  // "mais recente" para escolher, e o plano agendado mora na mesma linha.
  it('lê o plano da única assinatura da barbearia', async () => {
    const cadeia = cadeiaDoPlanoDaBarbearia({
      data: { plans: { id: 'p1', name: 'Máquina', price: '89.90', max_professionals: 5 } },
      error: null,
    });

    const plano = await new SupabasePlanosAdapter().obterDoTenant('tenant-a');

    expect(mockFrom).toHaveBeenCalledWith('tenant_subscriptions');
    expect(cadeia.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    // Duas chaves para plans (plan_id e scheduled_plan_id): sem a dica o PostgREST recusa o embed.
    expect(cadeia.select).toHaveBeenCalledWith(expect.stringContaining('plans!tenant_subscriptions_plan_id_fkey('));
    expect(cadeia.maybeSingle).toHaveBeenCalledTimes(1);
    expect(plano).toEqual({ id: 'p1', name: 'Máquina', price: 89.9, max_professionals: 5 });
  });

  // Spec 052, ticket 11: com a descida agendada o banco já recusa cadastros acima do limite do plano menor, então a cota
  // que a tela mostra tem de ser a dele. O banco usa o menor limite entre o plano atual e o agendado.
  it('com uma descida agendada, o plano da cota é o plano menor (o limite que o banco já aplica)', async () => {
    const cadeia = cadeiaDoPlanoDaBarbearia({
      data: {
        plans: { id: 'p2', name: 'Máquina', price: '89.90', max_professionals: 5 },
        scheduled_plan: { id: 'p1', name: 'Tesoura', price: '59.90', max_professionals: 1 },
      },
      error: null,
    });

    const plano = await new SupabasePlanosAdapter().obterDoTenant('tenant-a');

    expect(cadeia.select).toHaveBeenCalledWith(
      expect.stringContaining('scheduled_plan:plans!tenant_subscriptions_scheduled_plan_id_fkey('),
    );
    // A marca diz à tela que o limite vem da descida agendada (o plano atual é maior): a mensagem de limite não pode mandar subir
    // de plano, e sim desfazer a descida.
    expect(plano).toEqual({ id: 'p1', name: 'Tesoura', price: 59.9, max_professionals: 1, descidaAgendada: true });
  });

  it('o plano agendado com limite maior que o do atual não muda a cota (só desce) e não leva a marca da descida', async () => {
    cadeiaDoPlanoDaBarbearia({
      data: {
        plans: { id: 'p1', name: 'Tesoura', price: '59.90', max_professionals: 1 },
        scheduled_plan: { id: 'p2', name: 'Máquina', price: '89.90', max_professionals: 5 },
      },
      error: null,
    });

    const plano = await new SupabasePlanosAdapter().obterDoTenant('tenant-a');

    expect(plano?.name).toBe('Tesoura');
    expect(plano?.descidaAgendada).toBeUndefined();
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
