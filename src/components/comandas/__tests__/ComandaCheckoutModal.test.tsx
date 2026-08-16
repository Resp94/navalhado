import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComandaCheckoutModal } from '../ComandaCheckoutModal';
import { ComandaRepository } from '../../../modules/comandas/ComandaRepository';
import { CaixaRepository } from '../../../modules/caixa/CaixaRepository';
import { ProdutoRepository } from '../../../modules/produtos/ProdutoRepository';
import type { IComandaAdapter } from '../../../modules/comandas/types';
import type { ICaixaAdapter } from '../../../modules/caixa/types';
import type { IProdutoAdapter } from '../../../modules/produtos/types';

describe('ComandaCheckoutModal', () => {
  const mockComandaAdapter: IComandaAdapter = {
    obterPorId: vi.fn(),
    obterPorAppointmentId: vi.fn(),
    listarAbertas: vi.fn(),
    criarComanda: vi.fn(),
    adicionarItem: vi.fn(),
    removerItem: vi.fn(),
    liquidarComanda: vi.fn(),
  };

  const mockCaixaAdapter: ICaixaAdapter = {
    obterSessaoAtiva: vi.fn(),
    abrirCaixa: vi.fn(),
    fecharCaixa: vi.fn(),
  };

  const mockProdutoAdapter: IProdutoAdapter = {
    listarAtivos: vi.fn(),
    salvarProduto: vi.fn(),
  };

  const comandaRepo = new ComandaRepository(mockComandaAdapter);
  const caixaRepo = new CaixaRepository(mockCaixaAdapter);
  const produtoRepo = new ProdutoRepository(mockProdutoAdapter);

  const mockOnClose = vi.fn();
  const mockOnFinalizado = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockComandaAdapter.obterPorAppointmentId).mockResolvedValue(null);
    vi.mocked(mockProdutoAdapter.listarAtivos).mockResolvedValue([
      { id: 'prod-1', tenant_id: 't-1', name: 'Pomada Matte', price: 30.0, cost_price: 15, stock_quantity: 5, is_active: true },
    ]);
  });

  it('não renderiza se isOpen for false', () => {
    const { container } = render(
      <ComandaCheckoutModal
        isOpen={false}
        tenantId="t-1"
        customerName="Carlos Silva"
        onClose={mockOnClose}
        onFinalizado={mockOnFinalizado}
        comandaRepo={comandaRepo}
        caixaRepo={caixaRepo}
        produtoRepo={produtoRepo}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza itens iniciais e calcula total corretamente', async () => {
    vi.mocked(mockCaixaAdapter.obterSessaoAtiva).mockResolvedValueOnce({
      id: 'sess-1',
      tenant_id: 't-1',
      opened_by: null,
      closed_by: null,
      opened_at: new Date().toISOString(),
      closed_at: null,
      initial_amount: 50,
      closing_amount: null,
      status: 'open',
      notes: null,
    });

    render(
      <ComandaCheckoutModal
        isOpen={true}
        tenantId="t-1"
        customerName="Carlos Silva"
        initialServices={[
          { service_id: 'srv-1', name: 'Corte Degradê', price: 35.0, professional_id: 'prof-1' },
        ]}
        onClose={mockOnClose}
        onFinalizado={mockOnFinalizado}
        comandaRepo={comandaRepo}
        caixaRepo={caixaRepo}
        produtoRepo={produtoRepo}
      />
    );

    expect(screen.getByText('Comanda & Checkout')).toBeInTheDocument();
    expect(screen.getByText('Carlos Silva')).toBeInTheDocument();
    expect(await screen.findByText('Corte Degradê')).toBeInTheDocument();
    expect(screen.getAllByText(/35\.00/).length).toBeGreaterThan(0);
  });

  it('liquida a comanda quando o caixa está aberto', async () => {
    vi.mocked(mockCaixaAdapter.obterSessaoAtiva).mockResolvedValue({
      id: 'sess-1',
      tenant_id: 't-1',
      opened_by: null,
      closed_by: null,
      opened_at: new Date().toISOString(),
      closed_at: null,
      initial_amount: 50,
      closing_amount: null,
      status: 'open',
      notes: null,
    });

    const fakeComandaCriada = {
      id: 'com-1',
      tenant_id: 't-1',
      appointment_id: 'apt-1',
      customer_id: 'cust-1',
      status: 'aberta' as const,
      total_amount: 35.0,
      discount_amount: 0,
      tip_amount: 0,
      notes: null,
    };
    vi.mocked(mockComandaAdapter.criarComanda).mockResolvedValueOnce(fakeComandaCriada);

    const fakeComandaLiquidada = {
      ...fakeComandaCriada,
      status: 'fechada' as const,
    };
    vi.mocked(mockComandaAdapter.liquidarComanda).mockResolvedValueOnce(fakeComandaLiquidada);

    render(
      <ComandaCheckoutModal
        isOpen={true}
        tenantId="t-1"
        appointmentId="apt-1"
        customerId="cust-1"
        customerName="Carlos Silva"
        initialServices={[
          { service_id: 'srv-1', name: 'Corte Degradê', price: 35.0, professional_id: 'prof-1' },
        ]}
        onClose={mockOnClose}
        onFinalizado={mockOnFinalizado}
        comandaRepo={comandaRepo}
        caixaRepo={caixaRepo}
        produtoRepo={produtoRepo}
      />
    );

    const btnFinalizar = await screen.findByRole('button', { name: /Finalizar & Receber/i });
    await waitFor(() => expect(btnFinalizar).not.toBeDisabled());
    fireEvent.click(btnFinalizar);

    await waitFor(() => {
      expect(mockComandaAdapter.criarComanda).toHaveBeenCalled();
      expect(mockComandaAdapter.liquidarComanda).toHaveBeenCalled();
      expect(mockOnFinalizado).toHaveBeenCalledWith(fakeComandaLiquidada);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
