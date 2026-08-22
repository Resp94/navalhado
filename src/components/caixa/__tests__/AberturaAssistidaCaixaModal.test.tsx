import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AberturaAssistidaCaixaModal } from '../AberturaAssistidaCaixaModal';
import { CaixaRepository } from '../../../modules/caixa/CaixaRepository';
import type { ICaixaAdapter } from '../../../modules/caixa/types';

describe('AberturaAssistidaCaixaModal', () => {
  const mockAdapter: ICaixaAdapter = {
    obterSessaoAtiva: vi.fn(),
    abrirCaixa: vi.fn(),
    fecharCaixa: vi.fn(),
    listarHistorico: vi.fn(),
    obterEntradasDinheiro: vi.fn(),
    obterResumoTurno: vi.fn(),
    registrarMovimentacao: vi.fn(),
    listarMovimentacoes: vi.fn(),
    obterResumoMovimentacoes: vi.fn(),
  };

  const mockRepo = new CaixaRepository(mockAdapter);
  const mockOnCaixaAberto = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('não renderiza nada se isOpen for false', () => {
    const { container } = render(
      <AberturaAssistidaCaixaModal
        isOpen={false}
        tenantId="tenant-123"
        onCaixaAberto={mockOnCaixaAberto}
        onClose={mockOnClose}
        caixaRepo={mockRepo}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza o formulário e abre o caixa com o fundo de troco informado', async () => {
    const fakeSession = {
      id: 'sess-1',
      tenant_id: 'tenant-123',
      opened_by: null,
      closed_by: null,
      opened_at: new Date().toISOString(),
      closed_at: null,
      initial_amount: 50.0,
      closing_amount: null,
      status: 'open' as const,
      notes: null,
    };

    vi.mocked(mockAdapter.obterSessaoAtiva).mockResolvedValueOnce(null);
    vi.mocked(mockAdapter.abrirCaixa).mockResolvedValueOnce(fakeSession);

    render(
      <AberturaAssistidaCaixaModal
        isOpen={true}
        tenantId="tenant-123"
        onCaixaAberto={mockOnCaixaAberto}
        onClose={mockOnClose}
        caixaRepo={mockRepo}
      />
    );

    expect(screen.getByText(/Abertura de caixa/i)).toBeInTheDocument();

    const inputAmount = screen.getByPlaceholderText('0,00');
    fireEvent.change(inputAmount, { target: { value: '5000' } }); // 50,00

    const submitBtn = screen.getByRole('button', { name: /Abrir caixa/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockAdapter.abrirCaixa).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant-123',
          initial_amount: 50.0,
        })
      );
      expect(mockOnCaixaAberto).toHaveBeenCalledWith(fakeSession);
    });
  });
});
