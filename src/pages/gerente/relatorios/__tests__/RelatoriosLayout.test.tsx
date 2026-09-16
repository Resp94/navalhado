import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RelatoriosLayout } from '../RelatoriosLayout';

const mockObterFaturamentoPorPeriodo = vi.fn();
const mockObterEquipeEServicos = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({
      tenantId: 'tenant-1',
      tenantName: 'Barbearia Navalha',
      timezone: 'America/Sao_Paulo',
    }),
  };
});

// Implementa RelatoriosAdapter por completo: um mock parcial não é
// pego pelo TypeScript (fábrica de vi.mock não é checada contra a
// interface real) e travaria em runtime se um teste futuro deste
// arquivo passar a exercitar a aba Equipe e Serviços.
vi.mock('../../../../modules/relatorios/adapters/SupabaseRelatoriosAdapter', () => ({
  SupabaseRelatoriosAdapter: vi.fn().mockImplementation(() => ({
    obterFaturamentoPorPeriodo: mockObterFaturamentoPorPeriodo,
    obterEquipeEServicos: mockObterEquipeEServicos,
  })),
}));

function setViewportWidth(width: number) {
  const matches = width <= 768;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('RelatoriosLayout — gate de desktop', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    mockObterFaturamentoPorPeriodo.mockReset();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('em largura de celular mostra só o aviso e nunca monta as páginas filhas (repositório não chamado)', () => {
    setViewportWidth(375);

    render(
      <MemoryRouter initialEntries={['/relatorios/faturamento']}>
        <Routes>
          <Route path="/relatorios" element={<RelatoriosLayout />}>
            <Route path="faturamento" element={<div>Conteúdo do Faturamento</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Os relatórios estão disponíveis apenas no computador')).toBeInTheDocument();
    expect(screen.queryByText('Conteúdo do Faturamento')).not.toBeInTheDocument();
    expect(mockObterFaturamentoPorPeriodo).not.toHaveBeenCalled();
  });

  it('em largura de desktop mostra o conteúdo normalmente', () => {
    setViewportWidth(1280);

    render(
      <MemoryRouter initialEntries={['/relatorios/faturamento']}>
        <Routes>
          <Route path="/relatorios" element={<RelatoriosLayout />}>
            <Route path="faturamento" element={<div>Conteúdo do Faturamento</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Os relatórios estão disponíveis apenas no computador')).not.toBeInTheDocument();
    expect(screen.getByText('Conteúdo do Faturamento')).toBeInTheDocument();
  });
});
