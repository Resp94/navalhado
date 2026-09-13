import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Routes, Route, Outlet, useSearchParams } from 'react-router-dom';
import { PlanoContasTab } from '../PlanoContasTab';
import { PlanoContasRepository } from '../../../../modules/plano-contas/PlanoContasRepository';
import { InMemoryPlanoContasAdapter } from '../../../../modules/plano-contas/adapters/InMemoryPlanoContasAdapter';
import type { CategoriaDespesa, Fornecedor } from '../../../../modules/plano-contas/types';

const TENANT_ID = 'tenant-plano-contas-1';

function categoria(overrides: Partial<CategoriaDespesa>): CategoriaDespesa {
  return {
    id: overrides.id || 'cat-id',
    tenant_id: TENANT_ID,
    nature: 'expense',
    name: 'Categoria',
    seed_key: null,
    archived_at: null,
    archived_by: null,
    created_at: '2026-01-01T00:00:00Z',
    created_by: null,
    updated_at: '2026-01-01T00:00:00Z',
    updated_by: null,
    ...overrides,
  };
}

function fornecedor(overrides: Partial<Fornecedor>): Fornecedor {
  return {
    id: overrides.id || 'forn-id',
    tenant_id: TENANT_ID,
    name: 'Fornecedor',
    document: null,
    phone: null,
    email: null,
    notes: null,
    default_category_id: null,
    default_category: null,
    archived_at: null,
    archived_by: null,
    created_at: '2026-01-01T00:00:00Z',
    created_by: null,
    updated_at: '2026-01-01T00:00:00Z',
    updated_by: null,
    ...overrides,
  };
}

/** Só para o teste que confere o reflexo na URL: mostra a query string atual. */
function LocationSearchProbe() {
  const [params] = useSearchParams();
  const search = params.toString();
  return <span data-testid="location-search">{search ? `?${search}` : ''}</span>;
}

