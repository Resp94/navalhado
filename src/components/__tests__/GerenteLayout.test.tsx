import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { GerenteLayout } from '../GerenteLayout';

const { mockAddToast, mockSupabaseClient, mockUserSingle, mockTenantSingle } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockUserSingle: vi.fn(),
  mockTenantSingle: vi.fn(),
  mockSupabaseClient: {
    auth: {
      getUser: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  },
}));

vi.mock('../../components/Toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

vi.mock('../../lib/useRealtimeNotifications', () => ({
  useRealtimeNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    markAllAsRead: vi.fn(),
    markAsRead: vi.fn(),
  }),
}));

describe('GerenteLayout - Navigation - TDD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza todos os links de navegação incluindo o novo link de Ajustes', async () => {
    const mockUser = { id: 'user-123' };
    const mockProfile = { name: 'Gerente Teste', tenant_id: 'tenant-123', role: 'gerente' };
    const mockTenant = { id: 'tenant-123', name: 'Barbearia Navalhado', logo_url: null };

    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: mockUserSingle.mockResolvedValue({ data: mockProfile, error: null }),
            }),
          }),
        };
      }
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              single: mockTenantSingle.mockResolvedValue({ data: mockTenant, error: null }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => ({ single: vi.fn() }) }) };
    });

    render(
      <MemoryRouter>
        <GerenteLayout />
      </MemoryRouter>
    );

    // Esperar a barra de navegação carregar e sair do esqueleto
    await screen.findByText('Gerente Teste');

    // Verificar se todos os links de navegação esperados estão presentes
    expect(screen.getByText('Agenda')).toBeInTheDocument();
    expect(screen.getByText('Clientes')).toBeInTheDocument();
    expect(screen.getByText('Equipe')).toBeInTheDocument();
    expect(screen.getByText('Serviços')).toBeInTheDocument();
    expect(screen.getByText('Financeiro')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    
    // O NOVO link "Ajustes" deve estar presente!
    expect(screen.getByText('Ajustes')).toBeInTheDocument();
  });
});
