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

/** Mock do select com join à categoria padrão (`listarFornecedores`): um só `.eq()`, não dois. */
function buildFornecedorSelectMock(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const eqTenant = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq: eqTenant });
  const from = vi.fn().mockReturnValue({ select });
  return { supabase: { from } as any, from, select, eqTenant, order };
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

  it('lista Fornecedores com a categoria padrão e o estado dela, via join', async () => {
    const fornecedorRow = {
      id: 'forn-1',
      tenant_id: 'tenant-1',
      name: 'Distribuidora ABC',
      document: '12345678909',
      phone: '11988887777',
      email: 'contato@fornecedor.com',
      notes: null,
      default_category_id: 'cat-1',
      archived_at: null,
      archived_by: null,
      created_at: '2026-01-01T00:00:00Z',
      created_by: 'user-1',
      updated_at: '2026-01-01T00:00:00Z',
      updated_by: null,
      default_category: { id: 'cat-1', name: 'Produtos para revenda', archived_at: null },
    };
    const { supabase, from, select, eqTenant, order } = buildFornecedorSelectMock({
      data: [fornecedorRow],
      error: null,
    });

    const adapter = new SupabasePlanoContasAdapter(supabase);
    const result = await adapter.listarFornecedores('tenant-1');

    expect(from).toHaveBeenCalledWith('suppliers');
    expect(select).toHaveBeenCalledWith(
      '*, default_category:financial_categories!default_category_id(id, name, archived_at)'
    );
    expect(eqTenant).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(order).toHaveBeenCalledWith('name');
    expect(result).toEqual([
      {
        id: 'forn-1',
        tenant_id: 'tenant-1',
        name: 'Distribuidora ABC',
        document: '12345678909',
        phone: '11988887777',
        email: 'contato@fornecedor.com',
        notes: null,
        default_category_id: 'cat-1',
        default_category: { id: 'cat-1', name: 'Produtos para revenda', archived: false },
        archived_at: null,
        archived_by: null,
        created_at: '2026-01-01T00:00:00Z',
        created_by: 'user-1',
        updated_at: '2026-01-01T00:00:00Z',
        updated_by: null,
      },
    ]);
  });

  it('mapeia categoria padrão arquivada como archived: true', async () => {
    const fornecedorRow = {
      id: 'forn-1',
      tenant_id: 'tenant-1',
      name: 'Distribuidora ABC',
      document: null,
      phone: null,
      email: null,
      notes: null,
      default_category_id: 'cat-1',
      archived_at: null,
      archived_by: null,
      created_at: '2026-01-01T00:00:00Z',
      created_by: null,
      updated_at: '2026-01-01T00:00:00Z',
      updated_by: null,
      default_category: { id: 'cat-1', name: 'Descontinuada', archived_at: '2026-02-01T00:00:00Z' },
    };
    const { supabase } = buildFornecedorSelectMock({ data: [fornecedorRow], error: null });
    const adapter = new SupabasePlanoContasAdapter(supabase);

    const [result] = await adapter.listarFornecedores('tenant-1');
    expect(result.default_category).toEqual({ id: 'cat-1', name: 'Descontinuada', archived: true });
  });

  it('mapeia fornecedor sem categoria padrão como default_category: null', async () => {
    const fornecedorRow = {
      id: 'forn-1',
      tenant_id: 'tenant-1',
      name: 'Distribuidora ABC',
      document: null,
      phone: null,
      email: null,
      notes: null,
      default_category_id: null,
      archived_at: null,
      archived_by: null,
      created_at: '2026-01-01T00:00:00Z',
      created_by: null,
      updated_at: '2026-01-01T00:00:00Z',
      updated_by: null,
      default_category: null,
    };
    const { supabase } = buildFornecedorSelectMock({ data: [fornecedorRow], error: null });
    const adapter = new SupabasePlanoContasAdapter(supabase);

    const [result] = await adapter.listarFornecedores('tenant-1');
    expect(result.default_category).toBeNull();
  });

  it('cria fornecedor chamando create_supplier com todos os parâmetros', async () => {
    const fornecedorRow = {
      id: 'forn-1',
      tenant_id: 'tenant-1',
      name: 'Distribuidora ABC',
      document: '12345678909',
      phone: '11988887777',
      email: 'contato@fornecedor.com',
      notes: 'obs',
      default_category_id: 'cat-1',
      archived_at: null,
      archived_by: null,
      created_at: '2026-01-01T00:00:00Z',
      created_by: 'user-1',
      updated_at: '2026-01-01T00:00:00Z',
      updated_by: null,
    };
    const { supabase, rpc } = buildRpcMock({ data: fornecedorRow, error: null });
    const adapter = new SupabasePlanoContasAdapter(supabase);

    const result = await adapter.criarFornecedor('tenant-1', {
      name: 'Distribuidora ABC',
      document: '12345678909',
      phone: '11988887777',
      email: 'contato@fornecedor.com',
      notes: 'obs',
      defaultCategoryId: 'cat-1',
    });

    expect(rpc).toHaveBeenCalledWith('create_supplier', {
      p_name: 'Distribuidora ABC',
      p_document: '12345678909',
      p_phone: '11988887777',
      p_email: 'contato@fornecedor.com',
      p_notes: 'obs',
      p_default_category_id: 'cat-1',
      p_tenant_id: 'tenant-1',
    });
    // Retorno da RPC (rowtype puro, sem join) mapeia default_category: null --
    // a lista recarregada pela aba é que traz o join. Achado registrado na spec.
    expect(result.default_category).toBeNull();
    expect(result.name).toBe('Distribuidora ABC');
  });

  it('atualiza fornecedor chamando update_supplier', async () => {
    const { supabase, rpc } = buildRpcMock({ data: { id: 'forn-1', name: 'Nova' }, error: null });
    const adapter = new SupabasePlanoContasAdapter(supabase);

    await adapter.atualizarFornecedor('tenant-1', 'forn-1', {
      name: 'Nova',
      document: null,
      phone: null,
      email: null,
      notes: null,
      defaultCategoryId: null,
    });

    expect(rpc).toHaveBeenCalledWith('update_supplier', {
      p_supplier_id: 'forn-1',
      p_name: 'Nova',
      p_document: null,
      p_phone: null,
      p_email: null,
      p_notes: null,
      p_default_category_id: null,
      p_tenant_id: 'tenant-1',
    });
  });

  it('arquiva fornecedor chamando archive_supplier', async () => {
    const { supabase, rpc } = buildRpcMock({ data: { id: 'forn-1' }, error: null });
    const adapter = new SupabasePlanoContasAdapter(supabase);

    await adapter.arquivarFornecedor('tenant-1', 'forn-1');

    expect(rpc).toHaveBeenCalledWith('archive_supplier', {
      p_supplier_id: 'forn-1',
      p_tenant_id: 'tenant-1',
    });
  });

  it('reativa fornecedor chamando reactivate_supplier', async () => {
    const { supabase, rpc } = buildRpcMock({ data: { id: 'forn-1' }, error: null });
    const adapter = new SupabasePlanoContasAdapter(supabase);

    await adapter.reativarFornecedor('tenant-1', 'forn-1');

    expect(rpc).toHaveBeenCalledWith('reactivate_supplier', {
      p_supplier_id: 'forn-1',
      p_tenant_id: 'tenant-1',
    });
  });

  it('traduz conflito de documento (23505) do Fornecedor em PlanoContasConflictError', async () => {
    const { supabase } = buildRpcMock({
      data: null,
      error: {
        code: '23505',
        message: 'Já existe um fornecedor com este documento.',
        details: JSON.stringify({
          existing_id: 'forn-existente',
          existing_name: 'Distribuidora ABC',
          archived: false,
        }),
      },
    });
    const adapter = new SupabasePlanoContasAdapter(supabase);

    const erro = await adapter
      .criarFornecedor('tenant-1', { name: 'Outro Nome', document: '12345678909' })
      .catch((e) => e);

    expect(erro).toBeInstanceOf(PlanoContasConflictError);
    expect(erro.existingId).toBe('forn-existente');
    expect(erro.message).toBe('Já existe um fornecedor com este documento.');
  });
});
