import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingWizard } from '../gerente/OnboardingWizard';

const { mockAddToast, mockNavigate, mockFrom, mockGetUser } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockNavigate: vi.fn(),
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useOutletContext: () => ({
    tenantId: 'tenant-123',
    tenantName: 'Barbearia do Jonathas',
    logoUrl: null,
    timezone: 'America/Sao_Paulo',
    onboardingCompleted: false,
  }),
}));

vi.mock('../../components/Toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => mockFrom(table),
  },
}));

describe('OnboardingWizard Flow (Passos 1 ao 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        logradouro: 'Av. Brasil',
        bairro: 'Compensa',
        localidade: 'Manaus',
        uf: 'AM',
      }),
    }));

    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-gestor-1' } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { name: 'Jonathas Gestor' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { phone: '92999991111' },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'tenant_subscriptions') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  plans: {
                    name: 'Bronze',
                    max_professionals: 3,
                  },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'services' || table === 'professionals') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return { select: vi.fn() };
    });
  });

  it('renderiza o Passo 1 (Localização) e permite avançar apenas com endereço válido', async () => {
    render(<OnboardingWizard />);

    expect(screen.getByTestId('step-location')).toBeInTheDocument();
    const nextBtn = screen.getByRole('button', { name: /Continuar para Segmentação/i });
    expect(nextBtn).toBeDisabled();

    // Preencher campos obrigatórios
    fireEvent.change(screen.getByLabelText(/CEP/i), { target: { value: '69000-000' } });
    fireEvent.change(screen.getByLabelText(/Endereço \/ Rua/i), { target: { value: 'Rua das Flores' } });
    fireEvent.change(screen.getByLabelText(/Número/i), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText(/Bairro/i), { target: { value: 'Centro' } });
    fireEvent.change(screen.getByLabelText(/Cidade/i), { target: { value: 'Manaus' } });
    fireEvent.change(screen.getByLabelText(/Estado \(UF\)/i), { target: { value: 'AM' } });

    await waitFor(() => {
      expect(nextBtn).toBeEnabled();
    });

    fireEvent.click(nextBtn);

    // Passo 2 deve estar visível
    await waitFor(() => {
      expect(screen.getByTestId('step-segmentation')).toBeInTheDocument();
    });
  });

  it('completa todo o fluxo de 4 passos até a finalização com sucesso', async () => {
    render(<OnboardingWizard />);

    // --- Passo 1: Localização ---
    fireEvent.change(screen.getByLabelText(/CEP/i), { target: { value: '69000-000' } });
    fireEvent.change(screen.getByLabelText(/Endereço \/ Rua/i), { target: { value: 'Av. Brasil' } });
    fireEvent.change(screen.getByLabelText(/Número/i), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText(/Bairro/i), { target: { value: 'Compensa' } });
    fireEvent.change(screen.getByLabelText(/Cidade/i), { target: { value: 'Manaus' } });
    fireEvent.change(screen.getByLabelText(/Estado \(UF\)/i), { target: { value: 'AM' } });
    
    const nextLocBtn = screen.getByRole('button', { name: /Continuar para Segmentação/i });
    await waitFor(() => expect(nextLocBtn).toBeEnabled());
    fireEvent.click(nextLocBtn);

    // --- Passo 2: Segmentação ---
    await waitFor(() => expect(screen.getByTestId('step-segmentation')).toBeInTheDocument());
    
    fireEvent.change(screen.getByLabelText(/preço médio do corte/i), { target: { value: '4500' } });
    fireEvent.change(screen.getByLabelText(/Como você conheceu o Navalhado/i), { target: { value: 'instagram' } });
    
    const nextSegBtn = screen.getByRole('button', { name: /Continuar para Serviços/i });
    await waitFor(() => expect(nextSegBtn).toBeEnabled());
    fireEvent.click(nextSegBtn);

    // --- Passo 3: Serviços ---
    await waitFor(() => expect(screen.getByTestId('step-services')).toBeInTheDocument());

    // Clicar em template rápido "Corte Tradicional"
    const corteChip = screen.getByRole('button', { name: /Corte Tradicional/i });
    fireEvent.click(corteChip);

    const nextServBtn = screen.getByRole('button', { name: /Continuar para Equipe/i });
    await waitFor(() => expect(nextServBtn).toBeEnabled());
    fireEvent.click(nextServBtn);

    // --- Passo 4: Profissionais ---
    await waitFor(() => expect(screen.getByTestId('step-professionals')).toBeInTheDocument());

    // Clicar para incluir o Gestor como barbeiro
    const addManagerBtn = screen.getByRole('button', { name: /\+ Me incluir como Barbeiro/i });
    fireEvent.click(addManagerBtn);

    const finishBtn = screen.getByRole('button', { name: /Concluir e Entrar no Painel/i });
    await waitFor(() => expect(finishBtn).toBeEnabled());
    fireEvent.click(finishBtn);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('Configuração concluída com sucesso!'),
        'success'
      );
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });
});
