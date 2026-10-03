import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../Toast';
import type { DetalhesDaAssinatura } from '../../../modules/assinatura/types';

const { mockCancelar } = vi.hoisted(() => ({ mockCancelar: vi.fn() }));

vi.mock('../../../modules/assinatura/repositorio', () => ({
  assinaturaRepository: { cancelarAssinatura: (...args: unknown[]) => mockCancelar(...args) },
}));

import { CancelarAssinatura } from '../CancelarAssinatura';

// Spec 052, ticket 12: o Gerente cancela a assinatura pela tela Assinatura. A cobrança para na hora e o acesso continua até o
// fim do período já pago; por isso a tela pede confirmação e diz até quando o acesso continua.

const assinaturaAtiva: DetalhesDaAssinatura = {
  situacao: 'active',
  plano: { id: 'plano-tesoura', nome: 'Tesoura', preco: 59.9 },
  planoAgendado: null,
  testeAte: new Date('2026-10-14T23:00:00Z'),
  periodoAte: new Date('2026-10-29T23:26:22Z'),
  cortesiaAte: null,
  cartao: { bandeira: 'visa', final: '5682' },
  assinaturaNovaAutorizada: false,
};

const renderizar = (assinatura: Partial<DetalhesDaAssinatura> = {}, timezone?: string) => {
  const onCancelada = vi.fn();
  render(
    <ToastProvider>
      <CancelarAssinatura assinatura={{ ...assinaturaAtiva, ...assinatura }} timezone={timezone} onCancelada={onCancelada} />
    </ToastProvider>,
  );
  return { onCancelada };
};

const abrir = () => userEvent.click(screen.getByRole('button', { name: 'Cancelar assinatura' }));
const dialogo = () => screen.getByRole('dialog', { name: 'Cancelar a assinatura?' });
const confirmar = () => userEvent.click(within(dialogo()).getByRole('button', { name: 'Sim, cancelar a assinatura' }));

