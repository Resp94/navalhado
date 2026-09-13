import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { FinanceiroHub } from '../financeiro/HubLayout';
import { FinanceiroPainel } from '../financeiro/PainelLayout';
import { CaixaTab } from '../financeiro/CaixaTab';
import { ComissoesTab } from '../financeiro/ComissoesTab';

// Mocks do GSAP para testes unitários
vi.mock('gsap', () => ({
  gsap: {
    fromTo: vi.fn(),
    timeline: () => ({
      fromTo: vi.fn().mockReturnThis(),
    }),
  },
}));

vi.mock('@gsap/react', () => ({
  useGSAP: (cb: () => void) => {
    cb();
  },
}));

const { mockAddToast, mockRpc, mockFrom } = vi.hoisted(() => {
  const mockAddToast = vi.fn();
  const mockRpc = vi.fn();
  const mockFrom = vi.fn();
  return { mockAddToast, mockRpc, mockFrom };
});

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc: mockRpc,
    from: mockFrom,
  },
}));

vi.mock('../../../components/Toast', () => ({
  useToast: () => ({
    addToast: mockAddToast,
  }),
}));

// Substitui o GerenteLayout real: entrega o contexto do tenant como a rota de gerente entrega,
// sem os efeitos colaterais de autenticação e carga de tenant que ele faz.
function FakeGerenteLayout() {
  return (
    <Outlet
      context={{
        tenantId: 'test-tenant-123',
        tenantName: 'Barbearia Modelo',
        timezone: 'America/Sao_Paulo',
      }}
    />
  );
}

