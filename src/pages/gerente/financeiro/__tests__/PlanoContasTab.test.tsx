import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import { PlanoContasTab } from '../PlanoContasTab';
import { PlanoContasRepository } from '../../../../modules/plano-contas/PlanoContasRepository';
import { InMemoryPlanoContasAdapter } from '../../../../modules/plano-contas/adapters/InMemoryPlanoContasAdapter';
import type { CategoriaDespesa } from '../../../../modules/plano-contas/types';

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

function renderTab(repository: PlanoContasRepository) {
  return render(
    <MemoryRouter initialEntries={['/financeiro/cadastros']}>
      <Routes>
        <Route
          element={<Outlet context={{ tenantId: TENANT_ID, tenantName: 'Barbearia Modelo', timezone: 'America/Sao_Paulo' }} />}
        >
          <Route path="/financeiro/cadastros" element={<PlanoContasTab repository={repository} />} />
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
});
