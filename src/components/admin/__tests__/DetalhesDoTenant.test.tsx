import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SituacaoDaAssinatura } from '../../../modules/assinatura/situacaoDaAssinatura';
import type { MotivoDeAcesso } from '../../../modules/assinatura/types';
import type { AcessoDoTenant, AssinaturaDoTenant, DetalhesDoTenant as DadosDoTenant } from '../../../modules/proprietario/types';

const { mockUseDetalhes, mockUseAcoes, recarregar, executar, limparErro } = vi.hoisted(() => ({
  mockUseDetalhes: vi.fn(),
  mockUseAcoes: vi.fn(),
  recarregar: vi.fn(),
  executar: vi.fn(),
  limparErro: vi.fn(),
}));

vi.mock('../../../modules/proprietario/useDetalhesDoTenant', () => ({
  useDetalhesDoTenant: (...args: unknown[]) => mockUseDetalhes(...args),
}));
vi.mock('../../../modules/proprietario/useAcoesDoProprietario', () => ({
  useAcoesDoProprietario: () => mockUseAcoes(),
}));

import { DetalhesDoTenant } from '../DetalhesDoTenant';

// Spec 052, ticket 15: a visão de detalhe de Admin > Tenants. O que o banco decide (estados, datas, recusas) tem o pgTAP 78 e o
// módulo `proprietario` tem teste próprio; aqui interessa o que a tela mostra e o que pede, com confirmação.

const PLANO = { id: 'plano-maquina', nome: 'Máquina', preco: 89.9, limiteDeProfissionais: 5 };

const assinatura = (situacao: SituacaoDaAssinatura, extra: Partial<AssinaturaDoTenant> = {}): AssinaturaDoTenant => ({
  situacao,
  plano: PLANO,
  planoAgendado: null,
  testeAte: null,
  periodoDesde: null,
  periodoAte: null,
  primeiraRecusaEm: null,
  bloqueadaEm: null,
  motivoDoBloqueio: null,
  canceladaEm: null,
  cortesiaAte: null,
  desbloqueadaAte: null,
  assinaturaNoMercadoPago: null,
  cartao: null,
  ...extra,
});

const acesso = (nivel: AcessoDoTenant['nivel'], motivo: MotivoDeAcesso, dataRelevante: Date | null = null): AcessoDoTenant => ({ nivel, motivo, dataRelevante });

const detalhes = (sub: AssinaturaDoTenant | null, estado: AcessoDoTenant, extra: Partial<DadosDoTenant> = {}): DadosDoTenant => ({
  barbearia: { id: 'tenant-1', nome: 'Barbearia Alpha', email: 'alpha@exemplo.com', telefone: '92999990001', fuso: 'America/Manaus', criadaEm: new Date('2026-01-10T15:30:00Z') },
  assinatura: sub,
  acesso: estado,
  profissionaisAtivos: 2,
  cobrancas: [],
  desbloqueio: null,
  acoes: [],
  ...extra,
});

const mostrar = (d: DadosDoTenant | null, estado: { status?: string; erro?: string | null } = {}) =>
  mockUseDetalhes.mockReturnValue({ detalhes: d, status: estado.status ?? (d ? 'ready' : 'loading'), erro: estado.erro ?? null, recarregar });

const acoesEm = (estado: { emAndamento?: boolean; erro?: string | null } = {}) =>
  mockUseAcoes.mockReturnValue({ executar, emAndamento: false, erro: null, limparErro, ...estado });

const renderizar = (aoFechar = vi.fn(), aoMudar = vi.fn()) => {
  render(<DetalhesDoTenant tenantId="tenant-1" aoFechar={aoFechar} aoMudar={aoMudar} />);
  return { aoFechar, aoMudar };
};

