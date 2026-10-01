import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
};

const renderizar = (assinatura: Partial<DetalhesDaAssinatura> = {}, timezone?: string) => {
  const onCancelada = vi.fn();
  render(<CancelarAssinatura assinatura={{ ...assinaturaAtiva, ...assinatura }} timezone={timezone} onCancelada={onCancelada} />);
  return { onCancelada };
};

const abrir = () => userEvent.click(screen.getByRole('button', { name: 'Cancelar assinatura' }));
const dialogo = () => screen.getByRole('dialog', { name: 'Cancelar a assinatura?' });
const confirmar = () => userEvent.click(within(dialogo()).getByRole('button', { name: 'Cancelar assinatura' }));

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

    it('"Manter assinatura" fecha a pergunta sem cancelar nada', async () => {
      renderizar();
      await abrir();

      await userEvent.click(within(dialogo()).getByRole('button', { name: 'Manter assinatura' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(mockCancelar).not.toHaveBeenCalled();
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

      expect(within(dialogo()).getByRole('button', { name: 'Cancelar assinatura' })).toBeDisabled();
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
      expect(within(dialogo()).getByRole('button', { name: 'Cancelar assinatura' })).toBeEnabled();
      expect(onCancelada).not.toHaveBeenCalled();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
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
