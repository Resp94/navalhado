import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Login } from '../Login';

const { mockAddToast, mockNavigate, mockSignIn, mockSignOut, mockSingle, mockResend } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockNavigate: vi.fn(),
  mockSignIn: vi.fn(),
  mockSignOut: vi.fn(),
  mockSingle: vi.fn(),
  mockResend: vi.fn(),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('../../components/Toast', () => ({ useToast: () => ({ addToast: mockAddToast }) }));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignIn,
      signOut: mockSignOut,
      resetPasswordForEmail: vi.fn(),
      resend: mockResend,
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

  it('recusa e-mail com TLD de 1 letra (regra mais rígida da spec 047) e mantém "Acessar" desabilitado', async () => {
    render(<Login />);
    fireEvent.change(screen.getByPlaceholderText('seu@email.com'), { target: { value: 'admin@navalhado.x' } });
    fireEvent.change(screen.getByPlaceholderText('Digite sua senha'), { target: { value: 'senha-segura' } });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Acessar' })).toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Acessar' }));
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('mostra "Reenviar link" quando o e-mail não está confirmado e reenvia ao clicar (spec 047, ticket 10)', async () => {
    mockSignIn.mockResolvedValue({ data: { user: null }, error: { message: 'Email not confirmed' } });
    mockResend.mockResolvedValue({ data: {}, error: null });

    render(<Login />);
    fireEvent.change(screen.getByPlaceholderText('seu@email.com'), { target: { value: 'barbeiro@navalhado.com' } });
    fireEvent.change(screen.getByPlaceholderText('Digite sua senha'), { target: { value: 'senha-segura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Acessar' }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Confirme seu e-mail antes de fazer login.', 'error');
    });

    const btnReenviar = screen.getByRole('button', { name: 'Reenviar link' });
    fireEvent.click(btnReenviar);

    await waitFor(() => {
      expect(mockResend).toHaveBeenCalledWith({ type: 'signup', email: 'barbeiro@navalhado.com' });
      expect(mockAddToast).toHaveBeenCalledWith('Link de confirmação reenviado. Confira seu e-mail.', 'success');
    });
  });

  it('não mostra "Reenviar link" quando o login falha por outro motivo', async () => {
    mockSignIn.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid login credentials' } });

    render(<Login />);
    fireEvent.change(screen.getByPlaceholderText('seu@email.com'), { target: { value: 'barbeiro@navalhado.com' } });
    fireEvent.change(screen.getByPlaceholderText('Digite sua senha'), { target: { value: 'senha-errada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Acessar' }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('E-mail ou senha incorretos. Tente novamente.', 'error');
    });
    expect(screen.queryByRole('button', { name: 'Reenviar link' })).toBeNull();
  });
});
