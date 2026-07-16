import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CadastroAcesso } from '../CadastroAcesso';

const {
  mockAddToast,
  mockInvoke,
  mockNavigate,
  mockSupabaseClient,
  mockUpdate,
} = vi.hoisted(() => {
  const mockAddToast = vi.fn();
  const mockInvoke = vi.fn();
  const mockNavigate = vi.fn();
  const mockUpdate = vi.fn();

  return {
    mockAddToast,
    mockInvoke,
    mockNavigate,
    mockUpdate,
    mockSupabaseClient: {
      from: vi.fn(),
      functions: { invoke: mockInvoke },
    },
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useOutletContext: () => ({
    tenantId: 'tenant-1',
    tenantName: 'Barbearia Teste',
    logoUrl: null,
  }),
}));

vi.mock('../../../components/Toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

const createUpdateBuilder = () => {
  const builder: any = {
    eq: vi.fn(() => builder),
    then: vi.fn((onFulfilled) =>
      Promise.resolve(onFulfilled({ data: null, error: null }))),
  };
  return builder;
};

describe('CadastroAcesso', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const selectBuilder: any = {
      eq: vi.fn(() => selectBuilder),
      is: vi.fn(() => selectBuilder),
      order: vi.fn().mockResolvedValue({
        data: [{ id: 'prof-1', name: 'Carlos', phone: '5592999999999', user_id: null }],
        error: null,
      }),
    };

    mockUpdate.mockImplementation(() => createUpdateBuilder());
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn(() => selectBuilder),
      update: mockUpdate,
    });
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error('Edge Function indisponivel'),
    });
  });

  it('falha sem vincular usuario ficticio quando a Edge Function rejeita a criacao', async () => {
    render(<CadastroAcesso />);

    await screen.findByRole('option', { name: /Carlos/ });
    fireEvent.change(screen.getByLabelText('1. Selecione o Barbeiro'), {
      target: { value: 'prof-1' },
    });
    fireEvent.change(screen.getByLabelText('2. E-mail de Login'), {
      target: { value: 'carlos@example.com' },
    });
    fireEvent.change(screen.getByLabelText('3. Senha de acesso'), {
      target: { value: 'segredo123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e Criar Acesso' }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(expect.any(String), 'error');
    });

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalledWith('/profissionais');
    expect(mockAddToast).not.toHaveBeenCalledWith(expect.any(String), 'success');
  });
});
