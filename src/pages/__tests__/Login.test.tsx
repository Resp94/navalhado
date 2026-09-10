import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Login } from '../Login';

const { mockAddToast, mockNavigate, mockSignIn, mockSignOut, mockSingle } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockNavigate: vi.fn(),
  mockSignIn: vi.fn(),
  mockSignOut: vi.fn(),
  mockSingle: vi.fn(),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('../../components/Toast', () => ({ useToast: () => ({ addToast: mockAddToast }) }));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignIn,
      signOut: mockSignOut,
      resetPasswordForEmail: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ single: mockSingle })),
      })),
    })),
  },
}));

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignIn.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'admin@navalhado.com' } },
      error: null,
    });
    mockSingle.mockResolvedValue({ data: null, error: { message: 'profile unavailable' } });
    mockSignOut.mockResolvedValue({ error: null });
  });

  it('encerra a sessao e nao infere privilegios quando o perfil falha', async () => {
    render(<Login />);
    fireEvent.change(screen.getByPlaceholderText('seu@email.com'), { target: { value: 'admin@navalhado.com' } });
    fireEvent.change(screen.getByPlaceholderText('Digite sua senha'), { target: { value: 'senha-segura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Acessar' }));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('renderiza os elementos da tela dividida replicada: logo oficial, títulos, campos e rodapé', () => {
    render(<Login />);
    expect(screen.getAllByRole('heading', { name: 'Navalhado' })[0]).toBeInTheDocument();
    expect(screen.getAllByAltText('Navalhado')[0]).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Acesse sua conta' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('seu@email.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Digite sua senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acessar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Esqueci a senha' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Termos de uso' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Privacidade (LGPD)' })).toBeInTheDocument();
  });
});
