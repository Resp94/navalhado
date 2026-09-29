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

// Catálogo de planos que o wizard lê para saber se o plano do tenant é o maior (spec 052, ticket 02).
const plansTable = {
  select: () => ({
    order: vi.fn().mockResolvedValue({
      data: [
        { id: 'p-1', name: 'Tesoura', price: 59.9, max_professionals: 1 },
        { id: 'p-3', name: 'Bronze', price: 79.9, max_professionals: 3 },
        { id: 'p-5', name: 'Máquina', price: 89.9, max_professionals: 5 },
      ],
      error: null,
    }),
  }),
};

// Percorre os passos 1 a 3 e chega ao passo 4, onde o gestor se inclui como barbeiro.
const irAteOPasso4 = async () => {
  fireEvent.change(screen.getByLabelText(/CEP/i), { target: { value: '69000-000' } });
  fireEvent.change(screen.getByLabelText(/Rua ou Avenida/i), { target: { value: 'Av. Brasil' } });
  fireEvent.change(screen.getByLabelText(/Número/i), { target: { value: '500' } });
  fireEvent.change(screen.getByLabelText(/Bairro/i), { target: { value: 'Compensa' } });
  fireEvent.change(screen.getByLabelText(/Cidade/i), { target: { value: 'Manaus' } });
  fireEvent.change(screen.getByLabelText(/Estado \(UF\)/i), { target: { value: 'AM' } });
  const nextLocBtn = screen.getByRole('button', { name: /Continuar para o Preço Base/i });
  await waitFor(() => expect(nextLocBtn).toBeEnabled());
  fireEvent.click(nextLocBtn);

  await waitFor(() => expect(screen.getByTestId('step-segmentation')).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText(/Preço do Corte Tradicional/i), { target: { value: '4500' } });
  fireEvent.change(screen.getByLabelText(/Como você conheceu o Navalhado/i), { target: { value: 'instagram' } });
  const nextSegBtn = screen.getByRole('button', { name: /Continuar para Serviços/i });
  await waitFor(() => expect(nextSegBtn).toBeEnabled());
  fireEvent.click(nextSegBtn);

  await waitFor(() => expect(screen.getByTestId('step-services')).toBeInTheDocument());
  const nextServBtn = screen.getByRole('button', { name: /Continuar para Equipe/i });
  await waitFor(() => expect(nextServBtn).toBeEnabled());
  fireEvent.click(nextServBtn);

  await waitFor(() => expect(screen.getByTestId('step-professionals')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /Me incluir como Barbeiro/i }));
};

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
      if (table === 'plans') {
        return plansTable;
      }
      if (table === 'services' || table === 'professionals') {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return { select: vi.fn() };
    });
  });

  it('renderiza o Passo 1 (Localização) e permite avançar apenas com endereço válido', async () => {
    render(<OnboardingWizard />);

    expect(screen.getByTestId('step-location')).toBeInTheDocument();
    const nextBtn = screen.getByRole('button', { name: /Continuar para o Preço Base/i });
    expect(nextBtn).toBeDisabled();

    // Preencher campos obrigatórios
    fireEvent.change(screen.getByLabelText(/CEP/i), { target: { value: '69000-000' } });
    fireEvent.change(screen.getByLabelText(/Rua ou Avenida/i), { target: { value: 'Rua das Flores' } });
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

  it('completa todo o fluxo de 4 passos até a finalização com pré-população do primeiro serviço', async () => {
    render(<OnboardingWizard />);

    // --- Passo 1: Localização ---
    fireEvent.change(screen.getByLabelText(/CEP/i), { target: { value: '69000-000' } });
    fireEvent.change(screen.getByLabelText(/Rua ou Avenida/i), { target: { value: 'Av. Brasil' } });
    fireEvent.change(screen.getByLabelText(/Número/i), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText(/Bairro/i), { target: { value: 'Compensa' } });
    fireEvent.change(screen.getByLabelText(/Cidade/i), { target: { value: 'Manaus' } });
    fireEvent.change(screen.getByLabelText(/Estado \(UF\)/i), { target: { value: 'AM' } });
    
    const nextLocBtn = screen.getByRole('button', { name: /Continuar para o Preço Base/i });
    await waitFor(() => expect(nextLocBtn).toBeEnabled());
    fireEvent.click(nextLocBtn);

    // --- Passo 2: Segmentação ---
    await waitFor(() => expect(screen.getByTestId('step-segmentation')).toBeInTheDocument());
    
    fireEvent.change(screen.getByLabelText(/Preço do Corte Tradicional/i), { target: { value: '4500' } });
    fireEvent.change(screen.getByLabelText(/Como você conheceu o Navalhado/i), { target: { value: 'instagram' } });
    
    const nextSegBtn = screen.getByRole('button', { name: /Continuar para Serviços/i });
    await waitFor(() => expect(nextSegBtn).toBeEnabled());
    fireEvent.click(nextSegBtn);

    // --- Passo 3: Serviços ---
    await waitFor(() => expect(screen.getByTestId('step-services')).toBeInTheDocument());

    // "Corte Tradicional" já deve vir pré-populado na tabela
    expect(screen.getAllByText('Corte Tradicional').length).toBeGreaterThanOrEqual(1);

    const nextServBtn = screen.getByRole('button', { name: /Continuar para Equipe/i });
    await waitFor(() => expect(nextServBtn).toBeEnabled());
    fireEvent.click(nextServBtn);

    // --- Passo 4: Profissionais ---
    await waitFor(() => expect(screen.getByTestId('step-professionals')).toBeInTheDocument());

    // Clicar para incluir o Gestor como barbeiro
    const addManagerBtn = screen.getByRole('button', { name: /Me incluir como Barbeiro/i });
    fireEvent.click(addManagerBtn);

    const finishBtn = screen.getByRole('button', { name: /Concluir e Abrir meu Painel/i });
    await waitFor(() => expect(finishBtn).toBeEnabled());
    fireEvent.click(finishBtn);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('Configuração concluída com sucesso!'),
        'success'
      );
      expect(mockNavigate).toHaveBeenCalledWith('/agenda');
    });
  });

  it('vincula o gestor incluído como barbeiro ao próprio login, e os demais barbeiros ficam sem login', async () => {
    const mockProfessionalsUpsert = vi.fn().mockResolvedValue({ error: null });
    const baseFrom = mockFrom.getMockImplementation()!;
    mockFrom.mockImplementation((table: string) =>
      table === 'professionals' ? { upsert: mockProfessionalsUpsert } : baseFrom(table)
    );

    render(<OnboardingWizard />);

    // Passo 1
    fireEvent.change(screen.getByLabelText(/CEP/i), { target: { value: '69000-000' } });
    fireEvent.change(screen.getByLabelText(/Rua ou Avenida/i), { target: { value: 'Av. Brasil' } });
    fireEvent.change(screen.getByLabelText(/Número/i), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText(/Bairro/i), { target: { value: 'Compensa' } });
    fireEvent.change(screen.getByLabelText(/Cidade/i), { target: { value: 'Manaus' } });
    fireEvent.change(screen.getByLabelText(/Estado \(UF\)/i), { target: { value: 'AM' } });
    const nextLocBtn = screen.getByRole('button', { name: /Continuar para o Preço Base/i });
    await waitFor(() => expect(nextLocBtn).toBeEnabled());
    fireEvent.click(nextLocBtn);

    // Passo 2
    await waitFor(() => expect(screen.getByTestId('step-segmentation')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/Preço do Corte Tradicional/i), { target: { value: '4500' } });
    fireEvent.change(screen.getByLabelText(/Como você conheceu o Navalhado/i), { target: { value: 'instagram' } });
    const nextSegBtn = screen.getByRole('button', { name: /Continuar para Serviços/i });
    await waitFor(() => expect(nextSegBtn).toBeEnabled());
    fireEvent.click(nextSegBtn);

    // Passo 3
    await waitFor(() => expect(screen.getByTestId('step-services')).toBeInTheDocument());
    const nextServBtn = screen.getByRole('button', { name: /Continuar para Equipe/i });
    await waitFor(() => expect(nextServBtn).toBeEnabled());
    fireEvent.click(nextServBtn);

    // Passo 4: o gestor se inclui e cadastra mais um barbeiro
    await waitFor(() => expect(screen.getByTestId('step-professionals')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/Jonathas Gestor/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Me incluir como Barbeiro/i }));

    fireEvent.change(screen.getByLabelText(/Nome do Barbeiro/i), { target: { value: 'Carlos Navalha' } });
    fireEvent.change(screen.getByLabelText(/Celular ou WhatsApp/i), { target: { value: '92988887777' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/i }));

    const finishBtn = screen.getByRole('button', { name: /Concluir e Abrir meu Painel/i });
    await waitFor(() => expect(finishBtn).toBeEnabled());
    fireEvent.click(finishBtn);

    await waitFor(() => expect(mockProfessionalsUpsert).toHaveBeenCalledTimes(1));
    const payload = mockProfessionalsUpsert.mock.calls[0][0];
    expect(payload).toEqual([
      expect.objectContaining({ name: 'Jonathas Gestor', user_id: 'user-gestor-1' }),
      expect.objectContaining({ name: 'Carlos Navalha', user_id: null }),
    ]);
  });

  it('tentar concluir de novo depois da recusa por limite não duplica serviços nem profissionais (spec 052, ticket 02)', async () => {
    const limitError = { code: '53400', message: 'PROFESSIONAL_LIMIT_REACHED' };
    const mockServicesUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockProfessionalsUpsert = vi
      .fn()
      .mockResolvedValueOnce({ error: limitError })
      .mockResolvedValue({ error: null });
    const mockTenantUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const baseFrom = mockFrom.getMockImplementation()!;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'services') return { upsert: mockServicesUpsert };
      if (table === 'professionals') return { upsert: mockProfessionalsUpsert };
      if (table === 'tenants') return { ...baseFrom(table), update: mockTenantUpdate };
      return baseFrom(table);
    });

    render(<OnboardingWizard />);
    await irAteOPasso4();

    const finishBtn = screen.getByRole('button', { name: /Concluir e Abrir meu Painel/i });
    await waitFor(() => expect(finishBtn).toBeEnabled());
    fireEvent.click(finishBtn);
    await waitFor(() => expect(mockProfessionalsUpsert).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: /Concluir e Abrir meu Painel/i })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: /Concluir e Abrir meu Painel/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/agenda'));

    // Mesmos ids nas duas tentativas, gravados por upsert no id: a segunda atualiza, não duplica.
    const ids = (chamada: unknown[]) => (chamada[0] as { id: string }[]).map((linha) => linha.id);
    expect(mockServicesUpsert).toHaveBeenCalledTimes(2);
    expect(ids(mockServicesUpsert.mock.calls[1])).toEqual(ids(mockServicesUpsert.mock.calls[0]));
    expect(ids(mockProfessionalsUpsert.mock.calls[1])).toEqual(ids(mockProfessionalsUpsert.mock.calls[0]));
    expect(mockServicesUpsert.mock.calls[0][1]).toEqual({ onConflict: 'id' });
    expect(mockProfessionalsUpsert.mock.calls[0][1]).toEqual({ onConflict: 'id' });
    expect(mockTenantUpdate).toHaveBeenCalledTimes(1);
  });

  it('traduz a recusa do banco por limite de profissionais em mensagem amigável e não conclui o onboarding (spec 052, ticket 02)', async () => {
    const mockTenantUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const baseFrom = mockFrom.getMockImplementation()!;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'professionals') {
        return {
          upsert: vi.fn().mockResolvedValue({
            error: { code: '53400', message: 'PROFESSIONAL_LIMIT_REACHED' },
          }),
        };
      }
      if (table === 'tenants') {
        return { ...baseFrom(table), update: mockTenantUpdate };
      }
      return baseFrom(table);
    });

    render(<OnboardingWizard />);
    await irAteOPasso4();

    const finishBtn = screen.getByRole('button', { name: /Concluir e Abrir meu Painel/i });
    await waitFor(() => expect(finishBtn).toBeEnabled());
    fireEvent.click(finishBtn);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringMatching(/limite de 3 profissionais do plano Bronze.*plano maior/i),
        'warning'
      );
    });
    expect(mockAddToast).not.toHaveBeenCalledWith('PROFESSIONAL_LIMIT_REACHED', 'error');
    expect(mockTenantUpdate).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('não marca o tenant como concluído se a inserção de serviços falhar (atomicidade)', async () => {
    const mockTenantUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({ data: { name: 'Gestor' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({ data: { phone: '92999991111' }, error: null }),
            }),
          }),
          update: mockTenantUpdate,
        };
      }
      if (table === 'tenant_subscriptions') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { plans: { name: 'Bronze', max_professionals: 3 } },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'plans') {
        return plansTable;
      }
      if (table === 'services') {
        return {
          upsert: vi.fn().mockResolvedValue({ error: new Error('DATABASE_CONNECTION_ERROR') }),
        };
      }
      if (table === 'professionals') {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return { select: vi.fn() };
    });

    render(<OnboardingWizard />);

    // Passo 1
    fireEvent.change(screen.getByLabelText(/CEP/i), { target: { value: '69000-000' } });
    fireEvent.change(screen.getByLabelText(/Rua ou Avenida/i), { target: { value: 'Av. Brasil' } });
    fireEvent.change(screen.getByLabelText(/Número/i), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText(/Bairro/i), { target: { value: 'Compensa' } });
    fireEvent.change(screen.getByLabelText(/Cidade/i), { target: { value: 'Manaus' } });
    fireEvent.change(screen.getByLabelText(/Estado \(UF\)/i), { target: { value: 'AM' } });
    const nextLocBtn = screen.getByRole('button', { name: /Continuar para o Preço Base/i });
    await waitFor(() => expect(nextLocBtn).toBeEnabled());
    fireEvent.click(nextLocBtn);

    // Passo 2
    await waitFor(() => expect(screen.getByTestId('step-segmentation')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/Preço do Corte Tradicional/i), { target: { value: '4500' } });
    fireEvent.change(screen.getByLabelText(/Como você conheceu o Navalhado/i), { target: { value: 'instagram' } });
    const nextSegBtn = screen.getByRole('button', { name: /Continuar para Serviços/i });
    await waitFor(() => expect(nextSegBtn).toBeEnabled());
    fireEvent.click(nextSegBtn);

    // Passo 3
    await waitFor(() => expect(screen.getByTestId('step-services')).toBeInTheDocument());
    const nextServBtn = screen.getByRole('button', { name: /Continuar para Equipe/i });
    await waitFor(() => expect(nextServBtn).toBeEnabled());
    fireEvent.click(nextServBtn);

    // Passo 4
    await waitFor(() => expect(screen.getByTestId('step-professionals')).toBeInTheDocument());
    const addManagerBtn = screen.getByRole('button', { name: /Me incluir como Barbeiro/i });
    fireEvent.click(addManagerBtn);

    const finishBtn = screen.getByRole('button', { name: /Concluir e Abrir meu Painel/i });
    await waitFor(() => expect(finishBtn).toBeEnabled());
    fireEvent.click(finishBtn);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('DATABASE_CONNECTION_ERROR'),
        'error'
      );
      expect(mockTenantUpdate).not.toHaveBeenCalled();
    });
  });
});
