import { describe, expect, it } from 'vitest';
import { SupabaseProprietarioAdapter } from '../adapters/SupabaseProprietarioAdapter';

interface ChamadaDeRpc {
  nome: string;
  argumentos: Record<string, unknown>;
}

/** O que o adaptador usa do cliente do Supabase: rpc(nome, argumentos). */
function clienteFalso(respostas: Record<string, { data?: unknown; error?: { message: string; code?: string } }> = {}) {
  const chamadas: ChamadaDeRpc[] = [];
  const client = {
    rpc(nome: string, argumentos: Record<string, unknown>) {
      chamadas.push({ nome, argumentos });
      const resposta = respostas[nome] ?? {};
      return Promise.resolve({ data: resposta.data ?? null, error: resposta.error ?? null });
    },
  };
  return { client: client as never, chamadas };
}

// O que `admin_get_tenant_subscription` devolve (supabase/migrations/..._052_ticket15_ferramentas_do_proprietario.sql).
const DETALHES_DO_BANCO = {
  tenant: {
    id: 'tenant-1',
    name: 'Barbearia Alpha',
    email: 'alpha@exemplo.com',
    phone: '92999990001',
    timezone: 'America/Manaus',
    created_at: '2026-01-10T15:30:00+00:00',
  },
  subscription: {
    status: 'blocked',
    trial_ends_at: null,
    current_period_start: '2026-08-01T12:00:00+00:00',
    current_period_end: '2026-09-01T12:00:00+00:00',
    first_failed_at: null,
    blocked_at: '2026-09-20T12:00:00+00:00',
    blocked_reason: 'refunded',
    canceled_at: null,
    courtesy_ends_at: null,
    unblocked_until: '2040-03-11T02:59:59.999999+00:00',
    mp_subscription_id: 'mp-sub-1',
    card_brand: 'visa',
    card_last4: '5682',
    plan: { id: 'plano-maquina', name: 'Máquina', price: 89.9, max_professionals: 5 },
    scheduled_plan: { id: 'plano-tesoura', name: 'Tesoura', price: 59.9, max_professionals: 1 },
  },
  access: { access: 'warning', reason: 'unblocked', relevant_date: '2040-03-11T02:59:59.999999+00:00' },
  active_professionals: 2,
  charges: [
    {
      id: 'cobranca-1',
      mp_payment_id: 'pagamento-1',
      mp_subscription_id: 'mp-sub-1',
      kind: 'recurring',
      status: 'approved',
      amount: 89.9,
      charged_at: '2026-09-01T12:00:00+00:00',
      card_brand: 'visa',
      card_last4: '5682',
    },
    {
      id: 'cobranca-2',
      mp_payment_id: 'pagamento-2',
      mp_subscription_id: null,
      kind: 'upgrade',
      status: 'rejected',
      amount: 70,
      charged_at: '2026-08-15T12:00:00+00:00',
      card_brand: null,
      card_last4: null,
    },
  ],
  unblock: { reason: 'o cliente paga na segunda', at: '2026-10-02T12:00:00+00:00', until: '2040-03-11T02:59:59.999999+00:00' },
  admin_actions: [
    { action: 'admin_unblock_tenant', at: '2026-10-02T12:00:00+00:00', by: 'Dono do Navalhado', details: { reason: 'o cliente paga na segunda' } },
  ],
};

