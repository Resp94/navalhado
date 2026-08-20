import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MobileCaixaView } from '../MobileCaixaView';

describe('MobileCaixaView Component', () => {
  const mockMetrics = {
    total_revenue: 1500,
    services_revenue: 1200,
    products_revenue: 300,
    products_count: 5,
    products_cost: 100,
    total_commission: 450,
    paid_commission: 300,
    pending_commission: 150,
    net_revenue: 950,
    revenue_by_method: {
      pix: 800,
      cartao_credito: 400,
      cartao_debito: 100,
      dinheiro: 200,
    },
    commissions_by_professional: [],
  };

  const defaultProps = {
    activeSession: null,
    activeSessionCashReceipts: 0,
    metrics: mockMetrics,
    historySessions: [],
    onOpenAbertura: vi.fn(),
    onOpenFechamento: vi.fn(),
    formatDate: (d: string) => d,
  };

  it('renderiza o status do caixa fechado com botão de abertura e cards de resumo', () => {
    render(<MobileCaixaView {...defaultProps} />);

    expect(screen.getByText('Caixa Fechado')).toBeInTheDocument();
    expect(screen.getByText('Abrir Caixa do Turno')).toBeInTheDocument();
    expect(screen.getByText('Faturamento Total')).toBeInTheDocument();
    expect(screen.getByText('Recebimentos PIX')).toBeInTheDocument();
    expect(screen.getByText('Relatórios Completos no Desktop')).toBeInTheDocument();

    const openBtn = screen.getByRole('button', { name: /Abrir Caixa do Turno/i });
    fireEvent.click(openBtn);
    expect(defaultProps.onOpenAbertura).toHaveBeenCalledTimes(1);
  });

  it('renderiza o status do caixa aberto com botão de fechamento', () => {
    const activeSession = {
      id: 'session-1',
      tenant_id: 'tenant-1',
      operator_id: 'user-1',
      initial_amount: 100,
      opened_at: '2026-08-20T08:00:00Z',
      closed_at: null,
      closing_amount: null,
      notes: null,
    };

    render(
      <MobileCaixaView
        {...defaultProps}
        activeSession={activeSession}
        activeSessionCashReceipts={200}
      />
    );

    expect(screen.getByText('Caixa Aberto')).toBeInTheDocument();
    expect(screen.getByText('Fechar Caixa do Turno')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Fechar Caixa do Turno/i });
    fireEvent.click(closeBtn);
    expect(defaultProps.onOpenFechamento).toHaveBeenCalledTimes(1);
  });
});
