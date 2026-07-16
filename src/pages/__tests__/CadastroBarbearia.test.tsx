import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CadastroBarbearia } from '../CadastroBarbearia';

const { mockAddToast, mockNavigate, mockFrom, mockSignUp } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockNavigate: vi.fn(),
  mockFrom: vi.fn(),
  mockSignUp: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../components/Toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: mockSignUp,
    },
    from: mockFrom,
  },
}));

describe('CadastroBarbearia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignUp.mockResolvedValue({
      data: { session: { access_token: 'token' } },
      error: null,
    });
  });

  it('cria o usuario sem metadados de autoridade e finaliza o tenant no servidor', async () => {
    render(<CadastroBarbearia />);

    fireEvent.change(screen.getByPlaceholderText('Ex: Barbearia Estilo'), { target: { value: 'Barbearia Segura' } });
    fireEvent.change(screen.getByPlaceholderText('comercial@suabarbearia.com'), { target: { value: 'contato@segura.test' } });
    fireEvent.change(screen.getByPlaceholderText('(99) 99999-9999'), { target: { value: '92999999999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Gestor Seguro' } });
    fireEvent.change(screen.getByPlaceholderText('seu.login@email.com'), { target: { value: 'gestor@segura.test' } });
    fireEvent.change(screen.getByPlaceholderText('Mínimo 6 caracteres'), { target: { value: 'SenhaForte123!' } });
    const submitButton = screen.getByRole('button', { name: 'Criar conta' });
    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'gestor@segura.test',
        password: 'SenhaForte123!',
        options: {
          data: {
            name: 'Gestor Seguro',
            tenant_signup: {
              name: 'Barbearia Segura',
              email: 'contato@segura.test',
              phone: '92999999999',
              plan: 'prata',
            },
          },
        },
      });
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });
});
