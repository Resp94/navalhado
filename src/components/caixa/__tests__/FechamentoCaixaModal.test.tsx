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
    obterResumoTurno: vi.fn(),
    registrarMovimentacao: vi.fn(),
    registrarMovimentoManual: vi.fn(),
    listarMovimentacoes: vi.fn(),
    obterResumoMovimentacoes: vi.fn(),
    reabrirCaixa: vi.fn(),
    registrarAjuste: vi.fn(),
    obterExtrato: vi.fn(),
    obterResumoFinanceiroDiario: vi.fn(),
    obterValorEsperadoGaveta: vi.fn(),
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
        expectedDrawerAmount={150.0}
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
        tenant_id: 'tenant-123',
        closed_by: 'user-operator',
        closing_amount: 250.0,
        notes: 'Fechado sem problemas',
      });
      expect(mockOnCaixaFechado).toHaveBeenCalledWith(closedSession);
    });
  });

  it('mostra o valor esperado apurado pelo contrato do banco, não recomposto no navegador (ticket 02/036)', async () => {
    // Repasse de comissão e vale em dinheiro não chegam como suprimento/sangria: só o contrato do
    // banco os desconta. Se o modal ainda recompusesse a fórmula com initial+cashReceipts, o
    // valor exibido seria 100 + 300 = 400, não os 150 apurados pelo contrato.
    vi.mocked(mockAdapter.obterValorEsperadoGaveta).mockResolvedValueOnce({
      session_id: 'sess-100',
      tenant_id: 'tenant-123',
      initial_amount: 100,
      cash_received: 300,
      inflow_amount: 0,
      outflow_amount: 250,
      expected_amount: 150,
      movements_by_type: [
        { type: 'repasse_comissao', direction: 'saida', amount: 200 },
        { type: 'vale_profissional', direction: 'saida', amount: 50 },
      ],
    });

    render(
      <FechamentoCaixaModal
        isOpen={true}
        session={fakeActiveSession}
        cashReceipts={300}
        onCaixaFechado={mockOnCaixaFechado}
        onClose={mockOnClose}
        caixaRepo={mockRepo}
      />
    );

    await waitFor(() => {
      expect(mockAdapter.obterValorEsperadoGaveta).toHaveBeenCalledWith('sess-100', 'tenant-123');
    });

    await waitFor(() => {
      expect(document.querySelector('.caixa-val-highlight')).toHaveTextContent(/R\$\s*150,00/);
    });
    expect(screen.queryByText(/R\$\s*400,00/)).not.toBeInTheDocument();
  });

  it('bloqueia o fechamento quando a apuração do valor esperado falha (achado de revisão pós-merge)', async () => {
    // Um R$ 0,00 falso numa tela de conferência de dinheiro físico é o defeito que este teste
    // impede de voltar: sem apuração confiável, "Encerrar turno e fechar caixa" fica desabilitado.
    vi.mocked(mockAdapter.obterValorEsperadoGaveta).mockRejectedValueOnce(
      new Error('Erro ao apurar valor esperado da gaveta: falha de rede.')
    );

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

    await waitFor(() => {
      expect(screen.getByText(/Não foi possível apurar o valor esperado da gaveta/i)).toBeDefined();
    });

    const submitBtn = screen.getByRole('button', { name: /Encerrar turno e fechar caixa/i });
    expect(submitBtn).toBeDisabled();

    fireEvent.click(submitBtn);
    expect(mockAdapter.fecharCaixa).not.toHaveBeenCalled();

    // Tentar de novo com sucesso libera o fechamento.
    vi.mocked(mockAdapter.obterValorEsperadoGaveta).mockResolvedValueOnce({
      session_id: 'sess-100',
      tenant_id: 'tenant-123',
      initial_amount: 100,
      cash_received: 50,
      inflow_amount: 0,
      outflow_amount: 0,
      expected_amount: 150,
      movements_by_type: [],
    });

    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Encerrar turno e fechar caixa/i })).not.toBeDisabled();
    });
  });
});
