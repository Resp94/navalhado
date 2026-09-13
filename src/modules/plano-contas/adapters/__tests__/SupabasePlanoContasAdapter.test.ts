import { describe, expect, it, vi } from 'vitest';
import { SupabasePlanoContasAdapter } from '../SupabasePlanoContasAdapter';
import { PlanoContasConflictError, PlanoContasValidationError } from '../../PlanoContasRepository';

function buildSupabaseMock(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const eqNature = vi.fn().mockReturnValue({ order });
  const eqTenant = vi.fn().mockReturnValue({ eq: eqNature });
  const select = vi.fn().mockReturnValue({ eq: eqTenant });
  const from = vi.fn().mockReturnValue({ select });
  return { supabase: { from } as any, from, select, eqTenant, eqNature, order };
}

function buildRpcMock(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  return { supabase: { rpc } as any, rpc };
}

describe('SupabasePlanoContasAdapter', () => {
  it('lista Categorias de Despesa do tenant filtrando por nature=expense', async () => {
    const categoriaRow = {
      id: 'cat-1',
      tenant_id: 'tenant-1',
      nature: 'expense',
      name: 'Energia',
      seed_key: 'energia',
      archived_at: null,
      archived_by: null,
      created_at: '2026-01-01T00:00:00Z',
      created_by: null,
      updated_at: '2026-01-01T00:00:00Z',
      updated_by: null,
    };
    const { supabase, from, select, eqTenant, eqNature, order } = buildSupabaseMock({
      data: [categoriaRow],
      error: null,
    });

    const adapter = new SupabasePlanoContasAdapter(supabase);
    const result = await adapter.listarCategoriasDespesa('tenant-1');

    expect(from).toHaveBeenCalledWith('financial_categories');
    expect(select).toHaveBeenCalledWith('*');
    expect(eqTenant).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(eqNature).toHaveBeenCalledWith('nature', 'expense');
    expect(order).toHaveBeenCalledWith('name');
    expect(result).toEqual([categoriaRow]);
  });

  it('devolve lista vazia quando o Supabase não retorna dados', async () => {
    const { supabase } = buildSupabaseMock({ data: null, error: null });
    const adapter = new SupabasePlanoContasAdapter(supabase);
    const result = await adapter.listarCategoriasDespesa('tenant-1');
    expect(result).toEqual([]);
  });

  it('propaga o erro do Supabase', async () => {
    const { supabase } = buildSupabaseMock({
      data: null,
      error: { message: 'Falha de rede' },
    });
    const adapter = new SupabasePlanoContasAdapter(supabase);
    await expect(adapter.listarCategoriasDespesa('tenant-1')).rejects.toEqual({ message: 'Falha de rede' });
  });

  it('cria categoria chamando create_expense_category', async () => {
    const categoriaRow = {
      id: 'cat-1',
      tenant_id: 'tenant-1',
      nature: 'expense',
      name: 'Marketing',
      seed_key: null,
      archived_at: null,
      archived_by: null,
      created_at: '2026-01-01T00:00:00Z',
      created_by: 'user-1',
      updated_at: '2026-01-01T00:00:00Z',
      updated_by: null,
    };
    const { supabase, rpc } = buildRpcMock({ data: categoriaRow, error: null });
    const adapter = new SupabasePlanoContasAdapter(supabase);

    const result = await adapter.criarCategoriaDespesa('tenant-1', 'Marketing');

    expect(rpc).toHaveBeenCalledWith('create_expense_category', {
      p_name: 'Marketing',
      p_tenant_id: 'tenant-1',
    });
    expect(result).toEqual(categoriaRow);
  });

  it('renomeia categoria chamando rename_expense_category', async () => {
    const { supabase, rpc } = buildRpcMock({ data: { id: 'cat-1', name: 'Nova' }, error: null });
    const adapter = new SupabasePlanoContasAdapter(supabase);

    await adapter.renomearCategoriaDespesa('tenant-1', 'cat-1', 'Nova');

    expect(rpc).toHaveBeenCalledWith('rename_expense_category', {
      p_category_id: 'cat-1',
      p_name: 'Nova',
      p_tenant_id: 'tenant-1',
    });
  });

  it('arquiva categoria chamando archive_expense_category', async () => {
    const { supabase, rpc } = buildRpcMock({ data: { id: 'cat-1' }, error: null });
    const adapter = new SupabasePlanoContasAdapter(supabase);

    await adapter.arquivarCategoriaDespesa('tenant-1', 'cat-1');

    expect(rpc).toHaveBeenCalledWith('archive_expense_category', {
      p_category_id: 'cat-1',
      p_tenant_id: 'tenant-1',
    });
  });

  it('reativa categoria chamando reactivate_expense_category', async () => {
    const { supabase, rpc } = buildRpcMock({ data: { id: 'cat-1' }, error: null });
    const adapter = new SupabasePlanoContasAdapter(supabase);

    await adapter.reativarCategoriaDespesa('tenant-1', 'cat-1');

    expect(rpc).toHaveBeenCalledWith('reactivate_expense_category', {
      p_category_id: 'cat-1',
      p_tenant_id: 'tenant-1',
    });
  });

  it('traduz erro 23505 com detail estruturado em PlanoContasConflictError', async () => {
    const { supabase } = buildRpcMock({
      data: null,
      error: {
        code: '23505',
        message: 'Já existe uma categoria de despesa com este nome.',
        details: JSON.stringify({
          existing_id: 'cat-existente',
          existing_name: 'Marketing',
          archived: true,
        }),
      },
    });
    const adapter = new SupabasePlanoContasAdapter(supabase);

    const erro = await adapter.criarCategoriaDespesa('tenant-1', 'marketing').catch((e) => e);

    expect(erro).toBeInstanceOf(PlanoContasConflictError);
    expect(erro.existingId).toBe('cat-existente');
    expect(erro.existingName).toBe('Marketing');
    expect(erro.archived).toBe(true);
  });

  it('traduz erro 23505 sem detail reconhecível em PlanoContasValidationError', async () => {
    const { supabase } = buildRpcMock({
      data: null,
      error: { code: '23505', message: 'conflito', details: null },
    });
    const adapter = new SupabasePlanoContasAdapter(supabase);

    await expect(adapter.criarCategoriaDespesa('tenant-1', 'marketing')).rejects.toBeInstanceOf(
      PlanoContasValidationError
    );
  });

  it('traduz qualquer outro erro (papel, unidade, estado) em PlanoContasValidationError com a mensagem da RPC', async () => {
    const { supabase } = buildRpcMock({
      data: null,
      error: { code: '42501', message: 'Acesso negado para gerenciar o Plano de Contas.' },
    });
    const adapter = new SupabasePlanoContasAdapter(supabase);

    const erro = await adapter.criarCategoriaDespesa('tenant-1', 'Marketing').catch((e) => e);
    expect(erro).toBeInstanceOf(PlanoContasValidationError);
    expect(erro.message).toBe('Acesso negado para gerenciar o Plano de Contas.');
  });
});