describe('SupabaseProprietarioAdapter', () => {
  describe('obterDetalhes', () => {
    it('lê pela função do banco e traduz o que ela devolve', async () => {
      const { client, chamadas } = clienteFalso({ admin_get_tenant_subscription: { data: DETALHES_DO_BANCO } });

      const detalhes = await new SupabaseProprietarioAdapter(client).obterDetalhes('tenant-1');

      expect(chamadas).toEqual([{ nome: 'admin_get_tenant_subscription', argumentos: { p_tenant_id: 'tenant-1' } }]);
      expect(detalhes.barbearia).toEqual({
        id: 'tenant-1',
        nome: 'Barbearia Alpha',
        email: 'alpha@exemplo.com',
        telefone: '92999990001',
        fuso: 'America/Manaus',
        criadaEm: new Date('2026-01-10T15:30:00Z'),
      });
      expect(detalhes.assinatura).toEqual({
        situacao: 'blocked',
        plano: { id: 'plano-maquina', nome: 'Máquina', preco: 89.9, limiteDeProfissionais: 5 },
        planoAgendado: { id: 'plano-tesoura', nome: 'Tesoura', preco: 59.9, limiteDeProfissionais: 1 },
        testeAte: null,
        periodoDesde: new Date('2026-08-01T12:00:00Z'),
        periodoAte: new Date('2026-09-01T12:00:00Z'),
        primeiraRecusaEm: null,
        bloqueadaEm: new Date('2026-09-20T12:00:00Z'),
        motivoDoBloqueio: 'refunded',
        canceladaEm: null,
        cortesiaAte: null,
        desbloqueadaAte: new Date('2040-03-11T02:59:59.999Z'),
        assinaturaNoMercadoPago: 'mp-sub-1',
        cartao: { bandeira: 'visa', final: '5682' },
      });
      expect(detalhes.acesso).toEqual({ nivel: 'warning', motivo: 'unblocked', dataRelevante: new Date('2040-03-11T02:59:59.999Z') });
      expect(detalhes.profissionaisAtivos).toBe(2);
      expect(detalhes.cobrancas).toEqual([
        {
          id: 'cobranca-1',
          pagamentoNoMercadoPago: 'pagamento-1',
          assinaturaNoMercadoPago: 'mp-sub-1',
          tipo: 'recurring',
          situacao: 'approved',
          valor: 89.9,
          cobradaEm: new Date('2026-09-01T12:00:00Z'),
          cartao: { bandeira: 'visa', final: '5682' },
        },
        {
          id: 'cobranca-2',
          pagamentoNoMercadoPago: 'pagamento-2',
          assinaturaNoMercadoPago: null,
          tipo: 'upgrade',
          situacao: 'rejected',
          valor: 70,
          cobradaEm: new Date('2026-08-15T12:00:00Z'),
          cartao: null,
        },
      ]);
      expect(detalhes.desbloqueio).toEqual({
        motivo: 'o cliente paga na segunda',
        em: new Date('2026-10-02T12:00:00Z'),
        ate: new Date('2040-03-11T02:59:59.999Z'),
      });
      expect(detalhes.acoes).toEqual([
        {
          acao: 'admin_unblock_tenant',
          em: new Date('2026-10-02T12:00:00Z'),
          por: 'Dono do Navalhado',
          detalhes: { reason: 'o cliente paga na segunda' },
        },
      ]);
    });

    it('a barbearia sem assinatura vem com assinatura nula, sem desbloqueio e sem cobranças', async () => {
      const { client } = clienteFalso({
        admin_get_tenant_subscription: {
          data: {
            tenant: DETALHES_DO_BANCO.tenant,
            subscription: null,
            access: { access: 'allowed', reason: 'no_subscription', relevant_date: null },
            active_professionals: 0,
            charges: [],
            unblock: null,
            admin_actions: [],
          },
        },
      });

      const detalhes = await new SupabaseProprietarioAdapter(client).obterDetalhes('tenant-1');

      expect(detalhes.assinatura).toBeNull();
      expect(detalhes.acesso).toEqual({ nivel: 'allowed', motivo: 'no_subscription', dataRelevante: null });
      expect(detalhes.cobrancas).toEqual([]);
      expect(detalhes.desbloqueio).toBeNull();
      expect(detalhes.acoes).toEqual([]);
    });

    it('sem cartão (bandeira e final nulos) e sem plano agendado', async () => {
      const { client } = clienteFalso({
        admin_get_tenant_subscription: {
          data: {
            ...DETALHES_DO_BANCO,
            subscription: { ...DETALHES_DO_BANCO.subscription, card_brand: null, card_last4: null, scheduled_plan: null, unblocked_until: null },
            unblock: null,
          },
        },
      });

      const { assinatura, desbloqueio } = await new SupabaseProprietarioAdapter(client).obterDetalhes('tenant-1');

      expect(assinatura?.cartao).toBeNull();
      expect(assinatura?.planoAgendado).toBeNull();
      expect(assinatura?.desbloqueadaAte).toBeNull();
      expect(desbloqueio).toBeNull();
    });

    it('o erro do banco sobe como veio, para o repositório traduzir', async () => {
      const erro = { message: 'TENANT_NOT_FOUND', code: 'P0002' };
      const { client } = clienteFalso({ admin_get_tenant_subscription: { error: erro } });

      await expect(new SupabaseProprietarioAdapter(client).obterDetalhes('tenant-x')).rejects.toBe(erro);
    });
  });

  describe('as ações', () => {
    it.each([
      ['estenderTeste', (a: SupabaseProprietarioAdapter) => a.estenderTeste('tenant-1', '2040-03-10'), 'admin_extend_trial', { p_tenant_id: 'tenant-1', p_until: '2040-03-10' }],
      ['darCortesia com data', (a: SupabaseProprietarioAdapter) => a.darCortesia('tenant-1', '2040-06-30'), 'admin_set_courtesy', { p_tenant_id: 'tenant-1', p_ends_on: '2040-06-30' }],
      ['darCortesia sem fim', (a: SupabaseProprietarioAdapter) => a.darCortesia('tenant-1', null), 'admin_set_courtesy', { p_tenant_id: 'tenant-1', p_ends_on: null }],
      ['encerrarCortesia', (a: SupabaseProprietarioAdapter) => a.encerrarCortesia('tenant-1'), 'admin_end_courtesy', { p_tenant_id: 'tenant-1' }],
      [
        'desbloquear',
        (a: SupabaseProprietarioAdapter) => a.desbloquear('tenant-1', '2040-03-10', 'pagamento em análise'),
        'admin_unblock_tenant',
        { p_tenant_id: 'tenant-1', p_until: '2040-03-10', p_reason: 'pagamento em análise' },
      ],
      ['bloquear', (a: SupabaseProprietarioAdapter) => a.bloquear('tenant-1', 'uso indevido'), 'admin_block_tenant', { p_tenant_id: 'tenant-1', p_reason: 'uso indevido' }],
    ])('%s chama a função do banco certa, com os argumentos certos', async (_nome, acao, funcao, argumentos) => {
      const { client, chamadas } = clienteFalso();

      await acao(new SupabaseProprietarioAdapter(client));

      expect(chamadas).toEqual([{ nome: funcao, argumentos }]);
    });

    it('o erro do banco sobe como veio', async () => {
      const erro = { message: 'NOT_BLOCKED', code: '55000' };
      const { client } = clienteFalso({ admin_unblock_tenant: { error: erro } });

      await expect(new SupabaseProprietarioAdapter(client).desbloquear('tenant-1', '2040-03-10', 'motivo')).rejects.toBe(erro);
    });
  });

  describe('listarAvisosQueFalharam', () => {
    it('traduz a lista da função do banco, na ordem em que vem', async () => {
      const { client, chamadas } = clienteFalso({
        admin_list_failed_billing_notices: {
          data: [
            {
              id: 'aviso-1',
              tenant_id: 'tenant-1',
              tenant_name: 'Barbearia Alpha',
              kind: 'payment_failed_day0',
              ref_at: '2026-09-26T12:00:00+00:00',
              attempts: 3,
              detail: 'Resend 403: domínio sem verificação',
              created_at: '2026-10-01T12:00:00+00:00',
            },
            {
              id: 'aviso-2',
              tenant_id: 'tenant-2',
              tenant_name: null,
              kind: 'trial_ending',
              ref_at: '2026-09-20T12:00:00+00:00',
              attempts: 1,
              detail: null,
              created_at: '2026-09-29T12:00:00+00:00',
            },
          ],
        },
      });

      const avisos = await new SupabaseProprietarioAdapter(client).listarAvisosQueFalharam(20);

      expect(chamadas).toEqual([{ nome: 'admin_list_failed_billing_notices', argumentos: { p_limit: 20 } }]);
      expect(avisos).toEqual([
        {
          id: 'aviso-1',
          tenantId: 'tenant-1',
          barbearia: 'Barbearia Alpha',
          tipo: 'payment_failed_day0',
          referenciaEm: new Date('2026-09-26T12:00:00Z'),
          tentativas: 3,
          motivo: 'Resend 403: domínio sem verificação',
          criadoEm: new Date('2026-10-01T12:00:00Z'),
        },
        {
          id: 'aviso-2',
          tenantId: 'tenant-2',
          barbearia: null,
          tipo: 'trial_ending',
          referenciaEm: new Date('2026-09-20T12:00:00Z'),
          tentativas: 1,
          motivo: null,
          criadoEm: new Date('2026-09-29T12:00:00Z'),
        },
      ]);
    });

    it('sem avisos que falharam, uma lista vazia', async () => {
      const { client } = clienteFalso({ admin_list_failed_billing_notices: { data: [] } });

      expect(await new SupabaseProprietarioAdapter(client).listarAvisosQueFalharam(50)).toEqual([]);
    });
  });
});
