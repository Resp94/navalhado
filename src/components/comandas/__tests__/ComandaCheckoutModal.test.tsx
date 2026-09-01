import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComandaCheckoutModal } from '../ComandaCheckoutModal';
import { ComandaRepository } from '../../../modules/comandas/ComandaRepository';
import { CaixaRepository } from '../../../modules/caixa/CaixaRepository';
import { ProdutoRepository } from '../../../modules/produtos/ProdutoRepository';
import type { IComandaAdapter } from '../../../modules/comandas/types';
import type { ICaixaAdapter } from '../../../modules/caixa/types';
import type { IProdutoAdapter } from '../../../modules/produtos/types';

const mockSupabaseUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }),
});

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'appointments') {
        return {
          update: mockSupabaseUpdate,
        };
      }
      return {
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      };
    }),
  },
}));

describe('ComandaCheckoutModal', () => {
  const mockComandaAdapter: IComandaAdapter = {
    obterPorId: vi.fn(),
    obterPorAppointmentId: vi.fn(),
    listarAbertas: vi.fn(),
    listarTodas: vi.fn(),
    criarComanda: vi.fn(),
    adicionarItem: vi.fn(),
    removerItem: vi.fn(),
    liquidarComanda: vi.fn(),
    reabrirComanda: vi.fn(),
  };

  const mockCaixaAdapter: ICaixaAdapter = {
    obterSessaoAtiva: vi.fn(),
    abrirCaixa: vi.fn(),
    fecharCaixa: vi.fn(),
    listarHistorico: vi.fn(),
    obterEntradasDinheiro: vi.fn(),
    obterResumoTurno: vi.fn(),
    registrarMovimentacao: vi.fn(),
    listarMovimentacoes: vi.fn(),
    obterResumoMovimentacoes: vi.fn(),
    obterResumoFinanceiroDiario: vi.fn(),
  };

  const mockProdutoAdapter: IProdutoAdapter = {
    listar: vi.fn(),
    listarAtivos: vi.fn(),
    salvarProduto: vi.fn(),
    ajustarEstoque: vi.fn(),
    buscarMovimentacoes: vi.fn(),
  };

  const comandaRepo = new ComandaRepository(mockComandaAdapter);
  const caixaRepo = new CaixaRepository(mockCaixaAdapter);
  const produtoRepo = new ProdutoRepository(mockProdutoAdapter);

  const mockOnClose = vi.fn();
  const mockOnFinalizado = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    const defaultProducts = [
      {
        id: 'prod-1',
        tenant_id: 't-1',
        name: 'Pomada Matte',
        product_type: 'retail' as const,
        unit_type: 'unidade' as const,
        min_stock_alert: 5,
        price: 30.0,
        cost_price: 15,
        stock_quantity: 5,
        is_active: true,
      },
    ];
    vi.mocked(mockProdutoAdapter.listar).mockResolvedValue(defaultProducts);
    vi.mocked(mockProdutoAdapter.listarAtivos).mockResolvedValue(defaultProducts);
    vi.mocked(mockCaixaAdapter.obterSessaoAtiva).mockResolvedValue({
      id: 'sess-1',
      tenant_id: 't-1',
      status: 'open',
      opened_at: new Date().toISOString(),
      initial_amount: 50,
      opened_by: null,
      closed_by: null,
      closed_at: null,
      closing_amount: null,
      notes: null,
    });
    vi.mocked(mockComandaAdapter.adicionarItem).mockImplementation(async (cId, tId, it) => ({
      id: `item-${Date.now()}`,
      comanda_id: cId,
      tenant_id: tId,
      item_type: it.item_type,
      service_id: it.service_id || null,
      product_id: it.product_id || null,
      professional_id: it.professional_id || null,
      name: it.name,
      quantity: it.quantity,
      unit_price: it.unit_price,
      total_price: it.quantity * it.unit_price,
    }));
    vi.mocked(mockComandaAdapter.removerItem).mockResolvedValue();
    vi.mocked(mockComandaAdapter.criarComanda).mockImplementation(async (input) => ({
      id: `com-${Date.now()}`,
      tenant_id: input.tenant_id,
      appointment_id: input.appointment_id || null,
      customer_id: input.customer_id || null,
      status: 'aberta',
      total_amount: input.itens.reduce((acc, it) => acc + it.quantity * it.unit_price, 0),
      discount_amount: 0,
      tip_amount: 0,
      notes: input.notes || null,
      itens: input.itens.map((it, idx) => ({
        id: `item-created-${idx}`,
        comanda_id: `com-created`,
        tenant_id: input.tenant_id,
        item_type: it.item_type,
        service_id: it.service_id || null,
        product_id: it.product_id || null,
        professional_id: it.professional_id || null,
        quantity: it.quantity,
        unit_price: it.unit_price,
        total_price: it.quantity * it.unit_price,
      })),
      pagamentos: [],
    }));
    vi.mocked(mockComandaAdapter.liquidarComanda).mockImplementation(async (input) => ({
      id: input.comanda_id,
      tenant_id: input.tenant_id,
      appointment_id: null,
      customer_id: null,
      status: 'fechada',
      total_amount: input.pagamentos.reduce((acc, p) => acc + p.amount, 0),
      discount_amount: input.discount_amount ?? 0,
      tip_amount: input.tip_amount ?? 0,
      notes: null,
      created_at: new Date().toISOString(),
      closed_at: new Date().toISOString(),
      itens: (input.itens || []).map((it, idx) => ({
        id: `item-liq-${idx}`,
        comanda_id: input.comanda_id,
        tenant_id: input.tenant_id,
        item_type: it.item_type,
        service_id: it.service_id || null,
        product_id: it.product_id || null,
        professional_id: it.professional_id || null,
        quantity: it.quantity,
        unit_price: it.unit_price,
        total_price: it.quantity * it.unit_price,
      })),
      pagamentos: input.pagamentos.map((p, idx) => ({
        id: `pag-liq-${idx}`,
        comanda_id: input.comanda_id,
        tenant_id: input.tenant_id,
        cash_session_id: input.cash_session_id ?? null,
        payment_method: p.payment_method,
        amount: p.amount,
        change_amount: 0,
        paid_at: new Date().toISOString(),
      })),
    }));
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

    expect(await screen.findByText('Corte Degradê')).toBeInTheDocument();
    expect(screen.getByText(/Comanda.*atendimento/i)).toBeInTheDocument();
    expect(screen.getByText('Carlos Silva')).toBeInTheDocument();
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

    vi.mocked(mockComandaAdapter.criarComanda).mockResolvedValueOnce({
      id: 'com-1',
      tenant_id: 't-1',
      appointment_id: 'apt-1',
      customer_id: 'cust-1',
      status: 'aberta',
      total_amount: 35.0,
      discount_amount: 0,
      tip_amount: 0,
      notes: null,
      created_at: new Date().toISOString(),
      closed_at: null,
      itens: [
        {
          id: 'item-1',
          tenant_id: 't-1',
          comanda_id: 'com-1',
          item_type: 'servico',
          service_id: 'srv-1',
          product_id: null,
          professional_id: 'prof-1',
          quantity: 1,
          unit_price: 35.0,
          total_price: 35.0,
        },
      ],
    });

    vi.mocked(mockComandaAdapter.liquidarComanda).mockResolvedValueOnce({
      id: 'com-1',
      tenant_id: 't-1',
      appointment_id: 'apt-1',
      customer_id: 'cust-1',
      status: 'fechada',
      total_amount: 35.0,
      discount_amount: 0,
      tip_amount: 0,
      notes: null,
      created_at: new Date().toISOString(),
      closed_at: new Date().toISOString(),
      itens: [],
      pagamentos: [],
    });

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

    expect(await screen.findByText('Corte Degradê')).toBeInTheDocument();
    const btnFinalizar = await screen.findByRole('button', { name: /Finalizar/i });
    await waitFor(() => expect(btnFinalizar).not.toBeDisabled());
    fireEvent.click(btnFinalizar);

    await waitFor(() => {
      expect(mockComandaAdapter.liquidarComanda).toHaveBeenCalled();
      expect(mockOnFinalizado).toHaveBeenCalled();
    });
  });

  it('exibe modal em modo recibo somente leitura quando a comanda estiver fechada e permite reabrir', async () => {
    vi.mocked(mockComandaAdapter.obterPorAppointmentId).mockResolvedValueOnce({
      id: 'com-1',
      tenant_id: 't-1',
      appointment_id: 'apt-1',
      customer_id: 'cust-1',
      status: 'fechada',
      total_amount: 40.0,
      discount_amount: 0,
      tip_amount: 5.0,
      notes: null,
      created_at: new Date().toISOString(),
      closed_at: new Date().toISOString(),
      itens: [
        {
          id: 'item-1',
          tenant_id: 't-1',
          comanda_id: 'com-1',
          item_type: 'servico',
          service_id: 'srv-1',
          product_id: null,
          professional_id: 'prof-1',
          name: 'Corte Degradê',
          quantity: 1,
          unit_price: 35.0,
          total_price: 35.0,
        },
      ],
      pagamentos: [
        {
          id: 'pag-1',
          tenant_id: 't-1',
          cash_session_id: 'sess-1',
          comanda_id: 'com-1',
          payment_method: 'pix',
          amount: 40.0,
          change_amount: 0,
        },
      ],
    });

    vi.mocked(mockComandaAdapter.reabrirComanda).mockResolvedValueOnce({
      id: 'com-1',
      tenant_id: 't-1',
      appointment_id: 'apt-1',
      customer_id: 'cust-1',
      status: 'aberta',
      total_amount: 40.0,
      discount_amount: 0,
      tip_amount: 0,
      notes: null,
      created_at: new Date().toISOString(),
      closed_at: null,
      itens: [],
      pagamentos: [],
    });

    render(
      <ComandaCheckoutModal
        isOpen={true}
        tenantId="t-1"
        appointmentId="apt-1"
        customerId="cust-1"
        customerName="Carlos Silva"
        onClose={mockOnClose}
        onFinalizado={mockOnFinalizado}
        comandaRepo={comandaRepo}
        caixaRepo={caixaRepo}
        produtoRepo={produtoRepo}
      />
    );

    expect(await screen.findByText(/Atendimento liquidado e pago/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reabrir comanda/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Reabrir comanda/i }));

    const confirmBtn = await screen.findByRole('button', { name: /Confirmar reabertura/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockComandaAdapter.reabrirComanda).toHaveBeenCalledWith('com-1', 't-1');
    });
  });

  it('persiste itens adicionados na liquidação de comanda pré-existente de agendamento', async () => {
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

    vi.mocked(mockComandaAdapter.obterPorAppointmentId).mockResolvedValueOnce({
      id: 'com-existing',
      tenant_id: 't-1',
      appointment_id: 'apt-1',
      customer_id: 'cust-1',
      status: 'aberta',
      total_amount: 40.0,
      discount_amount: 0,
      tip_amount: 0,
      notes: null,
      created_at: new Date().toISOString(),
      closed_at: null,
      itens: [
        {
          id: 'item-1',
          tenant_id: 't-1',
          comanda_id: 'com-existing',
          item_type: 'servico',
          service_id: 'srv-1',
          product_id: null,
          professional_id: 'prof-1',
          name: 'Corte',
          quantity: 1,
          unit_price: 40.0,
          total_price: 40.0,
        },
      ],
      pagamentos: [],
    });

    render(
      <ComandaCheckoutModal
        isOpen={true}
        tenantId="t-1"
        appointmentId="apt-1"
        customerId="cust-1"
        customerName="Erick Lohan"
        availableServices={[
          { id: 'srv-1', name: 'Corte', price: 40.0 },
          { id: 'srv-2', name: 'Sobrancelha', price: 15.0 },
        ]}
        availableProfessionals={[{ id: 'prof-1', name: 'Matheus Lopes' }]}
        onClose={mockOnClose}
        onFinalizado={mockOnFinalizado}
        comandaRepo={comandaRepo}
        caixaRepo={caixaRepo}
        produtoRepo={produtoRepo}
      />
    );

    expect(await screen.findByText('Corte')).toBeInTheDocument();

    // Adicionar serviço Sobrancelha
    fireEvent.click(screen.getByRole('button', { name: /Serviço/i }));
    const selectSrv = screen.getByRole('combobox', { name: /Selecionar serviço/i });
    fireEvent.change(selectSrv, { target: { value: 'srv-2' } });
    const btnAdd = screen.getByRole('button', { name: /^Adicionar$/i });
    fireEvent.click(btnAdd);

    await waitFor(() => {
      expect(mockComandaAdapter.adicionarItem).toHaveBeenCalledWith(
        'com-existing',
        't-1',
        expect.objectContaining({ service_id: 'srv-2', unit_price: 15.0 })
      );
    });

    expect(await screen.findByText('Sobrancelha')).toBeInTheDocument();

    // Finalizar comanda
    const btnFinalizar = await screen.findByRole('button', { name: /Finalizar/i });
    fireEvent.click(btnFinalizar);

    await waitFor(() => {
      expect(mockComandaAdapter.liquidarComanda).toHaveBeenCalledWith(
        expect.objectContaining({
          comanda_id: 'com-existing',
          tenant_id: 't-1',
          itens: expect.arrayContaining([
            expect.objectContaining({ service_id: 'srv-1', unit_price: 40.0 }),
            expect.objectContaining({ service_id: 'srv-2', unit_price: 15.0 }),
          ]),
          pagamentos: expect.arrayContaining([
            expect.objectContaining({ amount: 55.0 }),
          ]),
        })
      );
    });
  });

  it('permite abrir e liquidar comanda avulsa sem cliente cadastrado (Cliente Balcão)', async () => {
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

    vi.mocked(mockComandaAdapter.criarComanda).mockResolvedValueOnce({
      id: 'com-balcao-1',
      tenant_id: 't-1',
      appointment_id: null,
      customer_id: null,
      status: 'aberta',
      total_amount: 30.0,
      discount_amount: 0,
      tip_amount: 0,
      notes: null,
      created_at: new Date().toISOString(),
      closed_at: null,
      itens: [],
      pagamentos: [],
    });

    vi.mocked(mockComandaAdapter.liquidarComanda).mockResolvedValueOnce({
      id: 'com-balcao-1',
      tenant_id: 't-1',
      appointment_id: null,
      customer_id: null,
      status: 'fechada',
      total_amount: 30.0,
      discount_amount: 0,
      tip_amount: 0,
      notes: null,
      created_at: new Date().toISOString(),
      closed_at: new Date().toISOString(),
      itens: [],
      pagamentos: [],
    });

    render(
      <ComandaCheckoutModal
        isOpen={true}
        tenantId="t-1"
        customerId={null}
        initialServices={[
          { service_id: 'srv-1', name: 'Corte Tradicional', price: 30.0, professional_id: 'prof-1' },
        ]}
        availableServices={[
          { id: 'srv-1', name: 'Corte Tradicional', price: 30.0 },
        ]}
        availableProfessionals={[{ id: 'prof-1', name: 'Carlos Barbeiro' }]}
        onClose={mockOnClose}
        onFinalizado={mockOnFinalizado}
        comandaRepo={comandaRepo}
        caixaRepo={caixaRepo}
        produtoRepo={produtoRepo}
      />
    );

    expect(await screen.findByText(/Cliente Balcão/i)).toBeInTheDocument();
    expect(await screen.findByText('Corte Tradicional')).toBeInTheDocument();

    const btnFinalizar = await screen.findByRole('button', { name: /Finalizar/i });
    fireEvent.click(btnFinalizar);

    await waitFor(() => {
      expect(mockComandaAdapter.criarComanda).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 't-1',
          customer_id: null,
        })
      );
    });
  });

  it('persiste imediatamente novo serviço ou produto adicionado em comanda aberta', async () => {
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

    vi.mocked(mockComandaAdapter.obterPorId).mockResolvedValueOnce({
      id: 'com-123',
      tenant_id: 't-1',
      appointment_id: null,
      customer_id: 'cust-1',
      status: 'aberta',
      total_amount: 40.0,
      discount_amount: 0,
      tip_amount: 0,
      notes: null,
      created_at: new Date().toISOString(),
      closed_at: null,
      itens: [
        {
          id: 'item-corte',
          comanda_id: 'com-123',
          tenant_id: 't-1',
          item_type: 'servico',
          service_id: 'srv-1',
          product_id: null,
          professional_id: 'prof-1',
          quantity: 1,
          unit_price: 40.0,
          total_price: 40.0,
        },
      ],
      pagamentos: [],
    });

    render(
      <ComandaCheckoutModal
        isOpen={true}
        tenantId="t-1"
        comandaId="com-123"
        customerId="cust-1"
        customerName="João Silva"
        availableServices={[
          { id: 'srv-1', name: 'Corte', price: 40.0 },
          { id: 'srv-2', name: 'Barba', price: 25.0 },
        ]}
        availableProfessionals={[{ id: 'prof-1', name: 'Carlos Barbeiro' }]}
        onClose={mockOnClose}
        onFinalizado={mockOnFinalizado}
        comandaRepo={comandaRepo}
        caixaRepo={caixaRepo}
        produtoRepo={produtoRepo}
      />
    );

    expect(await screen.findByText('Corte')).toBeInTheDocument();

    // 1. Adicionar serviço Barba
    fireEvent.click(screen.getByRole('button', { name: /Serviço/i }));
    const selectSrv = screen.getByRole('combobox', { name: /Selecionar serviço/i });
    fireEvent.change(selectSrv, { target: { value: 'srv-2' } });
    fireEvent.click(screen.getByRole('button', { name: /^Adicionar$/i }));

    await waitFor(() => {
      expect(mockComandaAdapter.adicionarItem).toHaveBeenCalledWith(
        'com-123',
        't-1',
        expect.objectContaining({
          item_type: 'servico',
          service_id: 'srv-2',
          unit_price: 25.0,
        })
      );
    });

    // 2. Adicionar produto Pomada Matte
    fireEvent.click(screen.getByRole('button', { name: /Produto/i }));
    const selectProd = screen.getByRole('combobox', { name: /Selecionar produto/i });
    fireEvent.change(selectProd, { target: { value: 'prod-1' } });
    fireEvent.click(screen.getByRole('button', { name: /^Adicionar$/i }));

    await waitFor(() => {
      expect(mockComandaAdapter.adicionarItem).toHaveBeenCalledWith(
        'com-123',
        't-1',
        expect.objectContaining({
          item_type: 'produto',
          product_id: 'prod-1',
          unit_price: 30.0,
        })
      );
    });

    // 3. Remover item Corte da comanda
    const removeButtons = screen.getAllByTitle(/Remover item/i);
    expect(removeButtons.length).toBeGreaterThan(0);
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(mockComandaAdapter.removerItem).toHaveBeenCalledWith('item-corte', 'com-123');
    });
  });

  it('deve permitir abrir painel de reagendamento direto e salvar novo horário mantendo a comanda aberta', async () => {
    const mockOnRescheduled = vi.fn();
    mockComandaAdapter.obterPorAppointmentId = vi.fn().mockResolvedValue({
      id: 'com-123',
      tenant_id: 't-1',
      appointment_id: 'app-999',
      customer_id: 'cust-1',
      status: 'aberta',
      total_amount: 35.0,
      discount_amount: 0,
      tip_amount: 0,
      itens: [
        {
          id: 'item-corte',
          comanda_id: 'com-123',
          tenant_id: 't-1',
          item_type: 'servico',
          service_id: 'srv-1',
          name: 'Corte Tradicional',
          quantity: 1,
          unit_price: 35.0,
          total_price: 35.0,
          professional_id: 'prof-1',
        },
      ],
      pagamentos: [],
    });

    render(
      <ComandaCheckoutModal
        isOpen={true}
        tenantId="t-1"
        appointmentId="app-999"
        appointmentStartTime="2026-08-28T14:00:00.000Z"
        appointmentServiceName="Corte Tradicional"
        customerName="Carlos Silva"
        availableProfessionals={[{ id: 'prof-1', name: 'Carlos Barbeiro' }, { id: 'prof-2', name: 'Marcos Navalha' }]}
        onClose={mockOnClose}
        onFinalizado={mockOnFinalizado}
        onRescheduled={mockOnRescheduled}
        comandaRepo={comandaRepo}
        caixaRepo={caixaRepo}
        produtoRepo={produtoRepo}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Carlos Silva')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reagendar atendimento/i })).toBeInTheDocument();
    });

    // 1. Clicar no botão "Reagendar"
    fireEvent.click(screen.getByRole('button', { name: /Reagendar atendimento/i }));

    // 2. Painel de reagendamento abre
    expect(screen.getByRole('region', { name: /Painel de Reagendamento de Atendimento/i })).toBeInTheDocument();

    const dateInput = screen.getByLabelText(/Nova Data:/i);
    const timeInput = screen.getByLabelText(/Novo Horário:/i);

    fireEvent.change(dateInput, { target: { value: '2026-08-29' } });
    fireEvent.change(timeInput, { target: { value: '16:30' } });

    // 3. Confirmar Reagendamento
    const confirmBtn = screen.getByRole('button', { name: /Confirmar Reagendamento/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          start_time: expect.any(String),
          end_time: expect.any(String),
          updated_at: expect.any(String),
        })
      );
      expect(mockOnRescheduled).toHaveBeenCalled();
    });
  });
});
