import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FunctionsHttpError } from '@supabase/supabase-js';
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

const dnsResponse = (status: number, answers: { type: number; data: string }[] = []) => ({
  ok: true,
  json: async () => ({
    Status: status,
    Answer: answers.map((a) => ({ name: 'x', type: a.type, TTL: 300, data: a.data })),
  }),
});

describe('CadastroAcesso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Padrão: qualquer domínio consultado tem MX (spec 047, ticket 07). Testes
    // específicos de domínio/sugestão sobrescrevem este mock.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      dnsResponse(0, [{ type: 15, data: '10 mail.exemplo.' }]) as any
    );

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
    fireEvent.change(screen.getByLabelText(/Selecione o Barbeiro/i), {
      target: { value: 'prof-1' },
    });
    fireEvent.change(screen.getByLabelText(/E-mail de Login/i), {
      target: { value: 'carlos@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/Senha de acesso/i), {
      target: { value: 'segredo123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar e criar acesso/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(expect.any(String), 'error');
    });

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalledWith('/profissionais');
    expect(mockAddToast).not.toHaveBeenCalledWith(expect.any(String), 'success');
  });

  it('recusa e-mail com TLD de 1 letra (regra mais rígida da spec 047) sem chamar a Edge Function', async () => {
    render(<CadastroAcesso />);

    await screen.findByRole('option', { name: /Carlos/ });
    fireEvent.change(screen.getByLabelText(/Selecione o Barbeiro/i), {
      target: { value: 'prof-1' },
    });
    fireEvent.change(screen.getByLabelText(/E-mail de Login/i), {
      target: { value: 'carlos@x.c' },
    });
    fireEvent.change(screen.getByLabelText(/Senha de acesso/i), {
      target: { value: 'segredo123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar e criar acesso/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Informe um e-mail válido.', 'warning');
    });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('recusa domínio de e-mail que não recebe e-mails (spec 047, ticket 07) sem chamar a Edge Function', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(dnsResponse(3) as any); // NXDOMAIN
    render(<CadastroAcesso />);

    await screen.findByRole('option', { name: /Carlos/ });
    fireEvent.change(screen.getByLabelText(/Selecione o Barbeiro/i), { target: { value: 'prof-1' } });
    fireEvent.change(screen.getByLabelText(/E-mail de Login/i), {
      target: { value: 'carlos@dominio-inventado-acesso.example' },
    });
    fireEvent.change(screen.getByLabelText(/Senha de acesso/i), { target: { value: 'segredo123' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar e criar acesso/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Este domínio não recebe e-mails.', 'warning');
    });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('avisa que o barbeiro precisa confirmar o e-mail antes do primeiro login (spec 047, ticket 10)', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true, userId: 'novo-user-id' }, error: null });

    render(<CadastroAcesso />);

    await screen.findByRole('option', { name: /Carlos/ });
    fireEvent.change(screen.getByLabelText(/Selecione o Barbeiro/i), { target: { value: 'prof-1' } });
    fireEvent.change(screen.getByLabelText(/E-mail de Login/i), { target: { value: 'carlos@gmail.com' } });
    fireEvent.change(screen.getByLabelText(/Senha de acesso/i), { target: { value: 'segredo123' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar e criar acesso/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        'Acesso criado para Carlos. O barbeiro precisa confirmar o e-mail antes do primeiro login.',
        'success'
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith('/profissionais');
  });

  it('mostra a mensagem real da Edge Function quando o e-mail já está em uso (FunctionsHttpError)', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError({
        json: async () => ({ error: 'Este e-mail já está em uso.' }),
      } as any),
    });

    render(<CadastroAcesso />);

    await screen.findByRole('option', { name: /Carlos/ });
    fireEvent.change(screen.getByLabelText(/Selecione o Barbeiro/i), { target: { value: 'prof-1' } });
    fireEvent.change(screen.getByLabelText(/E-mail de Login/i), { target: { value: 'carlos@gmail.com' } });
    fireEvent.change(screen.getByLabelText(/Senha de acesso/i), { target: { value: 'segredo123' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar e criar acesso/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Este e-mail já está em uso.', 'error');
    });
  });

  it('mantém a mensagem genérica quando o corpo da resposta de erro não pode ser lido', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError({
        json: async () => {
          throw new Error('corpo inválido');
        },
      } as any),
    });

    render(<CadastroAcesso />);

    await screen.findByRole('option', { name: /Carlos/ });
    fireEvent.change(screen.getByLabelText(/Selecione o Barbeiro/i), { target: { value: 'prof-1' } });
    fireEvent.change(screen.getByLabelText(/E-mail de Login/i), { target: { value: 'carlos@gmail.com' } });
    fireEvent.change(screen.getByLabelText(/Senha de acesso/i), { target: { value: 'segredo123' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar e criar acesso/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        'Edge Function returned a non-2xx status code',
        'error'
      );
    });
  });

  it('sugere a correção de domínio digitado errado no e-mail de login e aplica ao clicar', async () => {
    render(<CadastroAcesso />);

    await screen.findByRole('option', { name: /Carlos/ });
    const inputEmail = screen.getByLabelText(/E-mail de Login/i) as HTMLInputElement;
    fireEvent.change(inputEmail, { target: { value: 'carlos@gmial.com' } });
    fireEvent.blur(inputEmail);

    const btnSugestao = await screen.findByRole('button', { name: /carlos@gmail\.com/i });
    fireEvent.click(btnSugestao);

    expect(inputEmail.value).toBe('carlos@gmail.com');
  });
});
