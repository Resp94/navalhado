import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseContasPagarAdapter } from '../SupabaseContasPagarAdapter';
import { ContasPagarValidationError } from '../../ContasPagarRepository';

function novoSupabaseMock() {
  return { rpc: vi.fn() } as unknown as SupabaseClient & { rpc: ReturnType<typeof vi.fn> };
}

describe('SupabaseContasPagarAdapter — criarContaAvulsa', () => {
  it('chama create_payable com os parâmetros mapeados e devolve a conta criada', async () => {
    const supabase = novoSupabaseMock();
    const conta = { id: 'conta-1', tenant_id: 'tenant-1', description: 'Aluguel' };
    supabase.rpc.mockResolvedValueOnce({ data: conta, error: null });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    const resultado = await adapter.criarContaAvulsa('tenant-1', {
      description: 'Aluguel',
      categoryId: 'cat-1',
      amount: 1200,
      dueDate: '2026-09-30',
      supplierId: 'sup-1',
      competenceDate: '2026-09-30',
      documentNumber: 'NF-1',
      notes: 'obs',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('create_payable', {
      p_description: 'Aluguel',
      p_category_id: 'cat-1',
      p_amount: 1200,
      p_due_date: '2026-09-30',
      p_supplier_id: 'sup-1',
      p_competence_date: '2026-09-30',
      p_document_number: 'NF-1',
      p_notes: 'obs',
      p_tenant_id: 'tenant-1',
    });
    expect(resultado).toBe(conta);
  });

  it('envia null para campos opcionais ausentes', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({ data: { id: 'conta-1' }, error: null });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    await adapter.criarContaAvulsa('tenant-1', {
      description: 'Aluguel',
      categoryId: 'cat-1',
      amount: 1200,
      dueDate: '2026-09-30',
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'create_payable',
      expect.objectContaining({
        p_supplier_id: null,
        p_competence_date: null,
        p_document_number: null,
        p_notes: null,
      })
    );
  });

  it('traduz erro do Postgres em ContasPagarValidationError', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'Categoria de despesa arquivada.' },
    });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    await expect(
      adapter.criarContaAvulsa('tenant-1', {
        description: 'Aluguel',
        categoryId: 'cat-1',
        amount: 1200,
        dueDate: '2026-09-30',
      })
    ).rejects.toThrow(ContasPagarValidationError);
    await expect(
      adapter.criarContaAvulsa('tenant-1', {
        description: 'Aluguel',
        categoryId: 'cat-1',
        amount: 1200,
        dueDate: '2026-09-30',
      })
    ).rejects.toThrow('Categoria de despesa arquivada.');
  });
});

describe('SupabaseContasPagarAdapter — listarContas', () => {
  it('chama list_payables com os parâmetros mapeados', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({ data: [], error: null });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    await adapter.listarContas('tenant-1', {
      dueDateFrom: '2026-09-01',
      dueDateTo: '2026-09-30',
      status: 'overdue',
      page: 2,
      pageSize: 10,
    });

    expect(supabase.rpc).toHaveBeenCalledWith('list_payables', {
      p_due_date_from: '2026-09-01',
      p_due_date_to: '2026-09-30',
      p_status: 'overdue',
      p_page: 2,
      p_page_size: 10,
      p_tenant_id: 'tenant-1',
      p_category_id: null,
      p_supplier_id: null,
    });
  });

  it('mapeia linhas numéricas (string→number) e extrai o total de linha zero', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({
      data: [
        {
          id: 'conta-1',
          description: 'Aluguel',
          category_id: 'cat-1',
          category_name: 'Aluguel e condomínio',
          category_archived: false,
          supplier_id: null,
          supplier_name: null,
          supplier_archived: null,
          amount: '1200.00',
          paid_amount: '0.00',
          remaining_amount: '1200.00',
          status: 'open',
          situation: 'open',
          highlight: null,
          due_date: '2026-09-30',
          competence_date: '2026-09-30',
          document_number: null,
          notes: null,
          series_id: null,
          series_position: null,
          created_at: '2026-09-13T10:00:00Z',
          total_count: '3',
        },
      ],
      error: null,
    });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    const resultado = await adapter.listarContas('tenant-1', {});

    expect(resultado.totalCount).toBe(3);
    expect(resultado.contas[0]).toMatchObject({
      id: 'conta-1',
      amount: 1200,
      paid_amount: 0,
      remaining_amount: 1200,
    });
  });

  it('devolve lista vazia e total zero quando não há linhas', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({ data: [], error: null });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    const resultado = await adapter.listarContas('tenant-1', {});

    expect(resultado.contas).toEqual([]);
    expect(resultado.totalCount).toBe(0);
  });

  it('traduz erro do Postgres em ContasPagarValidationError', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'Acesso negado.' },
    });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    await expect(adapter.listarContas('tenant-1', {})).rejects.toThrow(ContasPagarValidationError);
  });
});