describe('DetalhesDoTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    acoesEm();
    executar.mockResolvedValue(true);
  });

  it('sem barbearia escolhida não mostra nada', () => {
    mostrar(null, { status: 'idle' });
    render(<DetalhesDoTenant tenantId={null} aoFechar={vi.fn()} aoMudar={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockUseDetalhes).toHaveBeenCalledWith(null);
  });

  it('enquanto lê, diz que está carregando', () => {
    mostrar(null, { status: 'loading' });
    renderizar();

    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('se a leitura falha, mostra o motivo e deixa tentar de novo', async () => {
    mostrar(null, { status: 'error', erro: 'Barbearia não encontrada.' });
    renderizar();

    expect(screen.getByRole('alert')).toHaveTextContent('Barbearia não encontrada.');
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  describe('o que mostra', () => {
    const bloqueadaELiberada = detalhes(
      assinatura('blocked', {
        motivoDoBloqueio: 'refunded',
        bloqueadaEm: new Date('2026-09-20T12:00:00Z'),
        desbloqueadaAte: new Date('2040-03-11T03:59:59.999Z'),
        periodoDesde: new Date('2026-08-01T12:00:00Z'),
        periodoAte: new Date('2026-09-01T12:00:00Z'),
        assinaturaNoMercadoPago: 'mp-sub-1',
        cartao: { bandeira: 'visa', final: '5682' },
      }),
      acesso('warning', 'unblocked', new Date('2040-03-11T03:59:59.999Z')),
      {
        cobrancas: [
          {
            id: 'c1',
            pagamentoNoMercadoPago: 'pagamento-1',
            assinaturaNoMercadoPago: 'mp-sub-1',
            tipo: 'recurring',
            situacao: 'approved',
            valor: 89.9,
            cobradaEm: new Date('2026-09-01T12:00:00Z'),
            cartao: { bandeira: 'visa', final: '5682' },
          },
          {
            id: 'c2',
            pagamentoNoMercadoPago: 'pagamento-2',
            assinaturaNoMercadoPago: null,
            tipo: 'upgrade',
            situacao: 'rejected',
            valor: 70,
            cobradaEm: new Date('2026-08-15T12:00:00Z'),
            cartao: null,
          },
        ],
        desbloqueio: { motivo: 'o cliente paga na segunda', em: new Date('2026-10-02T12:00:00Z'), ate: new Date('2040-03-11T03:59:59.999Z') },
        acoes: [
          {
            acao: 'admin_unblock_tenant',
            em: new Date('2026-10-02T12:00:00Z'),
            por: 'Dono do Navalhado',
            detalhes: { reason: 'o cliente paga na segunda', unblocked_until: '2040-03-11T03:59:59.999999+00:00' },
          },
        ],
      },
    );

    beforeEach(() => mostrar(bloqueadaELiberada));

    it('a barbearia e o Estado de Acesso de hoje', () => {
      renderizar();

      expect(screen.getByRole('heading', { name: 'Barbearia Alpha' })).toBeInTheDocument();
      expect(screen.getByText('alpha@exemplo.com')).toBeInTheDocument();
      expect(screen.getByText('92999990001')).toBeInTheDocument();
      expect(screen.getByText('Liberado com aviso')).toBeInTheDocument();
      expect(screen.getByText('Liberada à mão até 10/03')).toBeInTheDocument();
    });

    it('a assinatura: plano, situação, profissionais, cartão e os ids do Mercado Pago', () => {
      renderizar();

      // O final do cartão também aparece em cada cobrança: aqui só interessa a seção da assinatura.
      const assinaturaDaTela = within(screen.getByRole('region', { name: 'Assinatura' }));
      expect(assinaturaDaTela.getByText(/Máquina/)).toHaveTextContent('R$ 89,90');
      expect(assinaturaDaTela.getByText('Bloqueada')).toBeInTheDocument();
      expect(assinaturaDaTela.getByText('Pagamento estornado')).toBeInTheDocument();
      expect(assinaturaDaTela.getByText('2 de 5')).toBeInTheDocument();
      expect(assinaturaDaTela.getByText('Visa final 5682')).toBeInTheDocument();
      expect(assinaturaDaTela.getByText('mp-sub-1')).toBeInTheDocument();
    });

    it('o desbloqueio em vigor, com o motivo que o Proprietário deu e o ano (uma data sem o ano esconde um erro de digitação)', () => {
      renderizar();

      expect(screen.getByText(/o cliente paga na segunda/, { selector: 'p' })).toBeInTheDocument();
      expect(screen.getByText(/Desbloqueada até 10\/03\/2040/)).toBeInTheDocument();
    });

    it('o histórico de cobranças, da mais nova para a mais antiga', () => {
      renderizar();

      const tabela = screen.getByRole('table', { name: /cobranças/i });
      const linhas = within(tabela).getAllByRole('row').slice(1);
      expect(linhas).toHaveLength(2);
      expect(linhas[0]).toHaveTextContent('01/09/2026');
      expect(linhas[0]).toHaveTextContent('Mensalidade');
      expect(linhas[0]).toHaveTextContent('Paga');
      expect(linhas[0]).toHaveTextContent('R$ 89,90');
      expect(linhas[0]).toHaveTextContent('pagamento-1');
      expect(linhas[1]).toHaveTextContent('Diferença de plano');
      expect(linhas[1]).toHaveTextContent('Recusada');
    });

    it('as ações que o Proprietário já fez nessa barbearia', () => {
      renderizar();

      const lista = screen.getByRole('list', { name: /ações do proprietário/i });
      expect(lista).toHaveTextContent('Desbloqueio manual');
      expect(lista).toHaveTextContent('Dono do Navalhado');
      expect(lista).toHaveTextContent('até 10/03: o cliente paga na segunda');
    });
  });

  describe('o plano e o limite de profissionais', () => {
    const TESOURA = { id: 'plano-tesoura', nome: 'Tesoura', preco: 59.9, limiteDeProfissionais: 1 };
    const BANCADA = { id: 'plano-bancada', nome: 'Bancada', preco: 159.9, limiteDeProfissionais: 10 };

    it('o limite de 1 profissional não vira "1 profissionais"', () => {
      mostrar(detalhes(assinatura('active', { plano: TESOURA }), acesso('allowed', 'active'), { profissionaisAtivos: 1 }));
      renderizar();

      const assinaturaDaTela = within(screen.getByRole('region', { name: 'Assinatura' }));
      expect(assinaturaDaTela.getByText(/Tesoura, R\$ 59,90 por mês \(até 1 profissional\)/)).toBeInTheDocument();
      expect(assinaturaDaTela.queryByText(/1 profissionais/)).not.toBeInTheDocument();
    });

    it('o limite de mais de um continua no plural', () => {
      mostrar(detalhes(assinatura('active'), acesso('allowed', 'active')));
      renderizar();

      expect(screen.getByText(/\(até 5 profissionais\)/)).toBeInTheDocument();
    });

    it('com uma descida agendada mostra o plano agendado e conta os profissionais contra o menor limite, que é o que o banco aplica', () => {
      mostrar(
        detalhes(assinatura('active', { plano: BANCADA, planoAgendado: PLANO }), acesso('allowed', 'active'), { profissionaisAtivos: 5 }),
      );
      renderizar();

      const assinaturaDaTela = within(screen.getByRole('region', { name: 'Assinatura' }));
      expect(assinaturaDaTela.getByText(/Máquina, R\$ 89,90 por mês, na próxima cobrança \(até 5 profissionais\)/)).toBeInTheDocument();
      // Um sexto profissional é recusado (limite 5, o do plano agendado), e a tela explica por quê.
      expect(assinaturaDaTela.getByText('5 de 5 (limite do plano agendado)')).toBeInTheDocument();
    });

    it('sem descida agendada, o limite é o do plano e não há nota', () => {
      mostrar(detalhes(assinatura('active'), acesso('allowed', 'active')));
      renderizar();

      expect(screen.getByText('2 de 5')).toBeInTheDocument();
      expect(screen.queryByText(/limite do plano agendado/)).not.toBeInTheDocument();
    });
  });

  it('a barbearia sem assinatura diz isso e não oferece ação nenhuma', () => {
    mostrar(detalhes(null, acesso('allowed', 'no_subscription')));
    renderizar();

    expect(screen.getByText('Esta barbearia não tem assinatura.')).toBeInTheDocument();
    for (const nome of ['Estender teste', 'Dar cortesia', 'Desbloquear', 'Bloquear']) {
      expect(screen.queryByRole('button', { name: nome })).not.toBeInTheDocument();
    }
  });

  describe('as ações que cada estado oferece', () => {
    it.each<[string, DadosDoTenant, string[], string[]]>([
      ['em teste', detalhes(assinatura('trialing'), acesso('allowed', 'trial')), ['Estender teste', 'Dar cortesia', 'Bloquear'], ['Desbloquear', 'Encerrar cortesia']],
      [
        'bloqueada pelo teste vencido',
        detalhes(assinatura('blocked', { motivoDoBloqueio: 'trial_expired' }), acesso('blocked', 'trial_expired')),
        ['Estender teste', 'Dar cortesia', 'Desbloquear'],
        ['Bloquear', 'Encerrar cortesia'],
      ],
      [
        'bloqueada por estorno',
        detalhes(assinatura('blocked', { motivoDoBloqueio: 'refunded' }), acesso('blocked', 'refunded')),
        ['Dar cortesia', 'Desbloquear'],
        ['Estender teste', 'Bloquear', 'Encerrar cortesia'],
      ],
      [
        'bloqueada e liberada à mão (dá para mudar a data e para encerrar o desbloqueio)',
        detalhes(assinatura('blocked', { motivoDoBloqueio: 'refunded' }), acesso('warning', 'unblocked')),
        ['Dar cortesia', 'Desbloquear', 'Bloquear'],
        ['Estender teste', 'Encerrar cortesia'],
      ],
      ['em cortesia', detalhes(assinatura('courtesy'), acesso('allowed', 'courtesy')), ['Alterar cortesia', 'Encerrar cortesia', 'Bloquear'], ['Dar cortesia', 'Desbloquear', 'Estender teste']],
      ['ativa', detalhes(assinatura('active'), acesso('allowed', 'active')), ['Dar cortesia', 'Bloquear'], ['Estender teste', 'Desbloquear', 'Encerrar cortesia']],
    ])('%s', (_caso, entrada, oferece, naoOferece) => {
      mostrar(entrada);
      renderizar();

      for (const nome of oferece) expect(screen.getByRole('button', { name: nome })).toBeInTheDocument();
      for (const nome of naoOferece) expect(screen.queryByRole('button', { name: nome })).not.toBeInTheDocument();
    });
  });

  describe('estender o teste', () => {
    beforeEach(() => mostrar(detalhes(assinatura('trialing', { testeAte: new Date('2040-02-01T12:00:00Z') }), acesso('allowed', 'trial'))));

    it('pede o dia, e só confirma com ele', async () => {
      renderizar();
      await userEvent.click(screen.getByRole('button', { name: 'Estender teste' }));

      const confirmar = screen.getByRole('button', { name: 'Confirmar: estender teste' });
      expect(confirmar).toBeDisabled();

      fireEvent.change(screen.getByLabelText(/estender o teste até/i), { target: { value: '2040-03-10' } });
      expect(confirmar).toBeEnabled();
      await userEvent.click(confirmar);

      expect(executar).toHaveBeenCalledWith('tenant-1', { tipo: 'estenderTeste', ate: '2040-03-10' });
    });

    it('o dia mais cedo possível é o seguinte ao fim do teste de hoje, no fuso da barbearia', async () => {
      renderizar();
      await userEvent.click(screen.getByRole('button', { name: 'Estender teste' }));

      // 12:00 UTC de 01/02/2040 é 08:00 do dia 1 em Manaus: estender começa em 02/02.
      expect(screen.getByLabelText(/estender o teste até/i)).toHaveAttribute('min', '2040-02-02');
    });

    it('com o cartão já autorizado avisa que o Mercado Pago cobra na data dele', async () => {
      mostrar(detalhes(assinatura('trialing', { testeAte: new Date('2040-02-01T12:00:00Z'), cartao: { bandeira: 'visa', final: '5682' } }), acesso('allowed', 'trial')));
      renderizar();
      await userEvent.click(screen.getByRole('button', { name: 'Estender teste' }));

      expect(screen.getByText(/a primeira cobrança sai na data que ele marcou/i)).toBeInTheDocument();
    });

    it('cancelar fecha a pergunta sem pedir nada', async () => {
      renderizar();
      await userEvent.click(screen.getByRole('button', { name: 'Estender teste' }));
      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByLabelText(/estender o teste até/i)).not.toBeInTheDocument();
      expect(executar).not.toHaveBeenCalled();
    });

    it('quando o banco aceita, fecha a pergunta, relê os detalhes e avisa quem chamou', async () => {
      const { aoMudar } = renderizar();
      await userEvent.click(screen.getByRole('button', { name: 'Estender teste' }));
      fireEvent.change(screen.getByLabelText(/estender o teste até/i), { target: { value: '2040-03-10' } });

      await userEvent.click(screen.getByRole('button', { name: 'Confirmar: estender teste' }));

      expect(recarregar).toHaveBeenCalledTimes(1);
      expect(aoMudar).toHaveBeenCalledTimes(1);
      expect(screen.queryByLabelText(/estender o teste até/i)).not.toBeInTheDocument();
    });

    // Uma recusa por estado (já não está bloqueada, já não é cortesia, o teste mudou) quer dizer que o que a gaveta mostra está velho:
    // relê, para os botões e o estado acompanharem o banco, e deixa a pergunta aberta com o motivo. A lista só relê quando o banco aceitou.
    it('quando o banco recusa, a pergunta fica aberta com o motivo, os detalhes são relidos e a lista não', async () => {
      executar.mockResolvedValue(null);
      acoesEm({ erro: 'A data precisa ser de hoje em diante.' });
      const { aoMudar } = renderizar();
      await userEvent.click(screen.getByRole('button', { name: 'Estender teste' }));
      fireEvent.change(screen.getByLabelText(/estender o teste até/i), { target: { value: '2040-03-10' } });
      await userEvent.click(screen.getByRole('button', { name: 'Confirmar: estender teste' }));

      expect(screen.getByRole('alert')).toHaveTextContent('A data precisa ser de hoje em diante.');
      expect(screen.getByLabelText(/estender o teste até/i)).toBeInTheDocument();
      expect(recarregar).toHaveBeenCalledTimes(1);
      expect(aoMudar).not.toHaveBeenCalled();
    });

    it('enquanto o banco responde, o botão não aceita outro clique', async () => {
      acoesEm({ emAndamento: true });
      renderizar();
      await userEvent.click(screen.getByRole('button', { name: 'Estender teste' }));
      fireEvent.change(screen.getByLabelText(/estender o teste até/i), { target: { value: '2040-03-10' } });

      expect(screen.getByRole('button', { name: /Confirmar: estender teste/ })).toBeDisabled();
    });
  });

  describe('dar cortesia', () => {
    it('sem data de fim é o padrão', async () => {
      mostrar(detalhes(assinatura('active'), acesso('allowed', 'active')));
      renderizar();
      await userEvent.click(screen.getByRole('button', { name: 'Dar cortesia' }));

      expect(screen.getByRole('radio', { name: 'Sem data de fim' })).toBeChecked();
      await userEvent.click(screen.getByRole('button', { name: 'Confirmar: dar cortesia' }));

      expect(executar).toHaveBeenCalledWith('tenant-1', { tipo: 'darCortesia', ate: null });
    });

    it('com data de fim pede o dia', async () => {
      mostrar(detalhes(assinatura('active'), acesso('allowed', 'active')));
      renderizar();
      await userEvent.click(screen.getByRole('button', { name: 'Dar cortesia' }));
      await userEvent.click(screen.getByRole('radio', { name: 'Até uma data' }));

      expect(screen.getByRole('button', { name: 'Confirmar: dar cortesia' })).toBeDisabled();
      fireEvent.change(screen.getByLabelText(/cortesia até/i), { target: { value: '2040-06-30' } });
      await userEvent.click(screen.getByRole('button', { name: 'Confirmar: dar cortesia' }));

      expect(executar).toHaveBeenCalledWith('tenant-1', { tipo: 'darCortesia', ate: '2040-06-30' });
    });

    it('com assinatura viva no Mercado Pago avisa que a cortesia não a cancela', async () => {
      mostrar(detalhes(assinatura('active', { assinaturaNoMercadoPago: 'mp-sub-1' }), acesso('allowed', 'active')));
      renderizar();
      await userEvent.click(screen.getByRole('button', { name: 'Dar cortesia' }));

      expect(screen.getByText(/a cortesia não a cancela/i)).toBeInTheDocument();
    });

    it('sem assinatura no Mercado Pago não traz o aviso', async () => {
      mostrar(detalhes(assinatura('active'), acesso('allowed', 'active')));
      renderizar();
      await userEvent.click(screen.getByRole('button', { name: 'Dar cortesia' }));

      expect(screen.queryByText(/a cortesia não a cancela/i)).not.toBeInTheDocument();
    });

    // O gatilho do banco tira a descida agendada de quem está em cortesia (sem cobrança, nada a agendar), enquanto o valor da
    // assinatura no Mercado Pago já é o do plano menor: o Proprietário precisa saber antes de confirmar.
    it('com uma descida de plano agendada avisa que a cortesia a desfaz e que o Mercado Pago já cobra o valor do plano menor', async () => {
      mostrar(
        detalhes(
          assinatura('active', {
            assinaturaNoMercadoPago: 'mp-sub-1',
            plano: { id: 'plano-bancada', nome: 'Bancada', preco: 159.9, limiteDeProfissionais: 10 },
            planoAgendado: PLANO,
          }),
          acesso('allowed', 'active'),
        ),
      );
      renderizar();
      await userEvent.click(screen.getByRole('button', { name: 'Dar cortesia' }));

      expect(screen.getByText(/descida de plano agendada, para Máquina/i)).toHaveTextContent(/a cortesia a desfaz/i);
      expect(screen.getByText(/descida de plano agendada, para Máquina/i)).toHaveTextContent(/já cobra o valor do plano menor/i);
    });

    it('sem descida agendada não traz esse aviso', async () => {
      mostrar(detalhes(assinatura('active'), acesso('allowed', 'active')));
      renderizar();
      await userEvent.click(screen.getByRole('button', { name: 'Dar cortesia' }));

      expect(screen.queryByText(/descida de plano agendada/i)).not.toBeInTheDocument();
    });
  });

  describe('encerrar a cortesia', () => {
    it('só pede a confirmação, dizendo o que acontece', async () => {
      mostrar(detalhes(assinatura('courtesy'), acesso('allowed', 'courtesy')));
      renderizar();
      await userEvent.click(screen.getByRole('button', { name: 'Encerrar cortesia' }));

      expect(screen.getByText(/a cortesia termina agora e a barbearia fica bloqueada/i)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Confirmar: encerrar cortesia' }));

      expect(executar).toHaveBeenCalledWith('tenant-1', { tipo: 'encerrarCortesia' });
    });
  });

  describe('desbloquear', () => {
    beforeEach(() => mostrar(detalhes(assinatura('blocked', { motivoDoBloqueio: 'refunded' }), acesso('blocked', 'refunded'))));

    it('pede o dia e o motivo, e só confirma com os dois', async () => {
      renderizar();
      await userEvent.click(screen.getByRole('button', { name: 'Desbloquear' }));
      const confirmar = screen.getByRole('button', { name: 'Confirmar: desbloquear' });
      expect(confirmar).toBeDisabled();

      fireEvent.change(screen.getByLabelText(/liberar até/i), { target: { value: '2040-03-10' } });
      expect(confirmar).toBeDisabled();

      await userEvent.type(screen.getByLabelText(/motivo/i), '  pagamento em análise  ');
      expect(confirmar).toBeEnabled();
      await userEvent.click(confirmar);

      expect(executar).toHaveBeenCalledWith('tenant-1', { tipo: 'desbloquear', ate: '2040-03-10', motivo: 'pagamento em análise' });
    });

    it('um motivo só de espaços não conta', async () => {
      renderizar();
      await userEvent.click(screen.getByRole('button', { name: 'Desbloquear' }));
      fireEvent.change(screen.getByLabelText(/liberar até/i), { target: { value: '2040-03-10' } });
      await userEvent.type(screen.getByLabelText(/motivo/i), '    ');

      expect(screen.getByRole('button', { name: 'Confirmar: desbloquear' })).toBeDisabled();
    });

    it('diz que não altera o Mercado Pago e que depois o bloqueio de antes volta', async () => {
      renderizar();
      await userEvent.click(screen.getByRole('button', { name: 'Desbloquear' }));

      expect(screen.getByText(/não altera nada no mercado pago/i)).toBeInTheDocument();
      expect(screen.getByText(/o bloqueio de antes volta a valer/i)).toBeInTheDocument();
    });
  });

  describe('bloquear', () => {
    beforeEach(() => mostrar(detalhes(assinatura('active'), acesso('allowed', 'active'))));

    it('pede o motivo, avisa o que acontece e confirma', async () => {
      renderizar();
      await userEvent.click(screen.getByRole('button', { name: 'Bloquear' }));

      expect(screen.getByText(/o acesso fecha na hora/i)).toBeInTheDocument();
      expect(screen.getByText(/um pagamento aprovado depois reativa a barbearia/i)).toBeInTheDocument();
      const confirmar = screen.getByRole('button', { name: 'Confirmar: bloquear' });
      expect(confirmar).toBeDisabled();

      await userEvent.type(screen.getByLabelText(/motivo/i), 'uso indevido');
      await userEvent.click(confirmar);

      expect(executar).toHaveBeenCalledWith('tenant-1', { tipo: 'bloquear', motivo: 'uso indevido' });
    });

    it('numa barbearia liberada à mão, diz que encerra o desbloqueio e que o bloqueio de antes volta', async () => {
      mostrar(detalhes(assinatura('blocked', { motivoDoBloqueio: 'refunded' }), acesso('warning', 'unblocked')));
      renderizar();
      await userEvent.click(screen.getByRole('button', { name: 'Bloquear' }));

      expect(screen.getByText(/o desbloqueio acaba agora/i)).toBeInTheDocument();
      expect(screen.getByText(/o bloqueio de antes volta a valer/i)).toBeInTheDocument();
      expect(screen.queryByText(/o acesso fecha na hora/i)).not.toBeInTheDocument();

      await userEvent.type(screen.getByLabelText(/motivo/i), 'o estorno foi contestado');
      await userEvent.click(screen.getByRole('button', { name: 'Confirmar: bloquear' }));
      expect(executar).toHaveBeenCalledWith('tenant-1', { tipo: 'bloquear', motivo: 'o estorno foi contestado' });
    });
  });

  it('abrir uma ação esquece o erro da anterior', async () => {
    mostrar(detalhes(assinatura('trialing'), acesso('allowed', 'trial')));
    renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Bloquear' }));

    expect(limparErro).toHaveBeenCalled();
  });
});
