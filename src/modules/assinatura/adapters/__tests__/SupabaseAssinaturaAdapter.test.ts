import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock('../../../../lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

import { SupabaseAssinaturaAdapter } from '../SupabaseAssinaturaAdapter';

// O adaptador chama a RPC get_my_access_state, que não recebe tenant: o banco
// resolve a barbearia de quem chama. O front traduz allowed/warning/blocked.

describe('SupabaseAssinaturaAdapter', () => {
  const adapter = new SupabaseAssinaturaAdapter();

  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('chama a RPC do porteiro sem argumentos', async () => {
    mockRpc.mockResolvedValue({ data: [{ access: 'allowed', reason: 'active', relevant_date: null }], error: null });

    await adapter.obterEstadoDeAcesso();

    expect(mockRpc).toHaveBeenCalledWith('get_my_access_state');
  });

  it.each([
    ['allowed', 'liberado'],
    ['warning', 'aviso'],
    ['blocked', 'bloqueado'],
  ])('traduz %s para %s', async (acessoDoBanco, acesso) => {
    mockRpc.mockResolvedValue({
      data: [{ access: acessoDoBanco, reason: 'trial', relevant_date: '2026-10-04T12:00:00+00:00' }],
      error: null,
    });

    await expect(adapter.obterEstadoDeAcesso()).resolves.toEqual({
      acesso,
      motivo: 'trial',
      dataRelevante: new Date('2026-10-04T12:00:00Z'),
    });
  });

  it('data relevante nula continua nula', async () => {
    mockRpc.mockResolvedValue({ data: [{ access: 'allowed', reason: 'courtesy', relevant_date: null }], error: null });

    await expect(adapter.obterEstadoDeAcesso()).resolves.toMatchObject({ dataRelevante: null });
  });

  it('sem linha (usuário sem barbearia) devolve nulo', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await expect(adapter.obterEstadoDeAcesso()).resolves.toBeNull();
  });

  it('erro da RPC vira exceção com o motivo', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });

    await expect(adapter.obterEstadoDeAcesso()).rejects.toThrow('Erro ao ler o estado de acesso da barbearia: permission denied');
  });

  it('acesso desconhecido é recusado em vez de virar liberado ou bloqueado por chute', async () => {
    mockRpc.mockResolvedValue({ data: [{ access: 'talvez', reason: 'trial', relevant_date: null }], error: null });

    await expect(adapter.obterEstadoDeAcesso()).rejects.toThrow('Estado de acesso desconhecido: talvez');
  });
});