const LINHA_LISTA_BASE = {
  id: 'conta-1',
  description: 'Aluguel',
  category_id: 'cat-1',
  category_name: 'Aluguel e condomínio',
  category_archived: false,
  supplier_id: null,
  supplier_name: null,
  supplier_archived: null,
  amount: '100.00',
  paid_amount: '0.00',
  remaining_amount: '100.00',
  status: 'open',
  situation: 'open',
  highlight: null,
  due_date: '2026-09-30',
  competence_date: '2026-09-30',
  document_number: null,
  notes: null,
  series_id: null,
  series_position: null,
};

describe('SupabaseContasPagarAdapter — obterConta', () => {
  it('chama get_payable com os parâmetros mapeados e devolve o detalhe mapeado', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({
      data: [
        {
          ...LINHA_LISTA_BASE,
          created_at: '2026-09-13T10:00:00Z',
          created_by: 'user-1',
          created_by_name: 'Fulano',
          updated_at: '2026-09-13T10:00:00Z',
          updated_by: 'user-1',
          updated_by_name: 'Fulano',
          cancelled_at: null,
          cancelled_by: null,
          cancelled_by_name: null,
          cancellation_reason: null,
        },
      ],
      error: null,
    });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    const resultado = await adapter.obterConta('tenant-1', 'conta-1');

    expect(supabase.rpc).toHaveBeenCalledWith('get_payable', {
      p_payable_id: 'conta-1',
      p_tenant_id: 'tenant-1',
    });
    expect(resultado).toMatchObject({
      id: 'conta-1',
      amount: 100,
      createdByName: 'Fulano',
      updatedByName: 'Fulano',
      cancelledByName: null,
    });
  });

  it('recusa quando a RPC não devolve linha', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({ data: [], error: null });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    await expect(adapter.obterConta('tenant-1', 'conta-1')).rejects.toThrow(
      ContasPagarValidationError
    );
  });

  it('traduz erro do Postgres em ContasPagarValidationError', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'Conta a pagar não encontrada.' },
    });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    await expect(adapter.obterConta('tenant-1', 'conta-1')).rejects.toThrow(
      ContasPagarValidationError
    );
  });
});

const BAIXA_ROW_BASE = {
  id: 'baixa-1',
  principal: '100.00',
  interest_amount: '0.00',
  discount_amount: '0.00',
  paid_amount: '100.00',
  payment_date: '2026-09-14',
  payment_method: 'pix',
  source: 'fora_do_caixa',
  created_at: '2026-09-14T10:00:00Z',
  created_by: 'user-1',
  reversed_at: null,
  reversed_by: null,
  reversal_reason: null,
};

describe('SupabaseContasPagarAdapter — darBaixa', () => {
  it('chama settle_payable com os parâmetros mapeados e devolve a Baixa mapeada', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({ data: BAIXA_ROW_BASE, error: null });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    const resultado = await adapter.darBaixa('tenant-1', 'conta-1', {
      principal: 100,
      interestAmount: 0,
      discountAmount: 0,
      paymentDate: '2026-09-14',
      paymentMethod: 'pix',
      source: 'fora_do_caixa',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('settle_payable', {
      p_payable_id: 'conta-1',
      p_principal: 100,
      p_payment_date: '2026-09-14',
      p_payment_method: 'pix',
      p_interest_amount: 0,
      p_discount_amount: 0,
      p_source: 'fora_do_caixa',
      p_cash_session_id: null,
      p_tenant_id: 'tenant-1',
    });
    expect(resultado).toMatchObject({ id: 'baixa-1', principal: 100, paidAmount: 100 });
  });

  it('traduz erro do Postgres em ContasPagarValidationError', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '22023', message: 'Baixa pela gaveta ainda não está disponível.' },
    });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    await expect(
      adapter.darBaixa('tenant-1', 'conta-1', {
        principal: 100,
        paymentDate: '2026-09-14',
        paymentMethod: 'cash',
        source: 'gaveta',
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });
});

