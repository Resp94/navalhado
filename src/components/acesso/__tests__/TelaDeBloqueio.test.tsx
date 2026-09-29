import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAssinar } = vi.hoisted(() => ({ mockAssinar: vi.fn() }));

vi.mock('../../../modules/assinatura/repositorio', () => ({
  assinaturaRepository: { assinar: (...args: unknown[]) => mockAssinar(...args) },
}));

import { TelaDeBloqueio } from '../TelaDeBloqueio';

describe('TelaDeBloqueio', () => {
  beforeEach(() => {
    mockAssinar.mockReset();
  });

  it('mostra o motivo do bloqueio como título', () => {
    render(<TelaDeBloqueio motivo="trial_expired" perfil="gerente" tenantName="Barbearia Alpha" onLogout={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Seu período de teste terminou' })).toBeInTheDocument();
    expect(screen.getByText('Barbearia Alpha')).toBeInTheDocument();
  });

  describe('Gerente', () => {
    // Spec 052, ticket 05: o Pagar cria a assinatura e abre a página do Mercado Pago.
    it('vê o botão Pagar, que abre o link de pagamento do Mercado Pago', async () => {
      const link = 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=pre-1';
      mockAssinar.mockResolvedValue({ linkDePagamento: link, assinaturaId: 'pre-1', primeiraCobrancaEm: null });
      const abrirLink = vi.fn();
      render(<TelaDeBloqueio motivo="trial_expired" perfil="gerente" tenantName="Alpha" onLogout={vi.fn()} abrirLink={abrirLink} />);

      const pagar = screen.getByRole('button', { name: 'Pagar' });
      expect(pagar).toBeEnabled();
      await userEvent.click(pagar);

      await waitFor(() => expect(abrirLink).toHaveBeenCalledWith(link));
    });

    it('depois de voltar do Mercado Pago, avisa que o pagamento está sendo confirmado e deixa atualizar', async () => {
      const onAtualizar = vi.fn();
      render(
        <TelaDeBloqueio
          motivo="trial_expired"
          perfil="gerente"
          tenantName="Alpha"
          onLogout={vi.fn()}
          aguardandoConfirmacao
          onAtualizar={onAtualizar}
        />,
      );

      expect(screen.getByRole('status')).toHaveTextContent(/confirmando seu pagamento/i);
      await userEvent.click(screen.getByRole('button', { name: 'Atualizar situação' }));

      expect(onAtualizar).toHaveBeenCalledTimes(1);
    });

    it('sem ter voltado do Mercado Pago, não mostra o aviso de confirmação', () => {
      render(<TelaDeBloqueio motivo="trial_expired" perfil="gerente" tenantName="Alpha" onLogout={vi.fn()} />);

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('recebe o convite para assinar e a garantia de que os dados ficam guardados', () => {
      render(<TelaDeBloqueio motivo="trial_expired" perfil="gerente" tenantName="Alpha" onLogout={vi.fn()} />);

      expect(screen.getByText(/assine um plano/i)).toBeInTheDocument();
      expect(screen.getByText(/dados da sua barbearia continuam guardados/i)).toBeInTheDocument();
    });

    it('com pagamento recusado, a orientação é atualizar o cartão, não assinar de novo', () => {
      render(<TelaDeBloqueio motivo="payment_failed" perfil="gerente" tenantName="Alpha" onLogout={vi.fn()} />);

      expect(screen.getByText(/atualize o cartão/i)).toBeInTheDocument();
      expect(screen.queryByText(/assine um plano/i)).not.toBeInTheDocument();
    });
  });

  describe('Barbeiro', () => {
    it('recebe só a explicação, sem botão de pagar', () => {
      render(<TelaDeBloqueio motivo="trial_expired" perfil="barbeiro" tenantName="Alpha" onLogout={vi.fn()} />);

      expect(screen.getByText(/fale com o gerente/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Pagar' })).not.toBeInTheDocument();
    });

    it('nunca vê o aviso de confirmação de pagamento', () => {
      render(
        <TelaDeBloqueio motivo="trial_expired" perfil="barbeiro" tenantName="Alpha" onLogout={vi.fn()} aguardandoConfirmacao />,
      );

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  it('o usuário bloqueado consegue sair da conta', async () => {
    const onLogout = vi.fn();
    render(<TelaDeBloqueio motivo="blocked" perfil="barbeiro" tenantName="Alpha" onLogout={onLogout} />);

    await userEvent.click(screen.getByRole('button', { name: 'Sair da conta' }));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