function renderTab(repository: PlanoContasRepository, initialPath = '/financeiro/cadastros') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          element={<Outlet context={{ tenantId: TENANT_ID, tenantName: 'Barbearia Modelo', timezone: 'America/Sao_Paulo' }} />}
        >
          <Route
            path="/financeiro/cadastros"
            element={
              <>
                <PlanoContasTab repository={repository} />
                <LocationSearchProbe />
              </>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('PlanoContasTab (adaptador em memória)', () => {
  it('lista as Categorias de Despesa ativas, ordenadas alfabeticamente, sem mostrar arquivadas', async () => {
    const adapter = new InMemoryPlanoContasAdapter([
      categoria({ id: 'cat-1', name: 'Marketing', seed_key: 'marketing' }),
      categoria({ id: 'cat-2', name: 'Água', seed_key: 'agua' }),
      categoria({
        id: 'cat-3',
        name: 'Antiga',
        seed_key: null,
        archived_at: '2026-02-01T00:00:00Z',
        archived_by: 'user-1',
      }),
    ]);
    const repository = new PlanoContasRepository(adapter);

    renderTab(repository);

    await waitFor(() => {
      expect(screen.getAllByText('Água').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Marketing').length).toBeGreaterThan(0);
    expect(screen.queryByText('Antiga')).not.toBeInTheDocument();

    // Ordem alfabética dentro da tabela do desktop: Água aparece antes de Marketing
    const table = screen.getByRole('table');
    const cellNames = within(table)
      .getAllByRole('cell')
      .map((cell) => cell.textContent)
      .filter((text) => text === 'Água' || text === 'Marketing');
    expect(cellNames).toEqual(['Água', 'Marketing']);
  });

  it('mostra as categorias arquivadas quando o filtro é ativado, com indicação visual', async () => {
    const adapter = new InMemoryPlanoContasAdapter([
      categoria({ id: 'cat-1', name: 'Marketing' }),
      categoria({
        id: 'cat-2',
        name: 'Antiga',
        archived_at: '2026-02-01T00:00:00Z',
        archived_by: 'user-1',
      }),
    ]);
    const repository = new PlanoContasRepository(adapter);

    renderTab(repository);

    await waitFor(() => {
      expect(screen.getAllByText('Marketing').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Antiga')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Mostrar arquivadas'));

    await waitFor(() => {
      expect(screen.getAllByText('Antiga').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Marketing')).not.toBeInTheDocument();
    expect(screen.getAllByText('Arquivada').length).toBeGreaterThan(0);
  });

  it('mostra estado vazio quando o tenant não tem categorias ativas', async () => {
    const repository = new PlanoContasRepository(new InMemoryPlanoContasAdapter([]));

    renderTab(repository);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma categoria de despesa ativa')).toBeInTheDocument();
    });
  });

  it('cria uma nova categoria de despesa pelo Drawer', async () => {
    const repository = new PlanoContasRepository(new InMemoryPlanoContasAdapter([]));

    renderTab(repository);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma categoria de despesa ativa')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Nova categoria' }));

    const nomeInput = await screen.findByLabelText('Nome da categoria');
    fireEvent.change(nomeInput, { target: { value: '  Estacionamento   Coberto  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar categoria' }));

    await waitFor(() => {
      expect(screen.getAllByText('Estacionamento Coberto').length).toBeGreaterThan(0);
    });
    // Drawer fecha depois de salvar.
    expect(screen.queryByLabelText('Nome da categoria')).not.toBeInTheDocument();
  });

  it('colide com categoria arquivada ao criar e oferece reativar ali mesmo', async () => {
    const adapter = new InMemoryPlanoContasAdapter([
      categoria({
        id: 'cat-antiga',
        name: 'Antiga',
        archived_at: '2026-02-01T00:00:00Z',
        archived_by: 'user-1',
      }),
    ]);
    const repository = new PlanoContasRepository(adapter);

    renderTab(repository);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma categoria de despesa ativa')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Nova categoria' }));
    const nomeInput = await screen.findByLabelText('Nome da categoria');
    fireEvent.change(nomeInput, { target: { value: 'antiga' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar categoria' }));

    const reativarButton = await screen.findByRole('button', { name: /Reativar.*Antiga/ });
    fireEvent.click(reativarButton);

    await waitFor(() => {
      expect(screen.queryByLabelText('Nome da categoria')).not.toBeInTheDocument();
    });
    // A categoria reativada volta a aparecer entre as ativas.
    expect(screen.getAllByText('Antiga').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ativa').length).toBeGreaterThan(0);
  });

  it('ao renomear e colidir com categoria arquivada, não oferece reativar (a reativação não tem relação com a renomeação)', async () => {
    // Achado de revisão pós-implementação: oferecer "Reativar" aqui reativaria um registro sem
    // relação com o que está sendo editado, e o Drawer fecharia como se a renomeação tivesse sido
    // salva — a spec restringe a oferta de reativar à criação (ticket 04/035).
    const adapter = new InMemoryPlanoContasAdapter([
      categoria({ id: 'cat-ativa', name: 'Marketing Digital' }),
      categoria({
        id: 'cat-antiga',
        name: 'Antiga',
        archived_at: '2026-02-01T00:00:00Z',
        archived_by: 'user-1',
      }),
    ]);
    const repository = new PlanoContasRepository(adapter);

    renderTab(repository);

    await waitFor(() => {
      expect(screen.getAllByText('Marketing Digital').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    const nomeInput = await screen.findByLabelText('Nome da categoria');
    fireEvent.change(nomeInput, { target: { value: 'antiga' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await screen.findByText(/Já existe uma categoria arquivada chamada "Antiga"/);
    expect(screen.queryByRole('button', { name: /Reativar/ })).not.toBeInTheDocument();

    // O Drawer continua aberto (nada foi salvo), e nenhuma das duas categorias mudou de estado.
    expect(screen.getByLabelText('Nome da categoria')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getAllByText('Marketing Digital').length).toBeGreaterThan(0);
    expect(screen.queryByText('Antiga')).not.toBeInTheDocument();
  });

  it('arquiva categoria com confirmação pelo ConfirmDialog', async () => {
    const adapter = new InMemoryPlanoContasAdapter([categoria({ id: 'cat-1', name: 'Marketing' })]);
    const repository = new PlanoContasRepository(adapter);

    renderTab(repository);

    await waitFor(() => {
      expect(screen.getAllByText('Marketing').length).toBeGreaterThan(0);
    });

    const table = screen.getByRole('table');
    fireEvent.click(within(table).getByRole('button', { name: 'Arquivar' }));

    // O ConfirmDialog pede confirmação antes de arquivar de fato.
    const dialog = await screen.findByRole('dialog', { name: 'Arquivar categoria de despesa' });
    expect(within(dialog).getByText(/sai das opções de lançamento/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Arquivar' }));

    await waitFor(() => {
      expect(screen.queryByText('Marketing')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Nenhuma categoria de despesa ativa')).toBeInTheDocument();
  });

  it('alterna para a seção Fornecedores pelo controle segmentado e reflete na URL', async () => {
    const repository = new PlanoContasRepository(new InMemoryPlanoContasAdapter([], []));

    renderTab(repository);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma categoria de despesa ativa')).toBeInTheDocument();
    });
    expect(screen.getByTestId('location-search')).toHaveTextContent('');

    fireEvent.click(screen.getByRole('tab', { name: 'Fornecedores' }));

    await waitFor(() => {
      expect(screen.getByText('Nenhum fornecedor ativo')).toBeInTheDocument();
    });
    expect(screen.getByTestId('location-search')).toHaveTextContent('?secao=fornecedores');

    fireEvent.click(screen.getByRole('tab', { name: 'Categorias de Despesa' }));
    await waitFor(() => {
      expect(screen.getByText('Nenhuma categoria de despesa ativa')).toBeInTheDocument();
    });
    expect(screen.getByTestId('location-search')).toHaveTextContent('');
  });

  it('cria um novo fornecedor pelo Drawer', async () => {
    const repository = new PlanoContasRepository(new InMemoryPlanoContasAdapter([], []));

    renderTab(repository, '/financeiro/cadastros?secao=fornecedores');

    await waitFor(() => {
      expect(screen.getByText('Nenhum fornecedor ativo')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Novo fornecedor' }));
    const nomeInput = await screen.findByLabelText('Nome do fornecedor');
    fireEvent.change(nomeInput, { target: { value: 'Distribuidora ABC' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar fornecedor' }));

    await waitFor(() => {
      expect(screen.getAllByText('Distribuidora ABC').length).toBeGreaterThan(0);
    });
    expect(screen.queryByLabelText('Nome do fornecedor')).not.toBeInTheDocument();
  });

  it('colide com fornecedor arquivado ao criar e oferece reativar ali mesmo', async () => {
    const adapter = new InMemoryPlanoContasAdapter(
      [],
      [fornecedor({ id: 'forn-antigo', name: 'Antigo Fornecedor', archived_at: '2026-02-01T00:00:00Z', archived_by: 'user-1' })]
    );
    const repository = new PlanoContasRepository(adapter);

    renderTab(repository, '/financeiro/cadastros?secao=fornecedores');

    await waitFor(() => {
      expect(screen.getByText('Nenhum fornecedor ativo')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Novo fornecedor' }));
    const nomeInput = await screen.findByLabelText('Nome do fornecedor');
    fireEvent.change(nomeInput, { target: { value: 'antigo fornecedor' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar fornecedor' }));

    const reativarButton = await screen.findByRole('button', { name: /Reativar.*Antigo Fornecedor/ });
    fireEvent.click(reativarButton);

    await waitFor(() => {
      expect(screen.queryByLabelText('Nome do fornecedor')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('Antigo Fornecedor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ativo').length).toBeGreaterThan(0);
  });

  it('arquiva fornecedor com confirmação pelo ConfirmDialog', async () => {
    const adapter = new InMemoryPlanoContasAdapter([], [fornecedor({ id: 'forn-1', name: 'Distribuidora ABC' })]);
    const repository = new PlanoContasRepository(adapter);

    renderTab(repository, '/financeiro/cadastros?secao=fornecedores');

    await waitFor(() => {
      expect(screen.getAllByText('Distribuidora ABC').length).toBeGreaterThan(0);
    });

    const table = screen.getByRole('table');
    fireEvent.click(within(table).getByRole('button', { name: 'Arquivar' }));

    const dialog = await screen.findByRole('dialog', { name: 'Arquivar fornecedor' });
    expect(within(dialog).getByText(/sai das opções de lançamento/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Arquivar' }));

    await waitFor(() => {
      expect(screen.queryByText('Distribuidora ABC')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Nenhum fornecedor ativo')).toBeInTheDocument();
  });

  it('busca fornecedor por nome e por documento, com ou sem máscara', async () => {
    const adapter = new InMemoryPlanoContasAdapter(
      [],
      [
        fornecedor({ id: 'forn-1', name: 'Distribuidora ABC', document: '12345678909' }),
        fornecedor({ id: 'forn-2', name: 'Materiais XYZ', document: null }),
      ]
    );
    const repository = new PlanoContasRepository(adapter);

    renderTab(repository, '/financeiro/cadastros?secao=fornecedores');

    await waitFor(() => {
      expect(screen.getAllByText('Distribuidora ABC').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Materiais XYZ').length).toBeGreaterThan(0);

    const busca = screen.getByLabelText('Buscar fornecedor por nome ou documento');

    fireEvent.change(busca, { target: { value: 'materiais' } });
    await waitFor(() => {
      expect(screen.queryByText('Distribuidora ABC')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('Materiais XYZ').length).toBeGreaterThan(0);

    // Documento COM máscara encontra o fornecedor pelo documento sem máscara salvo.
    fireEvent.change(busca, { target: { value: '123.456.789-09' } });
    await waitFor(() => {
      expect(screen.getAllByText('Distribuidora ABC').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Materiais XYZ')).not.toBeInTheDocument();

    // Documento SEM máscara encontra o mesmo fornecedor.
    fireEvent.change(busca, { target: { value: '12345678909' } });
    await waitFor(() => {
      expect(screen.getAllByText('Distribuidora ABC').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Materiais XYZ')).not.toBeInTheDocument();
  });
});
