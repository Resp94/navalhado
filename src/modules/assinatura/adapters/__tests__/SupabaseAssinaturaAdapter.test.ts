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
      plans: { id: 'plano-tesoura', name: 'Tesoura', price: '59.90' },
      scheduled_plan: null,
    };

    it('lê a única assinatura da barbearia, com o plano', async () => {
      const c = cadeia({ data: linha, error: null });

      const assinatura = await adapter.obterAssinatura('tenant-a');

      expect(mockFrom).toHaveBeenCalledWith('tenant_subscriptions');
      expect(c.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
      // A tabela tem duas chaves para plans (plan_id e scheduled_plan_id): sem a dica da chave do
      // plano atual o PostgREST recusa o embed por ambiguidade (visto no DEV).
      expect(c.select).toHaveBeenCalledWith(expect.stringContaining('plans!tenant_subscriptions_plan_id_fkey(id, name, price)'));
      expect(assinatura).toEqual({
        situacao: 'active',
        plano: { id: 'plano-tesoura', nome: 'Tesoura', preco: 59.9 },
        testeAte: new Date('2026-10-14T23:01:41.950533Z'),
        periodoAte: new Date('2026-10-29T23:26:22Z'),
        cortesiaAte: null,
        cartao: { bandeira: 'visa', final: '5682' },
        planoAgendado: null,
      });
    });

    it('lê também a descida agendada, pela chave do plano agendado (a tabela tem duas chaves para plans)', async () => {
      const c = cadeia({
        data: { ...linha, plans: { id: 'plano-maquina', name: 'Máquina', price: '89.90' }, scheduled_plan: { id: 'plano-tesoura', name: 'Tesoura', price: '59.90' } },
        error: null,
      });

      const assinatura = await adapter.obterAssinatura('tenant-a');

      expect(c.select).toHaveBeenCalledWith(
        expect.stringContaining('scheduled_plan:plans!tenant_subscriptions_scheduled_plan_id_fkey(id, name, price)'),
      );
      expect(assinatura?.planoAgendado).toEqual({ id: 'plano-tesoura', nome: 'Tesoura', preco: 59.9 });
    });

    it('aceita o plano agendado vindo como lista de um elemento', async () => {
      cadeia({ data: { ...linha, scheduled_plan: [{ id: 'plano-maquina', name: 'Máquina', price: 89.9 }] }, error: null });

      expect((await adapter.obterAssinatura('tenant-a'))?.planoAgendado).toEqual({ id: 'plano-maquina', nome: 'Máquina', preco: 89.9 });
    });

    it('aceita o plano vindo como lista de um elemento', async () => {
      cadeia({ data: { ...linha, plans: [{ id: 'plano-bancada', name: 'Bancada', price: 159.9 }] }, error: null });

      expect((await adapter.obterAssinatura('tenant-a'))?.plano).toEqual({ id: 'plano-bancada', nome: 'Bancada', preco: 159.9 });
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

  // Spec 052, ticket 09: trocar o cartão. O navegador manda só o token gerado nos campos seguros.
  describe('trocarCartao', () => {
    it('chama a função de cobrança com a ação trocar_cartao, o token e o final do cartão, e devolve o cartão novo', async () => {
      mockInvoke.mockResolvedValue({ data: { changed: true, cardBrand: 'master', cardLast4: '0604' }, error: null });

      const cartao = await adapter.trocarCartao('e3ed6f098462036dd2cbabe314b9de2a', '0604');

      expect(mockInvoke).toHaveBeenCalledWith('billing', {
        body: { action: 'trocar_cartao', cardToken: 'e3ed6f098462036dd2cbabe314b9de2a', cardLast4: '0604' },
      });
      expect(cartao).toEqual({ bandeira: 'master', final: '0604' });
    });

    it('sem o final do cartão, manda só o token', async () => {
      mockInvoke.mockResolvedValue({ data: { changed: true, cardBrand: 'master', cardLast4: null }, error: null });

      await adapter.trocarCartao('e3ed6f098462036dd2cbabe314b9de2a', null);

      expect(mockInvoke).toHaveBeenCalledWith('billing', {
        body: { action: 'trocar_cartao', cardToken: 'e3ed6f098462036dd2cbabe314b9de2a' },
      });
    });

    it('o provedor pode não devolver bandeira nem final: vêm nulos', async () => {
      mockInvoke.mockResolvedValue({ data: { changed: true, cardBrand: null, cardLast4: null }, error: null });

      await expect(adapter.trocarCartao('e3ed6f098462036dd2cbabe314b9de2a')).resolves.toEqual({ bandeira: null, final: null });
    });

    it('mostra a mensagem que a função devolveu quando ela recusa', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: { json: async () => ({ error: 'O Mercado Pago não aceitou o cartão. Confira os dados ou use outro cartão.' }) },
        },
      });

      await expect(adapter.trocarCartao('e3ed6f098462036dd2cbabe314b9de2a')).rejects.toThrow(
        'O Mercado Pago não aceitou o cartão. Confira os dados ou use outro cartão.',
      );
    });

    it('sem mensagem da função, usa um texto claro da troca de cartão (e não o da assinatura)', async () => {
      mockInvoke.mockResolvedValue({ data: null, error: { message: 'Failed to send a request to the Edge Function' } });

      await expect(adapter.trocarCartao('e3ed6f098462036dd2cbabe314b9de2a')).rejects.toThrow(
        'Não foi possível trocar o cartão. Tente de novo.',
      );
    });

    it('resposta sem changed é tratada como falha', async () => {
      mockInvoke.mockResolvedValue({ data: {}, error: null });

      await expect(adapter.trocarCartao('e3ed6f098462036dd2cbabe314b9de2a')).rejects.toThrow(
        'Não foi possível trocar o cartão. Tente de novo.',
      );
    });
  });

  describe('obterChavePublica', () => {
    it('pede a Public Key do ambiente à função de cobrança', async () => {
      mockInvoke.mockResolvedValue({ data: { publicKey: 'APP_USR-public-key' }, error: null });

      await expect(adapter.obterChavePublica()).resolves.toBe('APP_USR-public-key');
      expect(mockInvoke).toHaveBeenCalledWith('billing', { body: { action: 'chave_publica' } });
    });

    it('sem a chave na resposta, ou com erro da função, é falha', async () => {
      mockInvoke.mockResolvedValueOnce({ data: {}, error: null });
      await expect(adapter.obterChavePublica()).rejects.toThrow('Não foi possível carregar o formulário do cartão. Tente de novo.');

      mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
      await expect(adapter.obterChavePublica()).rejects.toThrow('Não foi possível carregar o formulário do cartão. Tente de novo.');
    });
  });

  describe('obterChavePublica da cobrança avulsa', () => {
    it('pede à função a Public Key da cobrança: no DEV ela é de outro app que a da assinatura', async () => {
      mockInvoke.mockResolvedValue({ data: { publicKey: 'TEST-public-key-da-cobranca' }, error: null });

      await expect(adapter.obterChavePublica('cobranca')).resolves.toBe('TEST-public-key-da-cobranca');
      expect(mockInvoke).toHaveBeenCalledWith('billing', { body: { action: 'chave_publica', uso: 'cobranca' } });
    });
  });

  // Spec 052, ticket 10: subir de plano. A função calcula a diferença no servidor; o navegador só mostra.
  describe('cotarTrocaDePlano', () => {
    const cotacaoDaFuncao = {
      mode: 'charge',
      difference: 20,
      newMonthlyAmount: 89.9,
      remainingDays: 20,
      periodDays: 30,
      planName: 'Máquina',
    };

    it('chama a função de cobrança com a ação cotar_troca_de_plano e traduz a resposta', async () => {
      mockInvoke.mockResolvedValue({ data: cotacaoDaFuncao, error: null });

      const cotacao = await adapter.cotarTrocaDePlano('b3fa7384-d113-4a1b-a5ed-1efeb7e51c22');

      expect(mockInvoke).toHaveBeenCalledWith('billing', {
        body: { action: 'cotar_troca_de_plano', planId: 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22' },
      });
      expect(cotacao).toEqual({
        modo: 'cobranca',
        diferenca: 20,
        valorMensalNovo: 89.9,
        diasRestantes: 20,
        diasDoPeriodo: 30,
        nomeDoPlano: 'Máquina',
        vigenteEm: null,
      });
    });

    it('a descida agendada vem com a data em que o plano menor passa a valer', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          mode: 'scheduled',
          difference: 0,
          newMonthlyAmount: 59.9,
          remainingDays: null,
          periodDays: null,
          effectiveAt: '2026-10-29T23:26:22.000Z',
          planName: 'Tesoura',
        },
        error: null,
      });

      await expect(adapter.cotarTrocaDePlano('plano-tesoura')).resolves.toEqual({
        modo: 'agendada',
        diferenca: 0,
        valorMensalNovo: 59.9,
        diasRestantes: null,
        diasDoPeriodo: null,
        nomeDoPlano: 'Tesoura',
        vigenteEm: new Date('2026-10-29T23:26:22Z'),
      });
    });

    it('descida agendada sem a data é tratada como falha: a tela não teria o que mostrar', async () => {
      mockInvoke.mockResolvedValue({
        data: { mode: 'scheduled', difference: 0, newMonthlyAmount: 59.9, planName: 'Tesoura' },
        error: null,
      });

      await expect(adapter.cotarTrocaDePlano('plano')).rejects.toThrow('Não foi possível calcular a troca de plano. Tente de novo.');
    });

    it.each([
      ['free', 'livre'],
      ['charge', 'cobranca'],
      ['no_charge', 'sem_cobranca'],
    ])('traduz o modo %s para %s', async (modoDaFuncao, modo) => {
      mockInvoke.mockResolvedValue({ data: { ...cotacaoDaFuncao, mode: modoDaFuncao, remainingDays: null, periodDays: null }, error: null });

      await expect(adapter.cotarTrocaDePlano('plano')).resolves.toMatchObject({ modo, diasRestantes: null, diasDoPeriodo: null });
    });

    it('modo desconhecido é recusado em vez de virar cobrança por chute', async () => {
      mockInvoke.mockResolvedValue({ data: { ...cotacaoDaFuncao, mode: 'talvez' }, error: null });

      await expect(adapter.cotarTrocaDePlano('plano')).rejects.toThrow('Não foi possível calcular a troca de plano. Tente de novo.');
    });

    it('resposta sem valores é falha', async () => {
      mockInvoke.mockResolvedValue({ data: { mode: 'charge', planName: 'Máquina' }, error: null });

      await expect(adapter.cotarTrocaDePlano('plano')).rejects.toThrow('Não foi possível calcular a troca de plano. Tente de novo.');
    });

    it('mostra a mensagem que a função devolveu quando ela recusa a troca', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: { json: async () => ({ error: 'Seus 3 profissionais ativos não cabem no plano Tesoura, que aceita até 1.' }) },
        },
      });

      await expect(adapter.cotarTrocaDePlano('plano')).rejects.toThrow('não cabem no plano Tesoura');
    });

    it('sem mensagem da função, usa um texto claro da cotação', async () => {
      mockInvoke.mockResolvedValue({ data: null, error: { message: 'Failed to send a request to the Edge Function' } });

      await expect(adapter.cotarTrocaDePlano('plano')).rejects.toThrow('Não foi possível calcular a troca de plano. Tente de novo.');
    });
  });

  describe('trocarDePlano', () => {
    const respostaDaFuncao = {
      changed: true,
      planId: 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22',
      planName: 'Máquina',
      charged: 20,
      newMonthlyAmount: 89.9,
      nextChargeUpdated: true,
    };

    it('com a diferença a pagar, manda o token, o valor confirmado e o final do cartão, e traduz a resposta', async () => {
      mockInvoke.mockResolvedValue({ data: respostaDaFuncao, error: null });

      const trocado = await adapter.trocarDePlano('b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', {
        token: 'e3ed6f098462036dd2cbabe314b9de2a',
        final: '0604',
        valorConfirmado: 20,
      });

      expect(mockInvoke).toHaveBeenCalledWith('billing', {
        body: {
          action: 'trocar_plano',
          planId: 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22',
          cardToken: 'e3ed6f098462036dd2cbabe314b9de2a',
          expectedAmount: 20,
          cardLast4: '0604',
        },
      });
      expect(trocado).toEqual({
        planoId: 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22',
        nomeDoPlano: 'Máquina',
        cobrado: 20,
        valorMensalNovo: 89.9,
        proximaCobrancaAtualizada: true,
        vigenteEm: null,
      });
    });

    it('a descida agendada (sem cartão) traz a data em que o plano menor passa a valer', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          scheduled: true,
          planId: 'plano-tesoura',
          planName: 'Tesoura',
          effectiveAt: '2026-10-29T23:26:22.000Z',
          newMonthlyAmount: 59.9,
        },
        error: null,
      });

      const agendado = await adapter.trocarDePlano('plano-tesoura');

      expect(mockInvoke).toHaveBeenCalledWith('billing', { body: { action: 'trocar_plano', planId: 'plano-tesoura' } });
      expect(agendado).toEqual({
        planoId: 'plano-tesoura',
        nomeDoPlano: 'Tesoura',
        cobrado: 0,
        valorMensalNovo: 59.9,
        proximaCobrancaAtualizada: true,
        vigenteEm: new Date('2026-10-29T23:26:22Z'),
      });
    });

    it('a descida agendada sem a data é tratada como falha', async () => {
      mockInvoke.mockResolvedValue({ data: { scheduled: true, planId: 'plano-tesoura', planName: 'Tesoura', newMonthlyAmount: 59.9 }, error: null });

      await expect(adapter.trocarDePlano('plano-tesoura')).rejects.toThrow('Não foi possível trocar de plano. Tente de novo.');
    });

    it('sem o final do cartão, não manda o campo', async () => {
      mockInvoke.mockResolvedValue({ data: respostaDaFuncao, error: null });

      await adapter.trocarDePlano('plano', { token: 'e3ed6f098462036dd2cbabe314b9de2a', final: null, valorConfirmado: 20 });

      expect(mockInvoke.mock.calls[0][1].body).not.toHaveProperty('cardLast4');
    });

    it('sem cobrança (em teste, ou diferença pequena demais), manda só o plano', async () => {
      mockInvoke.mockResolvedValue({ data: { ...respostaDaFuncao, charged: 0 }, error: null });

      const trocado = await adapter.trocarDePlano('plano');

      expect(mockInvoke).toHaveBeenCalledWith('billing', { body: { action: 'trocar_plano', planId: 'plano' } });
      expect(trocado.cobrado).toBe(0);
    });

    it('o valor novo da próxima cobrança que o Mercado Pago não aceitou vem como não atualizado', async () => {
      mockInvoke.mockResolvedValue({ data: { ...respostaDaFuncao, nextChargeUpdated: false }, error: null });

      await expect(adapter.trocarDePlano('plano')).resolves.toMatchObject({ proximaCobrancaAtualizada: false });
    });

    it.each([
      ['cartão recusado', 'O cartão não tem saldo suficiente. O plano continua o mesmo.'],
      ['valor que mudou', 'O valor da diferença mudou. Feche esta janela e abra de novo para ver o valor atual.'],
    ])('mostra a mensagem que a função devolveu na recusa (%s)', async (_nome, mensagem) => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({ error: mensagem }) } },
      });

      await expect(adapter.trocarDePlano('plano')).rejects.toThrow(mensagem);
    });

    it('sem mensagem da função, usa um texto claro da troca de plano', async () => {
      mockInvoke.mockResolvedValue({ data: null, error: { message: 'Failed to send a request to the Edge Function' } });

      await expect(adapter.trocarDePlano('plano')).rejects.toThrow('Não foi possível trocar de plano. Tente de novo.');
    });

    it('resposta sem changed é tratada como falha', async () => {
      mockInvoke.mockResolvedValue({ data: {}, error: null });

      await expect(adapter.trocarDePlano('plano')).rejects.toThrow('Não foi possível trocar de plano. Tente de novo.');
    });
  });
  describe('desfazerDescidaDePlano', () => {
    it('chama a função de cobrança com a ação desfazer_descida', async () => {
      mockInvoke.mockResolvedValue({ data: { canceled: true }, error: null });

      await expect(adapter.desfazerDescidaDePlano()).resolves.toBeUndefined();

      expect(mockInvoke).toHaveBeenCalledWith('billing', { body: { action: 'desfazer_descida' } });
    });

    it('mostra a mensagem que a função devolveu na recusa', async () => {
      const mensagem = 'Não há descida de plano agendada.';
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({ error: mensagem }) } },
      });

      await expect(adapter.desfazerDescidaDePlano()).rejects.toThrow(mensagem);
    });

    it('sem mensagem da função, usa um texto claro', async () => {
      mockInvoke.mockResolvedValue({ data: null, error: { message: 'Failed to send a request to the Edge Function' } });

      await expect(adapter.desfazerDescidaDePlano()).rejects.toThrow('Não foi possível desfazer a descida de plano. Tente de novo.');
    });

    it('resposta sem canceled é tratada como falha', async () => {
      mockInvoke.mockResolvedValue({ data: {}, error: null });

      await expect(adapter.desfazerDescidaDePlano()).rejects.toThrow('Não foi possível desfazer a descida de plano. Tente de novo.');
    });
  });

  // Spec 052, ticket 12: a função de cobrança confere no servidor que quem chama é o Gerente da barbearia; o front não manda
  // barbearia nem assinatura, então não há como cancelar a de outra.
  describe('cancelarAssinatura', () => {
    it('chama a função de cobrança com a ação cancelar', async () => {
      mockInvoke.mockResolvedValue({ data: { canceled: true }, error: null });

      await expect(adapter.cancelarAssinatura()).resolves.toBeUndefined();

      expect(mockInvoke).toHaveBeenCalledWith('billing', { body: { action: 'cancelar' } });
    });

    it('mostra a mensagem que a função devolveu na recusa', async () => {
      const mensagem = 'A assinatura já está cancelada.';
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({ error: mensagem }) } },
      });

      await expect(adapter.cancelarAssinatura()).rejects.toThrow(mensagem);
    });

    it('sem mensagem da função, usa um texto claro', async () => {
      mockInvoke.mockResolvedValue({ data: null, error: { message: 'Failed to send a request to the Edge Function' } });

      await expect(adapter.cancelarAssinatura()).rejects.toThrow('Não foi possível cancelar a assinatura. Tente de novo.');
    });

    it('resposta sem canceled é tratada como falha', async () => {
      mockInvoke.mockResolvedValue({ data: {}, error: null });

      await expect(adapter.cancelarAssinatura()).rejects.toThrow('Não foi possível cancelar a assinatura. Tente de novo.');
    });
  });
});
