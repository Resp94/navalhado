import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuitacaoComissaoModal } from '../QuitacaoComissaoModal';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe('QuitacaoComissaoModal', () => {
  const mockOnSuccess = vi.fn();
  const mockOnClose = vi.fn();

  const fakeProfessional = {
    id: 'prof-123',
    name: 'Carlos Barbeiro',
    commission_sum: 500.0,
    paid_sum: 200.0,
    pending_sum: 300.0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('não renderiza se isOpen for false ou professional for null', () => {
    const { container } = render(
      <QuitacaoComissaoModal
        isOpen={false}
        professional={fakeProfessional}
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza com o valor pendente preenchido e permite submeter a quitação com sucesso', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { success: true, payout_id: 'payout-1' },
      error: null,
    } as any);

    render(
      <QuitacaoComissaoModal
        isOpen={true}
        professional={fakeProfessional}
        tenantId="tenant-abc"
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Quitação de comissão')).toBeDefined();
    expect(screen.getByText('Carlos Barbeiro')).toBeDefined();

    // O input deve vir pré-preenchido com 300,00 (saldo pendente)
    const amountInput = screen.getByLabelText(/Valor do repasse/i) as HTMLInputElement;
    expect(amountInput.value).toBe('300,00');

    // Selecionar método de pagamento (PIX)
    const methodSelect = screen.getByLabelText(/Forma de pagamento/i);
    fireEvent.change(methodSelect, { target: { value: 'pix' } });

    // Submeter formulário
    const submitBtn = screen.getByRole('button', { name: /Confirmar pagamento/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith(
        'register_commission_payout',
        expect.objectContaining({
          p_professional_id: 'prof-123',
          p_amount: 300.0,
          p_payment_method: 'pix',
          p_tenant_id: 'tenant-abc',
        })
      );
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });
});
