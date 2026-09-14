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
