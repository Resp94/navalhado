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

const dnsResponse = (status: number, answers: { type: number; data: string }[] = []) => ({
  ok: true,
  json: async () => ({
    Status: status,
    Answer: answers.map((a) => ({ name: 'x', type: a.type, TTL: 300, data: a.data })),
  }),
});

describe('CadastroBarbearia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    mockSignUp.mockResolvedValue({
      data: { session: { access_token: 'token' } },
      error: null,
    });
    // Padrão: qualquer domínio consultado tem MX (spec 047, ticket 07). Testes
    // específicos de domínio/sugestão sobrescrevem este mock.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      dnsResponse(0, [{ type: 15, data: '10 mail.exemplo.' }]) as any
    );
  });

  it('cria o usuario sem metadados de autoridade e finaliza o tenant no servidor', async () => {
    render(<CadastroBarbearia />);

    fireEvent.change(screen.getByPlaceholderText('Ex: Barbearia Estilo'), { target: { value: 'Barbearia Segura' } });
    fireEvent.change(screen.getByPlaceholderText('comercial@suabarbearia.com'), { target: { value: 'contato@segura.test' } });
    fireEvent.change(screen.getByPlaceholderText('(99) 99999-9999'), { target: { value: '92999999999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    // nextStep agora aguarda a checagem de domínio (spec 047, ticket 07)
    // antes de avançar para a etapa 2.
    fireEvent.change(await screen.findByPlaceholderText('Seu nome'), { target: { value: 'Gestor Seguro' } });
    fireEvent.change(screen.getByPlaceholderText('seu.login@email.com'), { target: { value: 'gestor@segura.test' } });
    fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), { target: { value: 'SenhaForte123!' } });
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

  it('recusa e-mail comercial com TLD de 1 letra (regra mais rígida da spec 047) e mantém "Continuar" desabilitado', async () => {
    render(<CadastroBarbearia />);

    fireEvent.change(screen.getByPlaceholderText('Ex: Barbearia Estilo'), { target: { value: 'Barbearia Segura' } });
    fireEvent.change(screen.getByPlaceholderText('comercial@suabarbearia.com'), { target: { value: 'contato@segura.x' } });
    fireEvent.change(screen.getByPlaceholderText('(99) 99999-9999'), { target: { value: '92999999999' } });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('recusa avançar com e-mail comercial de domínio que não recebe e-mails (spec 047, ticket 07)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(dnsResponse(3) as any); // NXDOMAIN

    render(<CadastroBarbearia />);

    fireEvent.change(screen.getByPlaceholderText('Ex: Barbearia Estilo'), { target: { value: 'Barbearia Segura' } });
    fireEvent.change(screen.getByPlaceholderText('comercial@suabarbearia.com'), {
      target: { value: 'contato@dominio-inventado-cadastro.example' },
    });
    fireEvent.change(screen.getByPlaceholderText('(99) 99999-9999'), { target: { value: '92999999999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Corrija os erros antes de continuar.', 'warning');
    });
    expect(screen.getByPlaceholderText('Ex: Barbearia Estilo')).toBeInTheDocument(); // continua na etapa 1
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('sugere a correção do e-mail de acesso do gestor e aplica ao clicar (spec 047, ticket 07)', async () => {
    render(<CadastroBarbearia />);

    fireEvent.change(screen.getByPlaceholderText('Ex: Barbearia Estilo'), { target: { value: 'Barbearia Segura' } });
    fireEvent.change(screen.getByPlaceholderText('comercial@suabarbearia.com'), { target: { value: 'contato@segura.test' } });
    fireEvent.change(screen.getByPlaceholderText('(99) 99999-9999'), { target: { value: '92999999999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    const inputGestorEmail = await screen.findByPlaceholderText('seu.login@email.com') as HTMLInputElement;
    fireEvent.change(inputGestorEmail, { target: { value: 'gestor@gmial.com' } });

    const btnSugestao = await screen.findByRole('button', { name: /gestor@gmail\.com/i });
    fireEvent.click(btnSugestao);

    expect(inputGestorEmail.value).toBe('gestor@gmail.com');
  });
});