describe('SupabaseContasPagarAdapter — estornarBaixa', () => {
  it('chama reverse_payable_settlement com os parâmetros mapeados', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({
      data: { ...BAIXA_ROW_BASE, reversed_at: '2026-09-14T11:00:00Z', reversed_by: 'user-1', reversal_reason: 'engano' },
      error: null,
    });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    const resultado = await adapter.estornarBaixa('tenant-1', 'baixa-1', 'lançada por engano');

    expect(supabase.rpc).toHaveBeenCalledWith('reverse_payable_settlement', {
      p_settlement_id: 'baixa-1',
      p_reason: 'lançada por engano',
      p_tenant_id: 'tenant-1',
    });
    expect(resultado.reversalReason).toBe('engano');
  });

  it('traduz erro do Postgres em ContasPagarValidationError', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'Esta Baixa já foi estornada.' },
    });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    await expect(adapter.estornarBaixa('tenant-1', 'baixa-1', 'motivo')).rejects.toThrow(
      ContasPagarValidationError
    );
  });
});

describe('SupabaseContasPagarAdapter — listarBaixas', () => {
  it('chama list_payable_settlements e mapeia as linhas', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({
      data: [
        { ...BAIXA_ROW_BASE, created_by_name: 'Fulano' },
        { ...BAIXA_ROW_BASE, id: 'baixa-2', created_by_name: 'Fulano' },
      ],
      error: null,
    });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    const resultado = await adapter.listarBaixas('tenant-1', 'conta-1');

    expect(supabase.rpc).toHaveBeenCalledWith('list_payable_settlements', {
      p_payable_id: 'conta-1',
      p_tenant_id: 'tenant-1',
    });
    expect(resultado).toHaveLength(2);
    expect(resultado[0]).toMatchObject({ id: 'baixa-1', createdByName: 'Fulano' });
  });

  it('devolve lista vazia quando não há Baixas', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({ data: [], error: null });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    const resultado = await adapter.listarBaixas('tenant-1', 'conta-1');

    expect(resultado).toEqual([]);
  });

  it('traduz erro do Postgres em ContasPagarValidationError', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'Conta a pagar não encontrada.' },
    });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    await expect(adapter.listarBaixas('tenant-1', 'conta-1')).rejects.toThrow(
      ContasPagarValidationError
    );
  });
});

describe('SupabaseContasPagarAdapter — editarConta', () => {
  it('chama update_payable com os parâmetros mapeados e devolve a conta editada', async () => {
    const supabase = novoSupabaseMock();
    const conta = { id: 'conta-1', description: 'Aluguel Editado' };
    supabase.rpc.mockResolvedValueOnce({ data: conta, error: null });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    const resultado = await adapter.editarConta('tenant-1', 'conta-1', {
      description: 'Aluguel Editado',
      categoryId: 'cat-1',
      amount: 1200,
      dueDate: '2026-10-30',
      supplierId: 'sup-1',
      competenceDate: '2026-10-30',
      documentNumber: 'NF-1',
      notes: 'obs',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('update_payable', {
      p_payable_id: 'conta-1',
      p_description: 'Aluguel Editado',
      p_category_id: 'cat-1',
      p_amount: 1200,
      p_due_date: '2026-10-30',
      p_supplier_id: 'sup-1',
      p_competence_date: '2026-10-30',
      p_document_number: 'NF-1',
      p_notes: 'obs',
      p_tenant_id: 'tenant-1',
    });
    expect(resultado).toBe(conta);
  });

  it('traduz erro do Postgres em ContasPagarValidationError', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'O valor não pode ser alterado numa conta parcialmente paga ou paga.' },
    });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    await expect(
      adapter.editarConta('tenant-1', 'conta-1', {
        description: 'Aluguel',
        categoryId: 'cat-1',
        amount: 999,
        dueDate: '2026-10-30',
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });
});

describe('SupabaseContasPagarAdapter — cancelarConta', () => {
  it('chama cancel_payable com os parâmetros mapeados e devolve a conta cancelada', async () => {
    const supabase = novoSupabaseMock();
    const conta = { id: 'conta-1', status: 'cancelled' };
    supabase.rpc.mockResolvedValueOnce({ data: conta, error: null });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    const resultado = await adapter.cancelarConta('tenant-1', 'conta-1', 'lançada em duplicidade');

    expect(supabase.rpc).toHaveBeenCalledWith('cancel_payable', {
      p_payable_id: 'conta-1',
      p_reason: 'lançada em duplicidade',
      p_tenant_id: 'tenant-1',
    });
    expect(resultado).toBe(conta);
  });

  it('traduz erro do Postgres em ContasPagarValidationError', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'Não é possível cancelar uma conta com Baixa ativa.' },
    });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    await expect(adapter.cancelarConta('tenant-1', 'conta-1', 'motivo valido')).rejects.toThrow(
      ContasPagarValidationError
    );
  });
});

