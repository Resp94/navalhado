import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MinhasComissoes } from '../MinhasComissoes';

const { mockAddToast, mockOutletContext, mockRpc, mockAdvancesResult, mockSupabaseClient } = vi.hoisted(() => {
  const mockRpc = vi.fn();
  const mockAdvancesResult = vi.fn();
  return {
    mockAddToast: vi.fn(),
    mockRpc,
    mockAdvancesResult,
    mockOutletContext: {
      tenantId: 'tenant-1',
      tenantName: 'Barbearia Alpha',
      logoUrl: null,
      timezone: 'America/Sao_Paulo',
      professionalId: 'prof-me',
      professionalName: 'Diego Barbeiro',
    },
    mockSupabaseClient: {
      rpc: (...args: unknown[]) => mockRpc(...args),
      from: vi.fn(),
    },
  };
});

vi.mock('react-router-dom', () => ({
  useOutletContext: () => mockOutletContext,
}));

vi.mock('../../../components/Toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

const item = (overrides: Record<string, unknown> = {}) => ({
  item_id: 'item-1',
  comanda_id: 'cmd-1',
  accrued_at: '2026-09-19T15:00:00.000Z',
  customer_name: 'Lucas Silva',
  item_type: 'servico',
  item_name: 'Corte Degradê',
  net_amount: 50,
  commission_percentage: 40,
  commission_amount: 20,
  ...overrides,
});

const rpcCalls = (fn: string) => mockRpc.mock.calls.filter(([name]) => name === fn);

describe('MinhasComissoes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOutletContext.professionalId = 'prof-me';
    mockAdvancesResult.mockReturnValue({ data: [], error: null });
    mockRpc.mockImplementation(async (fn: string) => {
      if (fn === 'get_professional_commission_balance') {
        return {
          data: { generated_commission: 30, suggested_net_amount: 12.5, current_open_balance: 30, paid_commission: 0 },
          error: null,
        };
      }
      if (fn === 'get_professional_commission_items') {
        return {
          data: [
            item(),
            item({
              item_id: 'item-2',
              comanda_id: 'cmd-2',
              customer_name: null,
              item_name: 'Pomada Matte',
              net_amount: 100,
              commission_percentage: 10,
              commission_amount: 10,
            }),
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    });
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'professional_account_entries') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ order: () => Promise.resolve(mockAdvancesResult()) }),
            }),
          }),
        };
      }
      throw new Error(`Tabela inesperada: ${table}`);
    });
  });

  it('mostra a comissão gravada, a receita e o saldo a receber vindos do banco', async () => {
    render(<MinhasComissoes />);

    await waitFor(() => expect(screen.getByText(/R\$\s*30,00/)).toBeInTheDocument());
    // Receita: 50 + 100
    expect(screen.getByText(/R\$\s*150,00/)).toBeInTheDocument();
    // A receber: saldo sugerido (comissões e gorjetas em aberto, menos vales)
    expect(screen.getByText(/R\$\s*12,50/)).toBeInTheDocument();
  });

  it('lista os itens pelo valor e pela porcentagem gravados, com Cliente Balcão para o cliente anônimo', async () => {
    render(<MinhasComissoes />);

    await waitFor(() => expect(screen.getAllByText('Corte Degradê').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Lucas Silva').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cliente Balcão').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pomada Matte').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/R\$\s*20,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('40%').length).toBeGreaterThan(0);
  });

  it('não recalcula: o valor exibido é o do banco mesmo que não bata com a porcentagem', async () => {
    // O banco gravou R$ 7,00 sobre R$ 50,00 (14%): a tela mostra o que foi gravado.
    mockRpc.mockImplementation(async (fn: string) => {
      if (fn === 'get_professional_commission_balance') {
        return { data: { generated_commission: 7, suggested_net_amount: 7 }, error: null };
      }
      return {
        data: [item({ net_amount: 50, commission_percentage: 14, commission_amount: 7 })],
        error: null,
      };
    });

    render(<MinhasComissoes />);

    await waitFor(() => expect(screen.getAllByText(/R\$\s*7,00/).length).toBeGreaterThan(0));
    expect(screen.queryByText(/R\$\s*25,00/)).not.toBeInTheDocument();
  });

  it('consulta pelo profissional e pela barbearia do vínculo, no fuso da barbearia', async () => {
    render(<MinhasComissoes />);

    await waitFor(() => expect(rpcCalls('get_professional_commission_items')).toHaveLength(1));
    const [, params] = rpcCalls('get_professional_commission_items')[0];
    expect(params).toMatchObject({ p_professional_id: 'prof-me', p_tenant_id: 'tenant-1' });
    // O recorte começa à meia-noite do dia 1 da barbearia (03:00 UTC em São Paulo).
    expect(String(params.p_start_date)).toMatch(/T03:00:00\.000Z$/);
    expect(rpcCalls('get_professional_commission_balance')[0][1]).toMatchObject({
      p_professional_id: 'prof-me',
      p_tenant_id: 'tenant-1',
    });
  });

  it('refaz a consulta ao trocar o período', async () => {
    render(<MinhasComissoes />);
    await waitFor(() => expect(rpcCalls('get_professional_commission_items')).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }));

    await waitFor(() => expect(rpcCalls('get_professional_commission_items')).toHaveLength(2));
    expect(screen.getByRole('button', { name: 'Hoje' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('mostra a recusa do banco como mensagem clara, sem totais', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Acesso negado para este extrato.', code: '42501' } });

    render(<MinhasComissoes />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso negado para este extrato.');
    expect(mockAddToast).toHaveBeenCalledWith('Acesso negado para este extrato.', 'error');
    expect(screen.queryByText('Comissão do período')).not.toBeInTheDocument();
  });

  it('sem cadastro de profissional vinculado, mostra o aviso e não consulta o banco', async () => {
    mockOutletContext.professionalId = '';

    render(<MinhasComissoes />);

    expect(screen.getByText('Acesso não vinculado')).toBeInTheDocument();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('período sem comissão mostra o estado vazio e totais zerados', async () => {
    mockRpc.mockImplementation(async (fn: string) =>
      fn === 'get_professional_commission_balance'
        ? { data: { generated_commission: 0, suggested_net_amount: 0 }, error: null }
        : { data: [], error: null }
    );

    render(<MinhasComissoes />);

    expect(await screen.findByText('Nenhum atendimento com comissão registrada neste período.')).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s*0,00/)).toHaveLength(3);
  });

  it('exibe os vales em aberto do próprio profissional', async () => {
    mockAdvancesResult.mockReturnValue({
      data: [
        {
          id: 'entry-1',
          tenant_id: 'tenant-1',
          professional_id: 'prof-me',
          entry_type: 'vale',
          direction: 'debit',
          amount: 30,
          settled_amount: 0,
          status: 'open',
          reason: 'Adiantamento para material de trabalho',
          comanda_id: null,
          cash_movement_id: null,
          created_by: 'user-1',
          created_at: '2026-09-12T10:00:00Z',
          reversed_at: null,
          reversed_by: null,
          reversal_reason: null,
        },
      ],
      error: null,
    });

    render(<MinhasComissoes />);

    expect(await screen.findByText('Vales em aberto')).toBeInTheDocument();
    expect(screen.getByText('Adiantamento para material de trabalho')).toBeInTheDocument();
  });

  it('não exibe a seção de vales quando não há nenhum em aberto', async () => {
    render(<MinhasComissoes />);

    await waitFor(() => expect(screen.getByText(/R\$\s*30,00/)).toBeInTheDocument());
    expect(screen.queryByText('Vales em aberto')).not.toBeInTheDocument();
  });
});
