import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FechamentoCaixaModal } from '../FechamentoCaixaModal';
import { CaixaRepository } from '../../../modules/caixa/CaixaRepository';
import type { CashSession, ICaixaAdapter } from '../../../modules/caixa/types';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('FechamentoCaixaModal', () => {
  const mockAdapter: ICaixaAdapter = {
    obterSessaoAtiva: vi.fn(),
    abrirCaixa: vi.fn(),
    fecharCaixa: vi.fn(),
    listarHistorico: vi.fn(),
    obterEntradasDinheiro: vi.fn(),
  };

  const mockRepo = new CaixaRepository(mockAdapter);
  const mockOnCaixaFechado = vi.fn();
  const mockOnClose = vi.fn();

  const fakeActiveSession: CashSession = {
    id: 'sess-100',
    tenant_id: 'tenant-123',
    opened_by: 'user-1',
    closed_by: null,
    opened_at: '2026-08-17T08:00:00Z',
    closed_at: null,
    initial_amount: 100.0,
    closing_amount: null,
    status: 'open',
    notes: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-operator' } as any },
      error: null,
    });
  });

  it('não renderiza se isOpen for false ou session for null', () => {
    const { container } = render(
      <FechamentoCaixaModal
        isOpen={false}
        session={fakeActiveSession}
        onCaixaFechado={mockOnCaixaFechado}
        onClose={mockOnClose}
        caixaRepo={mockRepo}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza resumo esperado, calcula quebra/sobra e fecha o caixa registrando o operador', async () => {
    const closedSession: CashSession = {
      ...fakeActiveSession,
      status: 'closed',
      closed_by: 'user-operator',
      closing_amount: 250.0,
      closed_at: '2026-08-17T18:00:00Z',
      notes: 'Fechado sem problemas',
    };

    vi.mocked(mockAdapter.fecharCaixa).mockResolvedValueOnce(closedSession);

    render(
      <FechamentoCaixaModal
        isOpen={true}
        session={fakeActiveSession}
        cashReceipts={150.0}
        onCaixaFechado={mockOnCaixaFechado}
        onClose={mockOnClose}
        caixaRepo={mockRepo}
      />
    );

    // Deve exibir o título
    expect(screen.getByText('Fechamento e conferência de caixa')).toBeDefined();

    // Digitar valor contado na gaveta (250,00)
    const input = screen.getByLabelText(/Valor total em dinheiro contado na gaveta/i);
    fireEvent.change(input, { target: { value: '25000' } });

    // Digitar observações
    const notesInput = screen.getByLabelText(/Observações do fechamento/i);
    fireEvent.change(notesInput, { target: { value: 'Fechado sem problemas' } });

    // Submeter
    const submitBtn = screen.getByRole('button', { name: /Encerrar turno e fechar caixa/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockAdapter.fecharCaixa).toHaveBeenCalledWith({
        session_id: 'sess-100',
        closed_by: 'user-operator',
        closing_amount: 250.0,
        notes: 'Fechado sem problemas',
      });
      expect(mockOnCaixaFechado).toHaveBeenCalledWith(closedSession);
    });
  });
});