describe('SupabaseContasPagarAdapter — listarContas (filtro de categoria e fornecedor)', () => {
  it('chama list_payables com p_category_id e p_supplier_id', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({ data: [], error: null });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    await adapter.listarContas('tenant-1', { categoryId: 'cat-1', supplierId: 'sup-1' });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'list_payables',
      expect.objectContaining({ p_category_id: 'cat-1', p_supplier_id: 'sup-1' })
    );
  });
});

describe('SupabaseContasPagarAdapter — obterTotais', () => {
  it('chama get_payables_totals com os parâmetros mapeados e devolve os totais mapeados', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({
      data: [{ open_balance: '100.00', overdue_balance: '40.00', paid_in_period: '60.00' }],
      error: null,
    });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    const resultado = await adapter.obterTotais('tenant-1', {
      dueDateFrom: '2026-09-01',
      dueDateTo: '2026-09-30',
      categoryId: 'cat-1',
      supplierId: 'sup-1',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('get_payables_totals', {
      p_due_date_from: '2026-09-01',
      p_due_date_to: '2026-09-30',
      p_category_id: 'cat-1',
      p_supplier_id: 'sup-1',
      p_tenant_id: 'tenant-1',
    });
    expect(resultado).toEqual({ openBalance: 100, overdueBalance: 40, paidInPeriod: 60 });
  });

  it('devolve zeros quando a RPC não devolve linha', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({ data: [], error: null });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    const resultado = await adapter.obterTotais('tenant-1', {});

    expect(resultado).toEqual({ openBalance: 0, overdueBalance: 0, paidInPeriod: 0 });
  });

  it('traduz erro do Postgres em ContasPagarValidationError', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'Acesso negado.' },
    });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    await expect(adapter.obterTotais('tenant-1', {})).rejects.toThrow(ContasPagarValidationError);
  });
});

describe('SupabaseContasPagarAdapter — obterAlerta', () => {
  it('chama get_payables_alert e devolve o alerta mapeado', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({
      data: [{ overdue_count: '2', overdue_balance: '300.00', due_today_count: '1', due_today_balance: '50.00' }],
      error: null,
    });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    const resultado = await adapter.obterAlerta('tenant-1');

    expect(supabase.rpc).toHaveBeenCalledWith('get_payables_alert', { p_tenant_id: 'tenant-1' });
    expect(resultado).toEqual({
      overdueCount: 2,
      overdueBalance: 300,
      dueTodayCount: 1,
      dueTodayBalance: 50,
    });
  });

  it('devolve zeros quando a RPC não devolve linha', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({ data: [], error: null });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    const resultado = await adapter.obterAlerta('tenant-1');

    expect(resultado).toEqual({
      overdueCount: 0,
      overdueBalance: 0,
      dueTodayCount: 0,
      dueTodayBalance: 0,
    });
  });

  it('traduz erro do Postgres em ContasPagarValidationError', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'Acesso negado.' },
    });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    await expect(adapter.obterAlerta('tenant-1')).rejects.toThrow(ContasPagarValidationError);
  });
});

