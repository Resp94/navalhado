import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRpc, mockInvoke } = vi.hoisted(() => ({ mockRpc: vi.fn(), mockInvoke: vi.fn() }));

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

import { SupabaseAssinaturaAdapter } from '../SupabaseAssinaturaAdapter';

// O adaptador chama a RPC get_my_access_state, que não recebe tenant: o banco
// resolve a barbearia de quem chama. O front traduz allowed/warning/blocked.

describe('SupabaseAssinaturaAdapter', () => {
  const adapter = new SupabaseAssinaturaAdapter();

  beforeEach(() => {
    mockRpc.mockReset();
    mockInvoke.mockReset();
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

  // Spec 052, ticket 05: "Assinar" e "Pagar" chamam a Edge Function de cobrança.
  describe('assinar', () => {
    it('chama a função de cobrança com a ação assinar e devolve o link de pagamento', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          paymentLink: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=pre-1',
          subscriptionId: 'pre-1',
          firstChargeAt: '2026-10-14T15:00:00.000Z',
        },
        error: null,
      });

      const criada = await adapter.assinar();

      expect(mockInvoke).toHaveBeenCalledWith('billing', { body: { action: 'assinar' } });
      expect(criada).toEqual({
        linkDePagamento: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=pre-1',
        assinaturaId: 'pre-1',
        primeiraCobrancaEm: new Date('2026-10-14T15:00:00.000Z'),
      });
    });

    it('cobrança imediata: sem data da primeira cobrança', async () => {
      mockInvoke.mockResolvedValue({
        data: { paymentLink: 'https://mp.test/x', subscriptionId: 'pre-2', firstChargeAt: null },
        error: null,
      });

      expect((await adapter.assinar()).primeiraCobrancaEm).toBeNull();
    });

    it('mostra a mensagem que a função devolveu quando ela recusa', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: { json: async () => ({ error: 'A barbearia já tem uma assinatura ativa.' }) },
        },
      });

      await expect(adapter.assinar()).rejects.toThrow('A barbearia já tem uma assinatura ativa.');
    });

    it('sem mensagem da função, usa um texto claro em vez do erro técnico', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Failed to send a request to the Edge Function' },
      });

      await expect(adapter.assinar()).rejects.toThrow('Não foi possível iniciar a assinatura. Tente de novo.');
    });

    it('resposta sem link de pagamento é tratada como falha', async () => {
      mockInvoke.mockResolvedValue({ data: { subscriptionId: 'pre-3' }, error: null });

      await expect(adapter.assinar()).rejects.toThrow('Não foi possível iniciar a assinatura. Tente de novo.');
    });
  });
});
