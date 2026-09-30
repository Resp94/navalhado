import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRpc, mockInvoke, mockFrom } = vi.hoisted(() => ({ mockRpc: vi.fn(), mockInvoke: vi.fn(), mockFrom: vi.fn() }));

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
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
    mockFrom.mockReset();
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

  // Spec 052, ticket 06: a tela Assinatura lê a linha da assinatura e o histórico gravado pelo
  // webhook. Quem garante que o Gerente só vê a própria barbearia é a RLS; o filtro por tenant é
  // o cinto extra que também vale para o Proprietário, que enxerga todas.
  describe('obterAssinatura', () => {
    const cadeia = (resultado: { data: unknown; error: unknown }) => {
      const maybeSingle = vi.fn().mockResolvedValue(resultado);
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ eq });
      mockFrom.mockReturnValue({ select });
      return { select, eq, maybeSingle };
    };

    const linha = {
      status: 'active',
      trial_ends_at: '2026-10-14T23:01:41.950533+00:00',
      current_period_end: '2026-10-29T23:26:22+00:00',
      courtesy_ends_at: null,
      card_brand: 'visa',
      card_last4: '5682',
      plans: { name: 'Tesoura', price: '59.90' },
    };

    it('lê a única assinatura da barbearia, com o plano', async () => {
      const c = cadeia({ data: linha, error: null });

      const assinatura = await adapter.obterAssinatura('tenant-a');

      expect(mockFrom).toHaveBeenCalledWith('tenant_subscriptions');
      expect(c.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
      // A tabela tem duas chaves para plans (plan_id e scheduled_plan_id): sem a dica da chave do
      // plano atual o PostgREST recusa o embed por ambiguidade (visto no DEV).
      expect(c.select).toHaveBeenCalledWith(expect.stringContaining('plans!tenant_subscriptions_plan_id_fkey('));
      expect(assinatura).toEqual({
        situacao: 'active',
        plano: { nome: 'Tesoura', preco: 59.9 },
        testeAte: new Date('2026-10-14T23:01:41.950533Z'),
        periodoAte: new Date('2026-10-29T23:26:22Z'),
        cortesiaAte: null,
        cartao: { bandeira: 'visa', final: '5682' },
      });
    });

    it('aceita o plano vindo como lista de um elemento', async () => {
      cadeia({ data: { ...linha, plans: [{ name: 'Bancada', price: 159.9 }] }, error: null });

      expect((await adapter.obterAssinatura('tenant-a'))?.plano).toEqual({ nome: 'Bancada', preco: 159.9 });
    });

    it('sem cartão gravado, o cartão é nulo', async () => {
      cadeia({ data: { ...linha, card_brand: null, card_last4: null }, error: null });

      expect((await adapter.obterAssinatura('tenant-a'))?.cartao).toBeNull();
    });

    it('só a bandeira, quando o final ainda não chegou', async () => {
      cadeia({ data: { ...linha, card_last4: null }, error: null });

      expect((await adapter.obterAssinatura('tenant-a'))?.cartao).toEqual({ bandeira: 'visa', final: null });
    });

    it('barbearia sem assinatura devolve nulo', async () => {
      cadeia({ data: null, error: null });

      await expect(adapter.obterAssinatura('tenant-a')).resolves.toBeNull();
    });

    it('situação desconhecida é recusada em vez de virar outra por chute', async () => {
      cadeia({ data: { ...linha, status: 'suspended' }, error: null });

      await expect(adapter.obterAssinatura('tenant-a')).rejects.toThrow('Situação da assinatura desconhecida: suspended');
    });

    it('erro do banco vira exceção', async () => {
      cadeia({ data: null, error: { message: 'permission denied' } });

      await expect(adapter.obterAssinatura('tenant-a')).rejects.toThrow('Erro ao ler a assinatura da barbearia: permission denied');
    });
  });

  describe('listarCobrancas', () => {
    const cadeia = (resultado: { data: unknown; error: unknown }) => {
      const limit = vi.fn().mockResolvedValue(resultado);
      const order = vi.fn().mockReturnValue({ limit });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      mockFrom.mockReturnValue({ select });
      return { select, eq, order, limit };
    };

    it('lê o histórico da barbearia, da mais recente para a mais antiga, sem consultar o Mercado Pago', async () => {
      const c = cadeia({
        data: [
          {
            mp_payment_id: '1352660205',
            amount: '59.90',
            charged_at: '2026-09-29T23:26:22+00:00',
            status: 'approved',
            kind: 'recurring',
            card_brand: 'visa',
            card_last4: '5682',
          },
          {
            mp_payment_id: '1352660999',
            amount: 10,
            charged_at: '2026-09-30T12:00:00+00:00',
            status: 'rejected',
            kind: 'upgrade',
            card_brand: null,
            card_last4: null,
          },
        ],
        error: null,
      });

      const cobrancas = await adapter.listarCobrancas('tenant-a');

      expect(mockFrom).toHaveBeenCalledWith('billing_charges');
      expect(c.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
      expect(c.order).toHaveBeenCalledWith('charged_at', { ascending: false });
      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockInvoke).not.toHaveBeenCalled();
      expect(cobrancas).toEqual([
        {
          id: '1352660205',
          valor: 59.9,
          cobradaEm: new Date('2026-09-29T23:26:22Z'),
          situacao: 'approved',
          tipo: 'recurring',
          cartao: { bandeira: 'visa', final: '5682' },
        },
        {
          id: '1352660999',
          valor: 10,
          cobradaEm: new Date('2026-09-30T12:00:00Z'),
          situacao: 'rejected',
          tipo: 'upgrade',
          cartao: null,
        },
      ]);
    });

    it('sem cobranças, o histórico é vazio', async () => {
      cadeia({ data: [], error: null });

      await expect(adapter.listarCobrancas('tenant-a')).resolves.toEqual([]);
    });

    it('erro do banco vira exceção', async () => {
      cadeia({ data: null, error: { message: 'permission denied' } });

      await expect(adapter.listarCobrancas('tenant-a')).rejects.toThrow('Erro ao ler o histórico de cobranças: permission denied');
    });
  });
});