/** Monta a mesma árvore de rotas de `/financeiro` que o App.tsx declara, num roteador em memória. */
function renderHub(initialPath = '/financeiro') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<FakeGerenteLayout />}>
          <Route path="/financeiro" element={<FinanceiroHub />}>
            <Route index element={<Navigate to="/financeiro/caixa" replace />} />
            <Route element={<FinanceiroPainel />}>
              <Route path="caixa" element={<CaixaTab />} />
              <Route path="comissoes" element={<ComissoesTab />} />
            </Route>
            <Route path="*" element={<Navigate to="/financeiro/caixa" replace />} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('Página Financeiro (Gerente - Hub Financeiro)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: null, error: null });

    // Default mock para consultas de tabela
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  it('deve exibir os 5 cards de KPIs consolidados ao carregar com sucesso', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        total_revenue: 2500.0,
        services_revenue: 2000.0,
        products_revenue: 500.0,
        products_count: 10,
        products_cost: 200.0,
        total_commission: 800.0,
        paid_commission: 350.0,
        pending_commission: 450.0,
        net_revenue: 1500.0,
        revenue_by_method: {
          pix: 1500.0,
          credit_card: 700.0,
          cash: 300.0,
        },
        commissions_by_professional: [
          {
            professional_id: 'prof-1',
            professional_name: 'Carlos Barbeiro',
            commission_sum: 500.0,
            paid_sum: 200.0,
            pending_sum: 300.0,
            appointments_count: 12,
          },
        ],
      },
      error: null,
    });

    renderHub('/financeiro/caixa');

    await waitFor(() => {
      expect(screen.getByText('Hub financeiro')).toBeInTheDocument();
    });

    // 1. Faturamento bruto
    expect(screen.getByText('Faturamento bruto')).toBeInTheDocument();
    expect(screen.getAllByText(/2\.500,00/).length).toBeGreaterThanOrEqual(1);

    // 2. Serviços prestados
    expect(screen.getByText('Serviços prestados')).toBeInTheDocument();
    expect(screen.getAllByText(/2\.000,00/).length).toBeGreaterThanOrEqual(1);

    // 3. Venda de produtos
    expect(screen.getByText('Venda de produtos')).toBeInTheDocument();
    expect(screen.getAllByText(/500,00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/10 itens/)).toBeInTheDocument();

    // 4. Comissões da equipe
    expect(screen.getByText('Comissões da equipe')).toBeInTheDocument();
    expect(screen.getAllByText(/800,00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Pendente: R\$\s*450,00/)).toBeInTheDocument();

    // 5. Lucro líquido livre
    expect(screen.getByText('Lucro líquido livre')).toBeInTheDocument();
    expect(screen.getAllByText(/1\.500,00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Resumo por dia')).toHaveLength(2);
  });

  it('deve abrir a aba Caixa quando a URL é /financeiro, sem sub-rota', async () => {
    renderHub('/financeiro');

    await waitFor(() => {
      expect(screen.getByText('Recebimentos por forma de pagamento')).toBeInTheDocument();
    });

    const caixaLink = screen.getByRole('link', { name: /Caixa diário e turnos/i });
    expect(caixaLink).toHaveClass('nav-tab-btn--active');
  });

  it('deve redirecionar uma sub-rota desconhecida de /financeiro para a aba Caixa', async () => {
    renderHub('/financeiro/relatorios-inexistentes');

    await waitFor(() => {
      expect(screen.getByText('Recebimentos por forma de pagamento')).toBeInTheDocument();
    });

    const caixaLink = screen.getByRole('link', { name: /Caixa diário e turnos/i });
    expect(caixaLink).toHaveClass('nav-tab-btn--active');
  });

  it('deve alternar entre as abas Caixa diário e Repasses de comissões por navegação de link', async () => {
    mockRpc.mockResolvedValue({
      data: {
        total_revenue: 1000.0,
        services_revenue: 800.0,
        products_revenue: 200.0,
        products_count: 4,
        products_cost: 80.0,
        total_commission: 300.0,
        paid_commission: 100.0,
        pending_commission: 200.0,
        net_revenue: 620.0,
        revenue_by_method: { pix: 1000.0 },
        commissions_by_professional: [
          {
            professional_id: 'prof-1',
            professional_name: 'Carlos Barbeiro',
            commission_sum: 300.0,
            paid_sum: 100.0,
            pending_sum: 200.0,
            appointments_count: 5,
          },
        ],
      },
      error: null,
    });

    renderHub('/financeiro/caixa');

    await waitFor(() => {
      expect(screen.getByText(/Caixa diário e turnos/i)).toBeInTheDocument();
    });

    // Navegar para a aba Repasses de comissões é navegação por link, não clique em botão
    const comissoesLink = screen.getByRole('link', { name: /Repasses de comissões/i });
    fireEvent.click(comissoesLink);

    // Deve exibir tabela de comissões
    expect(await screen.findByText('Saldos de comissão por profissional')).toBeInTheDocument();
    expect(screen.getByText('Carlos Barbeiro')).toBeInTheDocument();
    expect(screen.getByText('Pagar comissão')).toBeInTheDocument();
    expect(comissoesLink).toHaveClass('nav-tab-btn--active');
  });

  it('deve preservar o período ao alternar entre Caixa e Comissões, sem nova busca de métricas', async () => {
    mockRpc.mockResolvedValue({
      data: {
        total_revenue: 3000,
        services_revenue: 2500,
        products_revenue: 500,
        products_count: 5,
        products_cost: 200,
        total_commission: 1200,
        paid_commission: 400,
        pending_commission: 800,
        net_revenue: 1600,
        revenue_by_method: { pix: 3000 },
        commissions_by_professional: [],
      },
      error: null,
    });

    renderHub('/financeiro/caixa');

    await waitFor(() => {
      expect(mockRpc.mock.calls.filter(([name]) => name === 'get_tenant_financial_metrics')).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /Últimos 30 dias/i }));

    await waitFor(() => {
      expect(mockRpc.mock.calls.filter(([name]) => name === 'get_tenant_financial_metrics')).toHaveLength(2);
    });

    fireEvent.click(screen.getByRole('link', { name: /Repasses de comissões/i }));
    await screen.findByText('Saldos de comissão por profissional');

    fireEvent.click(screen.getByRole('link', { name: /Caixa diário e turnos/i }));
    await screen.findByText('Recebimentos por forma de pagamento');

    // O período selecionado (30 dias) permanece, e nenhuma nova busca de métricas ocorreu
    expect(screen.getByRole('button', { name: /Últimos 30 dias/i })).toHaveClass('period-tab-btn--active');
    expect(mockRpc.mock.calls.filter(([name]) => name === 'get_tenant_financial_metrics')).toHaveLength(2);
  });

  it('deve recarregar os próprios dados de cada aba ao remontar por troca de rota (achado de revisão pós-merge)', async () => {
    // Caixa e Comissões são rotas-filhas (ticket 02/035): sair e voltar remonta o componente,
    // descartando o histórico local. `registerTabReload` só é chamado pela próxima busca do
    // painel (montagem, período ou tempo real) — sem busca própria no montagem da aba, o
    // histórico de quitações ficaria vazio até isso acontecer.
    mockRpc.mockResolvedValue({
      data: {
        total_revenue: 500,
        services_revenue: 400,
        products_revenue: 100,
        products_count: 1,
        products_cost: 20,
        total_commission: 100,
        paid_commission: 50,
        pending_commission: 50,
        net_revenue: 380,
        revenue_by_method: { pix: 500 },
        commissions_by_professional: [],
      },
      error: null,
    });

    renderHub('/financeiro/comissoes');
    await screen.findByText('Saldos de comissão por profissional');

    await waitFor(() => {
      expect(mockFrom.mock.calls.filter(([table]) => table === 'commission_payouts')).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole('link', { name: /Caixa diário e turnos/i }));
    await screen.findByText('Recebimentos por forma de pagamento');

    fireEvent.click(screen.getByRole('link', { name: /Repasses de comissões/i }));
    await screen.findByText('Saldos de comissão por profissional');

    // O remonte da aba Comissões refaz a própria busca, não só a que o painel dispara
    await waitFor(() => {
      expect(mockFrom.mock.calls.filter(([table]) => table === 'commission_payouts')).toHaveLength(2);
    });
  });

  it('deve permitir lançar vale de profissional a partir do Hub Financeiro (ticket 05)', async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === 'register_professional_advance') {
        return Promise.resolve({
          data: { success: true, entry_id: 'entry-1', professional_id: 'prof-1', amount: 50, cash_movement_id: null, cash_session_id: null },
          error: null,
        });
      }
      if (name === 'get_tenant_financial_metrics') {
        return Promise.resolve({
          data: {
            total_revenue: 1000.0,
            services_revenue: 800.0,
            products_revenue: 200.0,
            products_count: 4,
            products_cost: 80.0,
            total_commission: 300.0,
            paid_commission: 100.0,
            pending_commission: 200.0,
            net_revenue: 620.0,
            revenue_by_method: { pix: 1000.0 },
            commissions_by_professional: [
              {
                professional_id: 'prof-1',
                professional_name: 'Carlos Barbeiro',
                commission_sum: 300.0,
                paid_sum: 100.0,
                pending_sum: 200.0,
                appointments_count: 5,
              },
            ],
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    renderHub('/financeiro/caixa');

    await waitFor(() => {
      expect(screen.getByText(/Caixa diário e turnos/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('link', { name: /Repasses de comissões/i }));
    expect(await screen.findByText('Carlos Barbeiro')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Vale$/i }));

    const amountInput = await screen.findByLabelText('Valor do vale (R$) *');
    fireEvent.change(amountInput, { target: { value: '50,00' } });
    const reasonInput = screen.getByLabelText('Motivo *');
    fireEvent.change(reasonInput, { target: { value: 'Adiantamento para material de trabalho' } });

    fireEvent.click(screen.getByRole('button', { name: /Lançar vale/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith(
        'register_professional_advance',
        expect.objectContaining({
          p_professional_id: 'prof-1',
          p_amount: 50,
          p_reason: 'Adiantamento para material de trabalho',
          p_payment_method: 'pix',
        })
      );
    });
  });

  it('deve permitir trocar o período de consulta (30 dias, 90 dias)', async () => {
    mockRpc.mockResolvedValue({
      data: {
        total_revenue: 3000,
        services_revenue: 2500,
        products_revenue: 500,
        products_count: 5,
        products_cost: 200,
        total_commission: 1200,
        paid_commission: 400,
        pending_commission: 800,
        net_revenue: 1600,
        revenue_by_method: { pix: 3000 },
        commissions_by_professional: [],
      },
      error: null,
    });

    renderHub('/financeiro/caixa');

    await waitFor(() => {
      expect(mockRpc.mock.calls.filter(([name]) => name === 'get_tenant_financial_metrics')).toHaveLength(1);
    });

    const btn30d = screen.getByRole('button', { name: /Últimos 30 dias/i });
    fireEvent.click(btn30d);

    await waitFor(() => {
      expect(mockRpc.mock.calls.filter(([name]) => name === 'get_tenant_financial_metrics')).toHaveLength(2);
    });
  });

  it('deve permitir imprimir o extrato de uma sessão de caixa encerrada', async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === 'get_cash_session_statement') {
        return Promise.resolve({
          data: {
            session: {
              id: 'sess-1',
              tenant_id: 'test-tenant-123',
              status: 'closed',
            },
            adjustments: [],
            adjusted_difference_amount: 0,
            movements: [
              { id: 'mov-1', type: 'suprimento', direction: 'entrada', amount: 50, reason: 'Troco extra', performed_by: null, payout_id: null, professional_id: null, created_at: '2026-09-01T10:00:00Z', reversed_at: null, reversed_by: null, reversal_reason: null },
              { id: 'mov-2', type: 'sangria', direction: 'saida', amount: 30, reason: 'Retirada para o cofre', performed_by: null, payout_id: null, professional_id: null, created_at: '2026-09-01T11:00:00Z', reversed_at: null, reversed_by: null, reversal_reason: null },
              { id: 'mov-3', type: 'repasse_comissao', direction: 'saida', amount: 120, reason: 'Repasse Carlos', performed_by: null, payout_id: 'payout-1', professional_id: null, created_at: '2026-09-01T12:00:00Z', reversed_at: null, reversed_by: null, reversal_reason: null },
              { id: 'mov-4', type: 'vale_profissional', direction: 'saida', amount: 40, reason: 'Adiantamento Bruno', performed_by: null, payout_id: null, professional_id: 'prof-1', created_at: '2026-09-01T12:30:00Z', reversed_at: null, reversed_by: null, reversal_reason: null },
              { id: 'mov-5', type: 'ajuste_futuro', direction: 'entrada', amount: 15, reason: null, performed_by: null, payout_id: null, professional_id: null, created_at: '2026-09-01T12:45:00Z', reversed_at: null, reversed_by: null, reversal_reason: null },
            ],
            reopenings: [],
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const closedSessionRow = {
      id: 'sess-1',
      tenant_id: 'test-tenant-123',
      opened_by: 'user-1',
      closed_by: 'user-1',
      opened_at: '2026-09-01T08:00:00Z',
      closed_at: '2026-09-01T18:00:00Z',
      initial_amount: 100,
      closing_amount: 500,
      expected_amount: 500,
      difference_amount: 0,
      cash_received_amount: 300,
      pix_received_amount: 150,
      card_received_amount: 50,
      other_received_amount: 0,
      payment_count: 8,
      supplies_amount: 50,
      withdrawals_amount: 30,
      calculation_version: 'v1',
      status: 'closed' as const,
      notes: null,
      opened_user: { name: 'Ana Gerente' },
      closed_user: { name: 'Ana Gerente' },
    };

    const defaultTableChain = () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'cash_sessions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [closedSessionRow], error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return defaultTableChain();
    });

    renderHub('/financeiro/caixa');

    await waitFor(() => {
      expect(screen.getByText(/Caixa diário e turnos/i)).toBeInTheDocument();
    });

    const extratoBtn = await screen.findByRole('button', { name: /Extrato/i });
    fireEvent.click(extratoBtn);

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith(
        'get_cash_session_statement',
        expect.objectContaining({ p_session_id: 'sess-1', p_tenant_id: 'test-tenant-123' })
      );
    });

    expect(await screen.findByText('Troco extra')).toBeInTheDocument();
    expect(screen.getByText('Retirada para o cofre')).toBeInTheDocument();
    expect(screen.getByText('Repasse Carlos')).toBeInTheDocument();
    // Vale de profissional: ganha rótulo próprio e não some mais do extrato.
    expect(screen.getByText('Adiantamento Bruno')).toBeInTheDocument();
    // Tipo sem rótulo conhecido: cai num rótulo genérico pelo sentido, em vez
    // de ser omitido da folha impressa.
    expect(screen.getByText('Outra entrada')).toBeInTheDocument();
    expect(screen.getByText(/Sem diferença/)).toBeInTheDocument();

    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const printBtn = screen.getByRole('button', { name: /Imprimir/i });
    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it('deve disparar toast amigável e tratar erro caso a RPC falhe', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Acesso negado' },
    });

    renderHub('/financeiro/caixa');

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        'Não foi possível carregar os dados do painel financeiro.',
        'error'
      );
    });
  });
});