describe('SupabaseContasPagarAdapter — visualizarPreviaSerie', () => {
  it('chama preview_payable_series com os parâmetros mapeados e devolve as ocorrências mapeadas', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({
      data: [
        { series_position: 1, due_date: '2026-09-30', amount: '100.00' },
        { series_position: 2, due_date: '2026-10-30', amount: '100.00' },
      ],
      error: null,
    });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    const resultado = await adapter.visualizarPreviaSerie('tenant-1', {
      seriesType: 'recurring',
      periodicity: 'monthly',
      anchorDate: '2026-09-30',
      occurrences: 2,
      amount: 100,
    });

    expect(supabase.rpc).toHaveBeenCalledWith('preview_payable_series', {
      p_series_type: 'recurring',
      p_periodicity: 'monthly',
      p_anchor_date: '2026-09-30',
      p_occurrences: 2,
      p_amount: 100,
      p_tenant_id: 'tenant-1',
    });
    expect(resultado).toEqual([
      { position: 1, dueDate: '2026-09-30', amount: 100 },
      { position: 2, dueDate: '2026-10-30', amount: 100 },
    ]);
  });

  it('devolve lista vazia quando não há ocorrências', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({ data: [], error: null });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    const resultado = await adapter.visualizarPreviaSerie('tenant-1', {
      seriesType: 'recurring',
      periodicity: 'monthly',
      anchorDate: '2026-09-30',
      occurrences: 1,
      amount: 100,
    });

    expect(resultado).toEqual([]);
  });

  it('traduz erro do Postgres em ContasPagarValidationError', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '22023', message: 'A quantidade deve estar entre 1 e 60.' },
    });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    await expect(
      adapter.visualizarPreviaSerie('tenant-1', {
        seriesType: 'recurring',
        periodicity: 'monthly',
        anchorDate: '2026-09-30',
        occurrences: 61,
        amount: 100,
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });
});

describe('SupabaseContasPagarAdapter — criarRecorrencia', () => {
  it('chama create_recurring_payable_series com os parâmetros mapeados', async () => {
    const supabase = novoSupabaseMock();
    const contas = [{ id: 'conta-1' }, { id: 'conta-2' }];
    supabase.rpc.mockResolvedValueOnce({ data: contas, error: null });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    const resultado = await adapter.criarRecorrencia('tenant-1', {
      description: 'Aluguel',
      categoryId: 'cat-1',
      periodicity: 'monthly',
      anchorDate: '2026-09-30',
      occurrences: 2,
      amount: 100,
      supplierId: 'sup-1',
      documentNumber: 'NF-1',
      notes: 'obs',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('create_recurring_payable_series', {
      p_description: 'Aluguel',
      p_category_id: 'cat-1',
      p_periodicity: 'monthly',
      p_anchor_date: '2026-09-30',
      p_occurrences: 2,
      p_amount: 100,
      p_supplier_id: 'sup-1',
      p_document_number: 'NF-1',
      p_notes: 'obs',
      p_tenant_id: 'tenant-1',
    });
    expect(resultado).toBe(contas);
  });

  it('devolve lista vazia quando a RPC não devolve dados', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({ data: null, error: null });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    const resultado = await adapter.criarRecorrencia('tenant-1', {
      description: 'Aluguel',
      categoryId: 'cat-1',
      periodicity: 'monthly',
      anchorDate: '2026-09-30',
      occurrences: 2,
      amount: 100,
    });

    expect(resultado).toEqual([]);
  });

  it('traduz erro do Postgres em ContasPagarValidationError', async () => {
    const supabase = novoSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '22023', message: 'Categoria de despesa informada não existe ou está arquivada.' },
    });
    const adapter = new SupabaseContasPagarAdapter(supabase);

    await expect(
      adapter.criarRecorrencia('tenant-1', {
        description: 'Aluguel',
        categoryId: 'cat-1',
        periodicity: 'monthly',
        anchorDate: '2026-09-30',
        occurrences: 2,
        amount: 100,
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });
});
