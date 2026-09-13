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
});
