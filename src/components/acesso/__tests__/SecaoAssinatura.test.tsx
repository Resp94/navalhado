import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cobranca, DetalhesDaAssinatura } from '../../../modules/assinatura/types';

const { mockAssinar, mockUseMinhaAssinatura } = vi.hoisted(() => ({
  mockAssinar: vi.fn(),
  mockUseMinhaAssinatura: vi.fn(),
}));

vi.mock('../../../modules/assinatura/repositorio', () => ({
  assinaturaRepository: { assinar: (...args: unknown[]) => mockAssinar(...args) },
}));

vi.mock('../../../modules/assinatura/useMinhaAssinatura', () => ({
  useMinhaAssinatura: (...args: unknown[]) => mockUseMinhaAssinatura(...args),
}));

import { INTERVALO_DA_CONFIRMACAO_MS } from '../../../modules/assinatura/useRetornoDoPagamento';

// O fluxo de trocar o cartão (botão, formulário, aviso) tem teste próprio (TrocarCartao.test); aqui só
// interessa quando a seção o oferece e com que informação.
vi.mock('../TrocarCartao', () => ({
  TrocarCartao: ({ cobrancaPendente, acessoBloqueado, onTrocado }: {
    cobrancaPendente?: boolean;
    acessoBloqueado?: boolean;
    onTrocado?: () => void;
  }) => (
    <div data-testid="trocar-cartao">
      <span>{cobrancaPendente ? 'com pendência' : 'sem pendência'}</span>
      <span>{acessoBloqueado ? 'acesso bloqueado' : 'acesso liberado'}</span>
      <button onClick={onTrocado}>simular cartão trocado</button>
    </div>
  ),
}));

// O fluxo de mudar de plano (lista, cotação, pagamento) tem teste próprio (MudarDePlano.test); aqui só
// interessa quando a seção o oferece e com que informação.
vi.mock('../MudarDePlano', () => ({
  MudarDePlano: ({ assinatura, onTrocado }: {
    assinatura: { situacao: string; plano: { id: string; nome: string } };
    onTrocado?: () => void;
  }) => (
    <div data-testid="mudar-de-plano">
      <span>{`plano ${assinatura.plano.nome} (${assinatura.plano.id}) ${assinatura.situacao}`}</span>
      <button onClick={onTrocado}>simular plano trocado</button>
    </div>
  ),
}));

// A descida agendada (mostrar, desfazer, erro) tem teste próprio (DescidaAgendada.test); aqui só interessa quando a seção a mostra.
vi.mock('../DescidaAgendada', () => ({
  DescidaAgendada: ({ planoAgendado, dataDaMudanca, onDesfeita }: {
    planoAgendado: { nome: string };
    dataDaMudanca: Date;
    onDesfeita?: () => void;
  }) => (
    <div data-testid="descida-agendada">
      <span>{`para ${planoAgendado.nome} em ${dataDaMudanca.toISOString()}`}</span>
      <button onClick={onDesfeita}>simular descida desfeita</button>
    </div>
  ),
}));

import { SecaoAssinatura } from '../SecaoAssinatura';

// Spec 052, tickets 05 e 06: a tela Assinatura de Configurações mostra o plano, a situação, a
// próxima cobrança, o cartão e o histórico de cobranças, e oferece "Assinar" só sem assinatura ativa.

const recarregar = vi.fn();

const assinaturaBase: DetalhesDaAssinatura = {
  situacao: 'active',
  plano: { id: 'plano-tesoura', nome: 'Tesoura', preco: 59.9 },
  planoAgendado: null,
  testeAte: new Date('2026-10-14T23:00:00Z'),
  periodoAte: new Date('2026-10-29T23:26:22Z'),
  cortesiaAte: null,
  cartao: { bandeira: 'visa', final: '5682' },
};

const aprovada: Cobranca = {
  id: '1352660205',
  valor: 59.9,
  cobradaEm: new Date('2026-09-29T23:26:22Z'),
  situacao: 'approved',
  tipo: 'recurring',
  cartao: { bandeira: 'visa', final: '5682' },
};

interface Dados {
  assinatura?: Partial<DetalhesDaAssinatura> | null;
  cobrancas?: Cobranca[];
  diasRestantes?: number | null;
  status?: 'loading' | 'ready' | 'error';
  historicoIndisponivel?: boolean;
}

const comDados = ({
  assinatura = {},
  cobrancas = [],
  diasRestantes = null,
  status = 'ready',
  historicoIndisponivel = false,
}: Dados = {}) =>
  mockUseMinhaAssinatura.mockReturnValue({
    assinatura: assinatura === null ? null : { ...assinaturaBase, ...assinatura },
    cobrancas,
    diasRestantes,
    status,
    historicoIndisponivel,
    recarregar,
  });