describe('CancelarAssinatura', () => {
  beforeEach(() => {
    // O fim do acesso só vale se estiver no futuro: o relógio fica fixo (o resto do tempo, real).
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
    mockCancelar.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('começa só com o botão: nada é cancelado nem perguntado até o Gerente clicar', () => {
    renderizar();

    expect(screen.getByRole('button', { name: 'Cancelar assinatura' })).toBeEnabled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockCancelar).not.toHaveBeenCalled();
  });

  describe('a confirmação', () => {
    it('ativa: diz que a cobrança para, que não há reembolso e até quando o acesso continua', async () => {
      renderizar();

      await abrir();

      expect(dialogo()).toHaveTextContent('A cobrança da assinatura para agora.');
      expect(dialogo()).toHaveTextContent('O que você já pagou não é reembolsado.');
      expect(dialogo()).toHaveTextContent('Você continua usando o Navalhado até 29/10/2026.');
      expect(dialogo()).toHaveTextContent('Depois dessa data o acesso é bloqueado.');
    });

    it('diz que os dados continuam guardados e que dá para assinar de novo', async () => {
      renderizar();

      await abrir();

      expect(dialogo()).toHaveTextContent('Os dados da sua barbearia continuam guardados.');
      expect(dialogo()).toHaveTextContent('é só assinar de novo');
    });

    it('a data do fim do acesso segue o fuso da barbearia', async () => {
      // 02:30 UTC de 30/10 ainda é 29/10 em Brasília e já é 30/10 em Lisboa.
      renderizar({ periodoAte: new Date('2026-10-30T02:30:00Z') }, 'Europe/Lisbon');

      await abrir();

      expect(dialogo()).toHaveTextContent('até 30/10/2026');
    });

    // O caso comum do pagamento recusado: a recusa vem na renovação, quando o período pago já terminou. Cancelar bloqueia na hora,
    // e o Gerente tem de saber disso antes de confirmar.
    it('pagamento recusado com o período já vencido: diz que o acesso é bloqueado agora', async () => {
      renderizar({ situacao: 'past_due', periodoAte: new Date('2026-09-30T23:00:00Z') });

      await abrir();

      expect(dialogo()).toHaveTextContent('O período pago já acabou, então o acesso é bloqueado agora.');
      expect(dialogo()).not.toHaveTextContent('Você continua usando o Navalhado');
    });

    it('pagamento recusado com o período ainda por vencer: o acesso continua até o fim dele', async () => {
      renderizar({ situacao: 'past_due' });

      await abrir();

      expect(dialogo()).toHaveTextContent('Você continua usando o Navalhado até 29/10/2026.');
    });

    it('em teste com o cartão autorizado: nada será cobrado e o teste segue até o fim', async () => {
      renderizar({ situacao: 'trialing', periodoAte: null, cartao: { bandeira: 'visa', final: null } });

      await abrir();

      expect(dialogo()).toHaveTextContent('nada será cobrado no fim do teste');
      expect(dialogo()).toHaveTextContent('Você continua no período de teste até 14/10/2026.');
      expect(dialogo()).not.toHaveTextContent('reembolsado');
    });

    // Revisão: a cancelada que já assinou de novo (a assinatura nova está autorizada e cobra no fim do período pago).
    it('cancelada que já assinou de novo: cancela a assinatura nova, nada será cobrado no fim do período pago e o acesso vai até lá', async () => {
      renderizar({ situacao: 'canceled', assinaturaNovaAutorizada: true, cartao: { bandeira: 'master', final: null } });

      await abrir();

      expect(dialogo()).toHaveTextContent('A assinatura nova no Mercado Pago é cancelada e nada será cobrado no fim do período pago.');
      expect(dialogo()).toHaveTextContent('Você continua usando o Navalhado até 29/10/2026.');
      expect(dialogo()).not.toHaveTextContent('reembolsado');
    });

    // Revisão: a tela de bloqueio (estorno, contestação, pagamento recusado, bloqueio do Proprietário) deixa cancelar a
    // assinatura que o Mercado Pago ainda cobra. O acesso segue bloqueado: não há período a esperar.
    it('bloqueada (tela de bloqueio): cancela a assinatura que ainda cobra no Mercado Pago e o acesso segue bloqueado', async () => {
      renderizar({ situacao: 'blocked', periodoAte: null, testeAte: null, cartao: null });

      await abrir();

      expect(dialogo()).toHaveTextContent('A assinatura que ainda está ativa no Mercado Pago é cancelada e nada mais será cobrado.');
      expect(dialogo()).toHaveTextContent('O acesso da barbearia continua bloqueado.');
      expect(dialogo()).not.toHaveTextContent('Você continua usando o Navalhado');
      expect(dialogo()).not.toHaveTextContent('reembolsado');
    });

    it('o botão de confirmar tem nome diferente do que abre a pergunta: com a pergunta aberta só um se chama "Cancelar assinatura"', async () => {
      renderizar();

      await abrir();

      expect(screen.getAllByRole('button', { name: 'Cancelar assinatura' })).toHaveLength(1);
      expect(within(dialogo()).getByRole('button', { name: 'Sim, cancelar a assinatura' })).toBeEnabled();
    });

    it('"Manter assinatura" fecha a pergunta sem cancelar nada', async () => {
      renderizar();
      await abrir();

      await userEvent.click(within(dialogo()).getByRole('button', { name: 'Manter assinatura' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(mockCancelar).not.toHaveBeenCalled();
    });
  });

  // Spec 054, ticket 05: a confirmação do cancelamento é um toast que some sozinho (a faixa fixa do painel saiu). Timers falsos,
  // inclusive o setTimeout do toast. `shouldAdvanceTime` deixa o relógio falso andar com o real: o userEvent do Testing Library espera
  // um setTimeout(0) depois de cada ação e travaria sem isso. Por isso as margens de 1 s nas conferências do tempo.
  describe('a confirmação em toast', () => {
    const DURACAO_PADRAO_DO_TOAST_MS = 4000;
    const MARGEM_MS = 1000;

    beforeEach(() => {
      vi.useRealTimers();
      vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
      vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
    });

    const cancelarDeVerdade = async () => {
      mockCancelar.mockResolvedValue(undefined);
      const usuario = userEvent.setup({ delay: null });
      await usuario.click(screen.getByRole('button', { name: 'Cancelar assinatura' }));
      await usuario.click(within(dialogo()).getByRole('button', { name: 'Sim, cancelar a assinatura' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    };

    it('mostra "Assinatura cancelada. Acesso até DD/MM." com o fim do período pago', async () => {
      renderizar();

      await cancelarDeVerdade();

      expect(screen.getByText('Assinatura cancelada. Acesso até 29/10.')).toBeInTheDocument();
    });

    it('a data do toast segue o fuso da barbearia', async () => {
      // 02:30 UTC de 30/10 ainda é 29/10 em Brasília e já é 30/10 em Lisboa.
      renderizar({ periodoAte: new Date('2026-10-30T02:30:00Z') }, 'Europe/Lisbon');

      await cancelarDeVerdade();

      expect(screen.getByText('Assinatura cancelada. Acesso até 30/10.')).toBeInTheDocument();
    });

    it('em teste, a data é a do fim do teste', async () => {
      renderizar({ situacao: 'trialing', periodoAte: null });

      await cancelarDeVerdade();

      expect(screen.getByText('Assinatura cancelada. Acesso até 14/10.')).toBeInTheDocument();
    });

    it('sem data do fim do acesso (tela de bloqueio), o toast só confirma o cancelamento', async () => {
      renderizar({ situacao: 'blocked', periodoAte: null, testeAte: null, cartao: null });

      await cancelarDeVerdade();

      // A mensagem passageira no lugar do botão tem o mesmo texto: são duas, a do botão e a do toast.
      expect(screen.getAllByText('Assinatura cancelada.')).toHaveLength(2);
      expect(screen.queryByText(/Acesso até/)).not.toBeInTheDocument();
    });

    it('o toast some sozinho pela duração padrão (4 s), e a mensagem no lugar do botão continua', async () => {
      renderizar();
      const agendamentos = vi.spyOn(globalThis, 'setTimeout');
      await cancelarDeVerdade();
      expect(screen.getByText('Assinatura cancelada. Acesso até 29/10.')).toBeInTheDocument();
      expect(agendamentos).toHaveBeenCalledWith(expect.any(Function), DURACAO_PADRAO_DO_TOAST_MS);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(DURACAO_PADRAO_DO_TOAST_MS - MARGEM_MS);
      });
      expect(screen.getByText('Assinatura cancelada. Acesso até 29/10.')).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2 * MARGEM_MS);
      });
      expect(screen.queryByText('Assinatura cancelada. Acesso até 29/10.')).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Assinatura cancelada.');
      expect(screen.queryByRole('button', { name: 'Cancelar assinatura' })).not.toBeInTheDocument();
    });
  });

  describe('confirmar', () => {
    it('pede à função de cobrança, sem mandar barbearia nem assinatura, e avisa a tela', async () => {
      mockCancelar.mockResolvedValue(undefined);
      const { onCancelada } = renderizar();
      await abrir();

      await confirmar();

      await waitFor(() => expect(onCancelada).toHaveBeenCalledTimes(1));
      expect(mockCancelar).toHaveBeenCalledTimes(1);
      expect(mockCancelar).toHaveBeenCalledWith();
    });

    // Depois de cancelada a tela só relê a assinatura um instante depois. Com o botão de volta, um clique nessa janela pediria de
    // novo e levaria uma recusa ("já está cancelada") numa tela que está para mudar.
    it('depois de cancelar, a pergunta fecha e o botão some até a tela reler a assinatura', async () => {
      mockCancelar.mockResolvedValue(undefined);
      renderizar();
      await abrir();

      await confirmar();

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.queryByRole('button', { name: 'Cancelar assinatura' })).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Assinatura cancelada.');
      expect(mockCancelar).toHaveBeenCalledTimes(1);
    });

    it('enquanto cancela, os botões ficam desabilitados: um clique repetido não pede duas vezes', async () => {
      let concluir: () => void = () => {};
      mockCancelar.mockReturnValue(new Promise<void>((resolve) => (concluir = resolve)));
      renderizar();
      await abrir();

      await confirmar();

      expect(within(dialogo()).getByRole('button', { name: 'Sim, cancelar a assinatura' })).toBeDisabled();
      expect(within(dialogo()).getByRole('button', { name: 'Manter assinatura' })).toBeDisabled();
      await confirmar();
      expect(mockCancelar).toHaveBeenCalledTimes(1);
      await act(async () => concluir());
    });

    it('se a função recusou, mostra o motivo na pergunta, mantém tudo para tentar de novo e não avisa a tela', async () => {
      mockCancelar.mockRejectedValue(new Error('Não foi possível cancelar a assinatura agora. Tente de novo em instantes.'));
      const { onCancelada } = renderizar();
      await abrir();

      await confirmar();

      expect(await within(dialogo()).findByRole('alert')).toHaveTextContent('Não foi possível cancelar a assinatura agora.');
      expect(within(dialogo()).getByRole('button', { name: 'Sim, cancelar a assinatura' })).toBeEnabled();
      expect(onCancelada).not.toHaveBeenCalled();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByText(/Assinatura cancelada\./)).not.toBeInTheDocument();
    });

    it('tentar de novo depois de uma falha limpa o erro e cancela', async () => {
      mockCancelar.mockRejectedValueOnce(new Error('Não foi possível cancelar a assinatura agora.'));
      mockCancelar.mockResolvedValueOnce(undefined);
      const { onCancelada } = renderizar();
      await abrir();
      await confirmar();
      await within(dialogo()).findByRole('alert');

      await confirmar();

      await waitFor(() => expect(onCancelada).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('fechar depois de uma falha esquece o erro: a próxima pergunta abre limpa', async () => {
      mockCancelar.mockRejectedValue(new Error('Não foi possível cancelar a assinatura agora.'));
      renderizar();
      await abrir();
      await confirmar();
      await within(dialogo()).findByRole('alert');

      await userEvent.click(within(dialogo()).getByRole('button', { name: 'Manter assinatura' }));
      await abrir();

      expect(within(dialogo()).queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
