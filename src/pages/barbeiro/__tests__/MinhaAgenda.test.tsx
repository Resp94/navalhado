import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '../../../components/Toast';
import { MinhaAgenda } from '../MinhaAgenda';
import { supabase } from '../../../lib/supabase';

// Mock do supabase auth
vi.mock('../../../lib/supabase', () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: 'user-barber-1', email: 'barbeiro@navalhado.com' },
            },
          },
        }),
        signOut: vi.fn(),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'professionals') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'prof-1',
                    name: 'Barbeiro Teste',
                    tenant_id: 'tenant-1',
                    commission_percentage: 50,
                    timezone: 'America/Sao_Paulo',
                  },
                }),
              }),
            }),
          };
        }
        if (table === 'appointments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lte: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({
                      data: [],
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      }),
    },
  };
});

describe('MinhaAgenda Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carrega o perfil do colaborador e renderiza os cards de estatísticas', async () => {
    render(
      <ToastProvider>
        <BrowserRouter>
          <MinhaAgenda />
        </BrowserRouter>
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Cortes Hoje')).toBeInTheDocument();
      expect(screen.getByText('Concluídos')).toBeInTheDocument();
      expect(screen.getByText('Faturamento')).toBeInTheDocument();
      expect(screen.getByText('Minha Comissão')).toBeInTheDocument();
      expect(screen.getByText('Atendimentos Agendados')).toBeInTheDocument();
    });
  });
});
