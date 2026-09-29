import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TelaDeBloqueio } from '../TelaDeBloqueio';

describe('TelaDeBloqueio', () => {
  it('mostra o motivo do bloqueio como título', () => {
    render(<TelaDeBloqueio motivo="trial_expired" perfil="gerente" tenantName="Barbearia Alpha" onLogout={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Seu período de teste terminou' })).toBeInTheDocument();
    expect(screen.getByText('Barbearia Alpha')).toBeInTheDocument();
  });

  describe('Gerente', () => {
    it('vê o lugar reservado para Pagar, ainda desativado', () => {
      render(<TelaDeBloqueio motivo="trial_expired" perfil="gerente" tenantName="Alpha" onLogout={vi.fn()} />);

      const pagar = screen.getByRole('button', { name: 'Pagar' });
      expect(pagar).toBeDisabled();
      expect(screen.getByText(/pagamento estará disponível em breve/i)).toBeInTheDocument();
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
  });

  it('o usuário bloqueado consegue sair da conta', async () => {
    const onLogout = vi.fn();
    render(<TelaDeBloqueio motivo="blocked" perfil="barbeiro" tenantName="Alpha" onLogout={onLogout} />);

    await userEvent.click(screen.getByRole('button', { name: 'Sair da conta' }));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
