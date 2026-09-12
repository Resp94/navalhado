import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ExtratoContaProfissionalModal } from '../ExtratoContaProfissionalModal';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe('ExtratoContaProfissionalModal', () => {
  const mockOnClose = vi.fn();
  const professional = { id: 'prof-1', name: 'Carlos Barbeiro' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('não renderiza se isOpen for false ou professional for null', () => {
    const { container } = render(
      <ExtratoContaProfissionalModal isOpen={false} professional={professional} onClose={mockOnClose} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('carrega e exibe o extrato com vale, gorjeta e quitação em ordem cronológica', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        entries: [
          {
            kind: 'quitacao',
            id: 'payout-1',
            amount: 28,
            direction: 'debit',
            reason: 'Quitação do turno',
            status: 'paid',
            created_at: '2026-09-12T15:00:00.000Z',
            created_by: 'gerente-1',
            advance_amount: 0,
            credit_amount: 8,
          },
          {
            kind: 'gorjeta',
            id: 'gorjeta-1',
            amount: 8,
            settled_amount: 8,
            direction: 'credit',
            reason: 'Gorjeta da comanda',
            status: 'settled',
            created_at: '2026-09-12T14:00:00.000Z',
            created_by: 'gerente-1',
          },
          {
            kind: 'vale',
            id: 'vale-1',
            amount: 5,
            settled_amount: 0,
            direction: 'debit',
            reason: 'Vale para o corte',
            status: 'reversed',
            created_at: '2026-09-12T13:00:00.000Z',
            created_by: 'gerente-1',
            reversed_at: '2026-09-12T13:30:00.000Z',
            reversed_by: 'gerente-1',
            reversal_reason: 'Vale lançado por engano',
          },
        ],
        current_balance: {
          current_open_balance: 0,
          generated_commission: 20,
          paid_commission: 20,
          advances_open_amount: 0,
          credits_open_amount: 0,
          suggested_net_amount: 0,
        },
      },
      error: null,
    } as any);

    render(
      <ExtratoContaProfissionalModal
        isOpen={true}
        professional={professional}
        tenantId="tenant-abc"
        onClose={mockOnClose}
      />
    );

    expect(supabase.rpc).toHaveBeenCalledWith('get_professional_account_statement', {
      p_professional_id: 'prof-1',
      p_tenant_id: 'tenant-abc',
    });

    await waitFor(() => {
      expect(screen.getByText('Quitação')).toBeDefined();
      expect(screen.getByText('Gorjeta')).toBeDefined();
      expect(screen.getByText('Vale')).toBeDefined();
    });

    expect(screen.getByText('Estornado')).toBeDefined();
    expect(screen.getByText(/Vale lançado por engano/)).toBeDefined();
  });

  it('exibe mensagem de erro quando a consulta falha', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'Acesso negado para este extrato.' },
    } as any);

    render(
      <ExtratoContaProfissionalModal
        isOpen={true}
        professional={professional}
        tenantId="tenant-abc"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Acesso negado para este extrato.')).toBeDefined();
    });
  });
});