const renderizar = (search = '', abrirLink = vi.fn(), timezone?: string) => {
  render(<SecaoAssinatura tenantId="tenant-a" timezone={timezone} search={search} abrirLink={abrirLink} />);
  return { abrirLink };
};

describe('SecaoAssinatura', () => {
  beforeEach(() => {
    // A próxima cobrança só aparece se estiver no futuro: o relógio fica fixo (o resto do tempo, real).
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
    mockAssinar.mockReset();
    mockUseMinhaAssinatura.mockReset();
    recarregar.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lê a assinatura da própria barbearia', () => {
    comDados();
    renderizar();

    expect(mockUseMinhaAssinatura).toHaveBeenCalledWith('tenant-a');
  });

  describe('o que a tela mostra', () => {
    it('ativa: plano e preço, situação, próxima cobrança e final do cartão', () => {
      comDados();
      renderizar();

      expect(screen.getByRole('heading', { name: 'Assinatura' })).toBeInTheDocument();
      expect(screen.getByText('Tesoura, R$ 59,90 por mês')).toBeInTheDocument();
      expect(screen.getByText('Ativa')).toBeInTheDocument();
      expect(screen.getByText('R$ 59,90 em 29/10/2026')).toBeInTheDocument();
      expect(screen.getByText('Visa final 5682')).toBeInTheDocument();
    });

    it('em teste: a data do fim, os dias que restam e o Assinar; a primeira cobrança só depois do teste', () => {
      comDados({
        assinatura: { situacao: 'trialing', periodoAte: null, cartao: null },
        diasRestantes: 10,
      });
      renderizar();

      expect(screen.getByText('Em teste até 14/10 (restam 10 dias)')).toBeInTheDocument();
      expect(screen.getByText(/primeira cobrança só acontece no fim do teste/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Assinar' })).toBeEnabled();
      expect(screen.queryByText(/próxima cobrança/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/final \d{4}/)).not.toBeInTheDocument();
    });

    // O cartão só é gravado quando a assinatura é autorizada no Mercado Pago: assinar de novo só
    // levaria a uma recusa 409, então o botão some e a primeira cobrança aparece no fim do teste.
    it('em teste com o cartão já autorizado: mostra a primeira cobrança no fim do teste e não oferece assinar', () => {
      comDados({
        assinatura: { situacao: 'trialing', periodoAte: null, cartao: { bandeira: 'visa', final: null } },
        diasRestantes: 10,
      });
      renderizar();

      expect(screen.getByText('R$ 59,90 em 14/10/2026')).toBeInTheDocument();
      expect(screen.getByText('Visa')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /assinar/i })).not.toBeInTheDocument();
    });

    it('ativa com o fim do período já vencido: não mostra próxima cobrança no passado', () => {
      comDados({ assinatura: { periodoAte: new Date('2026-09-29T23:00:00Z') } });
      renderizar();

      expect(screen.getByText('Ativa')).toBeInTheDocument();
      expect(screen.queryByText(/próxima cobrança/i)).not.toBeInTheDocument();
    });

    it('as datas seguem o fuso da barbearia', () => {
      // 03:30 UTC de 20/10: 00:30 do dia 20 em Brasília, 23:30 do dia 19 em Manaus.
      comDados({ assinatura: { situacao: 'canceled', periodoAte: new Date('2026-10-20T03:30:00Z') } });
      renderizar('', vi.fn(), 'America/Manaus');

      expect(screen.getByText('Cancelada até 19/10')).toBeInTheDocument();
    });

    it('no último dia do teste, fala em 1 dia (singular)', () => {
      comDados({ assinatura: { situacao: 'trialing', cartao: null }, diasRestantes: 1 });
      renderizar();

      expect(screen.getByText('Em teste até 14/10 (resta 1 dia)')).toBeInTheDocument();
    });

    it('pagamento recusado: avisa da cobrança pendente, sem oferecer uma nova assinatura', () => {
      comDados({ assinatura: { situacao: 'past_due' } });
      renderizar();

      expect(screen.getByText('Pagamento recusado')).toBeInTheDocument();
      expect(screen.getByText(/cobrança pendente/i)).toBeInTheDocument();
      expect(screen.queryByText(/próxima cobrança/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /assinar/i })).not.toBeInTheDocument();
    });

    it('cancelada: mostra até quando o acesso vale e deixa assinar de novo', () => {
      comDados({ assinatura: { situacao: 'canceled', periodoAte: new Date('2026-10-20T15:00:00Z') } });
      renderizar();

      expect(screen.getByText('Cancelada até 20/10')).toBeInTheDocument();
      expect(screen.queryByText(/próxima cobrança/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Assinar de novo' })).toBeEnabled();
    });

    it('cortesia: mostra a situação, sem cobrança e sem botão de assinar', () => {
      comDados({ assinatura: { situacao: 'courtesy', cartao: null, periodoAte: null } });
      renderizar();

      expect(screen.getByText('Cortesia')).toBeInTheDocument();
      expect(screen.getByText(/não há cobrança/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /assinar/i })).not.toBeInTheDocument();
    });

    it('bloqueada: deixa assinar', () => {
      comDados({ assinatura: { situacao: 'blocked' } });
      renderizar();

      expect(screen.getByText('Bloqueada')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Assinar' })).toBeEnabled();
    });

    it('mostra o Assinar só quando não há assinatura ativa', () => {
      comDados({ assinatura: { situacao: 'active' } });
      renderizar();

      expect(screen.queryByRole('button', { name: /assinar/i })).not.toBeInTheDocument();
    });

    it('barbearia sem assinatura: diz que não há assinatura', () => {
      comDados({ assinatura: null });
      renderizar();

      expect(screen.getByText(/sem assinatura/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /assinar/i })).not.toBeInTheDocument();
    });
  });

  // Spec 052, ticket 09: trocar o cartão pela tela Assinatura.
  describe('trocar cartão', () => {
    it.each([
      ['ativa', { situacao: 'active' as const }],
      ['com pagamento recusado', { situacao: 'past_due' as const }],
      ['em teste com o cartão já autorizado', { situacao: 'trialing' as const, cartao: { bandeira: 'visa', final: null } }],
    ])('oferece a troca do cartão na assinatura %s', (_nome, assinatura) => {
      comDados({ assinatura, diasRestantes: 10 });
      renderizar();

      expect(screen.getByTestId('trocar-cartao')).toBeInTheDocument();
    });

    it.each([
      ['em teste sem cartão autorizado', { situacao: 'trialing' as const, cartao: null }],
      ['cancelada', { situacao: 'canceled' as const }],
      ['em cortesia', { situacao: 'courtesy' as const, cartao: null }],
      ['bloqueada', { situacao: 'blocked' as const }],
    ])('não oferece a troca do cartão na assinatura %s (não há cobrança no cartão)', (_nome, assinatura) => {
      comDados({ assinatura, diasRestantes: 10 });
      renderizar();

      expect(screen.queryByTestId('trocar-cartao')).not.toBeInTheDocument();
    });

    it('sem pagamento recusado, a troca não fala de cobrança pendente; a seção nunca está bloqueada', () => {
      comDados();
      renderizar();

      expect(screen.getByTestId('trocar-cartao')).toHaveTextContent('sem pendência');
      expect(screen.getByTestId('trocar-cartao')).toHaveTextContent('acesso liberado');
    });

    it('com o pagamento recusado, a troca sabe que há cobrança pendente (e o acesso ainda está liberado)', () => {
      comDados({ assinatura: { situacao: 'past_due' } });
      renderizar();

      expect(screen.getByTestId('trocar-cartao')).toHaveTextContent('com pendência');
      expect(screen.getByTestId('trocar-cartao')).toHaveTextContent('acesso liberado');
    });

    it('depois de trocar o cartão, relê a assinatura para mostrar o final novo', async () => {
      comDados();
      renderizar();

      await userEvent.click(screen.getByRole('button', { name: 'simular cartão trocado' }));

      expect(recarregar).toHaveBeenCalledTimes(1);
    });
  });

  // Spec 052, ticket 10: mudar de plano pela tela Assinatura.
  describe('mudar de plano', () => {
    it.each([
      ['ativa', { situacao: 'active' as const }],
      ['em teste (com ou sem o cartão autorizado)', { situacao: 'trialing' as const, cartao: null }],
    ])('oferece a troca de plano na assinatura %s', (_nome, assinatura) => {
      comDados({ assinatura, diasRestantes: 10 });
      renderizar();

      expect(screen.getByTestId('mudar-de-plano')).toBeInTheDocument();
    });

    it.each([
      ['com pagamento recusado', { situacao: 'past_due' as const }],
      ['cancelada', { situacao: 'canceled' as const }],
      ['em cortesia', { situacao: 'courtesy' as const, cartao: null }],
      ['bloqueada', { situacao: 'blocked' as const }],
    ])('não oferece a troca de plano na assinatura %s', (_nome, assinatura) => {
      comDados({ assinatura, diasRestantes: 10 });
      renderizar();

      expect(screen.queryByTestId('mudar-de-plano')).not.toBeInTheDocument();
    });

    it('passa o plano e a situação da assinatura: o que se oferece depende deles', () => {
      comDados();
      renderizar();

      expect(screen.getByTestId('mudar-de-plano')).toHaveTextContent('plano Tesoura (plano-tesoura) active');
    });

    it('depois de trocar de plano, relê a assinatura para mostrar o plano, o valor e o período novos', async () => {
      comDados();
      renderizar();

      await userEvent.click(screen.getByRole('button', { name: 'simular plano trocado' }));

      expect(recarregar).toHaveBeenCalledTimes(1);
    });
  });

  describe('descida de plano agendada', () => {
    const descendo: Partial<DetalhesDaAssinatura> = {
      plano: { id: 'plano-maquina', nome: 'Máquina', preco: 89.9 },
      planoAgendado: { id: 'plano-tesoura', nome: 'Tesoura', preco: 59.9 },
    };

    it('mostra a descida agendada, com o plano menor e o fim do período pago como data', () => {
      comDados({ assinatura: descendo });
      renderizar();

      expect(screen.getByTestId('descida-agendada')).toHaveTextContent('para Tesoura em 2026-10-29T23:26:22.000Z');
    });

    it('sem descida agendada não mostra nada', () => {
      comDados();
      renderizar();

      expect(screen.queryByTestId('descida-agendada')).not.toBeInTheDocument();
    });

    it('sem o fim do período pago não há data para mostrar', () => {
      comDados({ assinatura: { ...descendo, periodoAte: null } });
      renderizar();

      expect(screen.queryByTestId('descida-agendada')).not.toBeInTheDocument();
    });

    it('depois de desfazer, relê a assinatura para o aviso sumir e o plano atual seguir', async () => {
      comDados({ assinatura: descendo });
      renderizar();

      await userEvent.click(screen.getByRole('button', { name: 'simular descida desfeita' }));

      expect(recarregar).toHaveBeenCalledTimes(1);
    });

    it('a próxima cobrança já é a do plano menor, que é o valor que o Mercado Pago vai cobrar', () => {
      comDados({ assinatura: descendo });
      renderizar();

      const termo = screen.getByText('Próxima cobrança');
      expect(termo.nextElementSibling).toHaveTextContent(/R\$\s59,90 em 29\/10\/2026/);
    });
  });

  describe('histórico de cobranças', () => {
    it('mostra valor, data, situação, tipo e final do cartão de cada cobrança', () => {
      comDados({
        cobrancas: [
          {
            id: 'c2',
            valor: 30,
            cobradaEm: new Date('2026-10-05T15:00:00Z'),
            situacao: 'rejected',
            tipo: 'upgrade',
            cartao: null,
          },
          aprovada,
        ],
      });
      renderizar();

      const tabela = screen.getByRole('table', { name: /histórico de cobranças/i });
      const linhas = within(tabela).getAllByRole('row');
      // Cabeçalho + duas cobranças, da mais recente para a mais antiga.
      expect(linhas).toHaveLength(3);
      expect(within(linhas[1]).getByText('05/10/2026')).toBeInTheDocument();
      expect(within(linhas[1]).getByText('Diferença de plano')).toBeInTheDocument();
      expect(within(linhas[1]).getByText('R$ 30,00')).toBeInTheDocument();
      expect(within(linhas[1]).getByText('Recusada')).toBeInTheDocument();
      expect(within(linhas[1]).getByText('—')).toBeInTheDocument();
      expect(within(linhas[2]).getByText('29/09/2026')).toBeInTheDocument();
      expect(within(linhas[2]).getByText('Mensalidade')).toBeInTheDocument();
      expect(within(linhas[2]).getByText('R$ 59,90')).toBeInTheDocument();
      expect(within(linhas[2]).getByText('Paga')).toBeInTheDocument();
      expect(within(linhas[2]).getByText('Visa final 5682')).toBeInTheDocument();
    });

    it('sem cobranças: avisa que ainda não há nenhuma', () => {
      comDados({ cobrancas: [] });
      renderizar();

      expect(screen.getByText(/nenhuma cobrança até agora/i)).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('histórico que não carregou: avisa e deixa tentar de novo, sem esconder a assinatura', async () => {
      comDados({ historicoIndisponivel: true });
      renderizar();

      expect(screen.getByText('Ativa')).toBeInTheDocument();
      expect(screen.getByText(/não foi possível carregar o histórico/i)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

      expect(recarregar).toHaveBeenCalledTimes(1);
    });
  });

  describe('carregamento', () => {
    it('enquanto carrega, não mostra nada', () => {
      comDados({ status: 'loading', assinatura: null });
      renderizar();

      expect(screen.queryByRole('heading', { name: 'Assinatura' })).not.toBeInTheDocument();
    });

    it('se a assinatura não carrega, avisa e deixa tentar de novo', async () => {
      comDados({ status: 'error', assinatura: null });
      renderizar();

      expect(screen.getByRole('heading', { name: 'Assinatura' })).toBeInTheDocument();
      expect(screen.getByText(/não foi possível carregar a assinatura/i)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

      expect(recarregar).toHaveBeenCalledTimes(1);
    });
  });

  describe('assinar', () => {
    it('o Assinar abre o link do Mercado Pago', async () => {
      const link = 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=pre-1';
      mockAssinar.mockResolvedValue({ linkDePagamento: link, assinaturaId: 'pre-1', primeiraCobrancaEm: null });
      comDados({ assinatura: { situacao: 'trialing', cartao: null }, diasRestantes: 10 });
      const { abrirLink } = renderizar();

      await userEvent.click(screen.getByRole('button', { name: 'Assinar' }));

      await waitFor(() => expect(abrirLink).toHaveBeenCalledWith(link));
    });
  });

  describe('voltando do Mercado Pago', () => {
    it('avisa que a confirmação está em andamento e deixa atualizar', async () => {
      comDados({ assinatura: { situacao: 'trialing', cartao: null }, diasRestantes: 10 });
      renderizar('?assinatura=retorno');

      expect(screen.getByRole('status')).toHaveTextContent(/confirmando sua assinatura/i);
      await userEvent.click(screen.getByRole('button', { name: 'Atualizar situação' }));

      expect(recarregar).toHaveBeenCalledTimes(1);
    });

    // Visto no roteiro manual: depois que o webhook ativa a barbearia, o aviso não pode continuar
    // dizendo que está confirmando.
    it('com o cartão autorizado em teste: diz que a assinatura foi autorizada, sem botão de atualizar', () => {
      comDados({
        assinatura: { situacao: 'trialing', periodoAte: null, cartao: { bandeira: 'visa', final: null } },
        diasRestantes: 10,
      });
      renderizar('?assinatura=retorno');

      expect(screen.getByRole('status')).toHaveTextContent(/assinatura autorizada no mercado pago/i);
      expect(screen.queryByText(/confirmando sua assinatura/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Atualizar situação' })).not.toBeInTheDocument();
    });

    it('enquanto o pagamento não aparece, relê a assinatura sozinha a cada intervalo', () => {
      vi.useFakeTimers();
      comDados({ assinatura: { situacao: 'trialing', cartao: null }, diasRestantes: 10 });
      renderizar('?assinatura=retorno');

      expect(recarregar).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(INTERVALO_DA_CONFIRMACAO_MS * 2);
      });

      expect(recarregar).toHaveBeenCalledTimes(2);
    });

    it('com o pagamento já confirmado, não fica relendo', () => {
      vi.useFakeTimers();
      comDados();
      renderizar('?assinatura=retorno');

      act(() => {
        vi.advanceTimersByTime(INTERVALO_DA_CONFIRMACAO_MS * 3);
      });

      expect(recarregar).not.toHaveBeenCalled();
    });

    it('sem voltar do Mercado Pago, não fica relendo', () => {
      vi.useFakeTimers();
      comDados({ assinatura: { situacao: 'trialing', cartao: null }, diasRestantes: 10 });
      renderizar();

      act(() => {
        vi.advanceTimersByTime(INTERVALO_DA_CONFIRMACAO_MS * 3);
      });

      expect(recarregar).not.toHaveBeenCalled();
    });

    it('com a assinatura já ativa: confirma o pagamento em vez de dizer que está confirmando', () => {
      comDados();
      renderizar('?assinatura=retorno');

      expect(screen.getByRole('status')).toHaveTextContent(/pagamento confirmado/i);
      expect(screen.queryByText(/confirmando sua assinatura/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Atualizar situação' })).not.toBeInTheDocument();
    });

    it('sem voltar do Mercado Pago, não mostra o aviso de confirmação', () => {
      comDados({ assinatura: { situacao: 'trialing', cartao: null }, diasRestantes: 10 });
      renderizar();

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });
});
