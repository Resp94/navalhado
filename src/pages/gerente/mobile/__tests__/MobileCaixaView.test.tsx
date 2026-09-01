import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MobileCaixaView } from '../MobileCaixaView';
import { ToastProvider } from '../../../../components/Toast';

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
    render(
      <ToastProvider>
        <MobileCaixaView {...defaultProps} />
      </ToastProvider>
    );

    expect(screen.getByText('Caixa fechado')).toBeInTheDocument();
    expect(screen.getByText('Abrir caixa do turno')).toBeInTheDocument();
    expect(screen.getByText('Faturamento total')).toBeInTheDocument();
    expect(screen.getByText('Recebimentos Pix')).toBeInTheDocument();

    const openBtn = screen.getByRole('button', { name: /Abrir caixa do turno/i });
    fireEvent.click(openBtn);
    expect(defaultProps.onOpenAbertura).toHaveBeenCalledTimes(1);
  });

  it('renderiza o status do caixa aberto com botão de fechamento', () => {
    const activeSession = {
      id: 'session-1',
      tenant_id: 'tenant-1',
      opened_by: 'user-1',
      closed_by: null,
      initial_amount: 100,
      opened_at: '2026-08-20T08:00:00Z',
      closed_at: null,
      closing_amount: null,
      status: 'open' as const,
      notes: null,
    };

    render(
      <ToastProvider>
        <MobileCaixaView
          {...defaultProps}
          activeSession={activeSession}
          activeSessionCashReceipts={200}
        />
      </ToastProvider>
    );

    expect(screen.getByText('Caixa aberto')).toBeInTheDocument();
    expect(screen.getByText('Fechar caixa do turno')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Fechar caixa do turno/i });
    fireEvent.click(closeBtn);
    expect(defaultProps.onOpenFechamento).toHaveBeenCalledTimes(1);
  });

  it('exibe o faturamento realizado separado das entradas por dia', () => {
    render(
      <ToastProvider>
        <MobileCaixaView
          {...defaultProps}
          dailyStartDate="2026-08-28"
          dailyEndDate="2026-08-29"
          dailySummary={[
            {
              date: '2026-08-28',
              realized_revenue: 80,
              received_total: 30,
              by_method: { dinheiro: 0, pix: 30, cartao: 0, outros: 0 },
              closed_comandas_count: 1,
              payment_count: 1,
            },
            {
              date: '2026-08-29',
              realized_revenue: 0,
              received_total: 50,
              by_method: { dinheiro: 50, pix: 0, cartao: 0, outros: 0 },
              closed_comandas_count: 0,
              payment_count: 1,
            },
          ]}
        />
      </ToastProvider>
    );

    expect(screen.getByText('Resumo por dia')).toBeInTheDocument();
    expect(screen.getByText('Faturamento realizado', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('28/08/2026')).toBeInTheDocument();
    expect(screen.getByText('29/08/2026')).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s*80,00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/R\$\s*30,00/).length).toBeGreaterThanOrEqual(1);
  });
});
